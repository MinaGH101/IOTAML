"""Core backend infrastructure for http."""

from __future__ import annotations

import json
import logging
import re
import time
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response, StreamingResponse

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.request_context import bind_context, reset_context
from app.core.responses import error_payload, success_payload
from app.infrastructure.observability import record_request

logger = logging.getLogger("iota.api")


def _http_error_code(status_code: int) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "PERMISSION_DENIED",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        503: "SERVICE_UNAVAILABLE",
    }.get(status_code, "HTTP_ERROR")


class ApiEnvelopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        supplied = request.headers.get('X-Request-ID', '')
        request_id = supplied if re.fullmatch(r'[A-Za-z0-9._-]{1,128}', supplied) else uuid4().hex
        request.state.request_id = request_id
        token = bind_context(request_id=request_id)
        started = time.perf_counter()
        response = None
        try:
            response = await call_next(request)
            response.headers['X-Request-ID'] = request_id

            if not request.url.path.startswith('/api'):
                return response
            if isinstance(response, StreamingResponse) and response.media_type not in {'application/json', None}:
                return response
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type:
                return response

            maximum = get_settings().api_max_response_bytes
            body = bytearray()
            async for chunk in response.body_iterator:
                body.extend(chunk)
                if len(body) > maximum:
                    return JSONResponse(
                        status_code=500,
                        content=error_payload(
                            code='RESPONSE_TOO_LARGE',
                            message='The response exceeded the configured size limit.',
                            details={'max_bytes': maximum},
                            request_id=request_id,
                        ),
                        headers={'X-Request-ID': request_id},
                    )
            raw_body = bytes(body)
            try:
                payload = json.loads(raw_body.decode('utf-8')) if raw_body else None
            except (UnicodeDecodeError, json.JSONDecodeError):
                return Response(content=raw_body, status_code=response.status_code, headers=dict(response.headers), media_type=response.media_type)

            if isinstance(payload, dict) and 'success' in payload:
                wrapped = payload
            elif response.status_code >= 400:
                detail = payload.get('detail') if isinstance(payload, dict) else None
                wrapped = error_payload(code=_http_error_code(response.status_code), message=str(detail or 'Request failed.'), request_id=request_id)
            else:
                wrapped = success_payload(payload, request_id=request_id)

            headers = {key: value for key, value in response.headers.items() if key.lower() not in {'content-length', 'content-type', 'x-request-id'}}
            headers['X-Request-ID'] = request_id
            return JSONResponse(content=wrapped, status_code=response.status_code, headers=headers)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000)
            status_code = int(getattr(response, 'status_code', 500))
            record_request(request.method, request.url.path, status_code, duration_ms)
            logger.info('HTTP request completed', extra={'duration_ms': duration_ms, 'status_code': status_code})
            reset_context(token)


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                request_id=getattr(request.state, "request_id", ""),
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = {"errors": exc.errors()}
        return JSONResponse(
            status_code=422,
            content=error_payload(
                code="VALIDATION_ERROR",
                message="Request validation failed.",
                details=details,
                request_id=getattr(request.state, "request_id", ""),
            ),
        )

    @app.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        details = exc.detail if isinstance(exc.detail, dict) else {}
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(
                code=_http_error_code(exc.status_code),
                message=message,
                details=details,
                request_id=getattr(request.state, "request_id", ""),
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error", extra={"request_id": getattr(request.state, "request_id", "")})
        return JSONResponse(
            status_code=500,
            content=error_payload(
                code="INTERNAL_ERROR",
                message="An unexpected server error occurred.",
                request_id=getattr(request.state, "request_id", ""),
            ),
        )

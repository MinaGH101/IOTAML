from __future__ import annotations

from copy import deepcopy
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


def _success_schema(data_schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "required": ["success", "data", "meta", "request_id"],
        "properties": {
            "success": {"type": "boolean", "const": True, "example": True},
            "data": data_schema,
            "meta": {"type": "object", "additionalProperties": True, "example": {}},
            "request_id": {"type": "string", "example": "4a2d9e0d5a4c4c74a2ec4fd9867f29dd"},
        },
    }


def _error_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "required": ["success", "error", "request_id"],
        "properties": {
            "success": {"type": "boolean", "const": False, "example": False},
            "error": {
                "type": "object",
                "required": ["code", "message", "details"],
                "properties": {
                    "code": {"type": "string", "example": "ARTIFACT_NOT_FOUND"},
                    "message": {"type": "string", "example": "Artifact not found."},
                    "details": {"type": "object", "additionalProperties": True, "example": {"artifact_id": 42}},
                },
            },
            "request_id": {"type": "string", "example": "4a2d9e0d5a4c4c74a2ec4fd9867f29dd"},
        },
    }


def install_openapi(app: FastAPI) -> None:
    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, description=app.description, routes=app.routes)
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        components["ApiErrorEnvelope"] = _error_schema()

        for path, path_item in schema.get("paths", {}).items():
            if not path.startswith("/api"):
                continue
            for method, operation in path_item.items():
                if method.lower() not in {"get", "post", "put", "patch", "delete"} or not isinstance(operation, dict):
                    continue
                responses = operation.setdefault("responses", {})
                for status, response in list(responses.items()):
                    if not isinstance(response, dict):
                        continue
                    content = response.get("content", {}).get("application/json")
                    if not isinstance(content, dict):
                        continue
                    if str(status).startswith("2"):
                        original = deepcopy(content.get("schema") or {})
                        content["schema"] = _success_schema(original)
                    else:
                        content["schema"] = {"$ref": "#/components/schemas/ApiErrorEnvelope"}
                responses.setdefault(
                    "500",
                    {
                        "description": "Internal server error",
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ApiErrorEnvelope"}}},
                    },
                )
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi  # type: ignore[method-assign]

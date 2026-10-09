"""Bounded model calls and provider errors for document/review nodes."""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import get_settings
from app.workflow.contracts.errors import NodeContractError


def _parse_json_object(content: str) -> dict[str, Any]:
    """Accept an object even when a provider wraps it in Markdown or reasoning text."""
    text = content.strip()
    if text.startswith('```'):
        text = text.split('\n', 1)[1] if '\n' in text else ''
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
    start = text.find('{')
    if start < 0:
        raise ValueError('Model response does not contain a JSON object.')
    result, _ = json.JSONDecoder().raw_decode(text[start:])
    if not isinstance(result, dict):
        raise ValueError('Model response is not a JSON object.')
    return result


def ask_json(*, model: str, system: str, user: str, max_tokens: int = 1600) -> dict[str, Any]:
    config = get_settings()
    if not config.openai_api_key.strip():
        raise NodeContractError('REVIEW_MODEL_KEY_MISSING', 'OpenAI API key is not configured.',
                                category='setting', setting='OPENAI_API_KEY',
                                suggested_fix='Set OPENAI_API_KEY on the backend and worker, then restart them.')
    try:
        from openai import APIConnectionError, APITimeoutError, APIStatusError, AuthenticationError, RateLimitError, BadRequestError, OpenAI
        client = OpenAI(api_key=config.openai_api_key, base_url=config.openai_base_url,
                        timeout=45.0, max_retries=1)
        json_system = f'{system}\n\nReturn only one valid JSON object: no Markdown, prose, or code fences.'
        parse_error: ValueError | json.JSONDecodeError | None = None
        for attempt in range(2):
            retry_instruction = (' Your previous output was not valid JSON; return the JSON object now.' if attempt else '')
            response = client.chat.completions.create(
                model=model, response_format={'type': 'json_object'},
                max_tokens=max_tokens,
                messages=[{'role': 'system', 'content': json_system + retry_instruction}, {'role': 'user', 'content': user}],
            )
            content = response.choices[0].message.content or ''
            try:
                return _parse_json_object(content)
            except (json.JSONDecodeError, ValueError) as exc:
                parse_error = exc
        if parse_error is not None:
            raise parse_error
        raise ValueError('Model response is not a JSON object.')
    except (AuthenticationError, RateLimitError, APITimeoutError, APIConnectionError, BadRequestError, APIStatusError) as exc:
        if isinstance(exc, AuthenticationError):
            code, fix = 'REVIEW_MODEL_AUTH', 'Check the current OPENAI_API_KEY and provider access.'
        elif isinstance(exc, RateLimitError):
            code, fix = 'REVIEW_MODEL_RATE_LIMIT', 'Wait and retry, or increase the provider rate limit.'
        elif isinstance(exc, (APITimeoutError, APIConnectionError)):
            code, fix = 'REVIEW_MODEL_UNREACHABLE', 'Check internet access and OPENAI_BASE_URL, then retry.'
        elif isinstance(exc, APIStatusError) and exc.status_code >= 500:
            code, fix = 'REVIEW_MODEL_PROVIDER_ERROR', 'The model provider is unavailable. Retry later or contact support.'
        else:
            code, fix = 'REVIEW_MODEL_REQUEST_INVALID', 'Check the configured model name and prompt size.'
        raise NodeContractError(code, f'Model request failed ({type(exc).__name__}).', category='execution',
                                responsibility='user', suggested_fix=fix,
                                details={'model': model, 'provider_error': type(exc).__name__}) from exc
    except (json.JSONDecodeError, ValueError, IndexError, KeyError) as exc:
        raise NodeContractError('REVIEW_MODEL_OUTPUT_INVALID', 'The model did not return a valid JSON object.',
                                category='execution', suggested_fix='Retry the node or simplify the prompt.',
                                details={'model': model}) from exc


def ocr_pdf(pdf_path: Path, *, pages: list[int]) -> dict[str, Any]:
    """Send one private PDF to the provider's dedicated Mistral OCR endpoint."""
    config = get_settings()
    if not config.openai_api_key.strip():
        raise NodeContractError('REVIEW_MODEL_KEY_MISSING', 'OpenAI API key is not configured.',
                                category='setting', setting='OPENAI_API_KEY',
                                suggested_fix='Set OPENAI_API_KEY and restart the backend and worker.')
    if not pages:
        raise NodeContractError('REVIEW_OCR_PAGES_REQUIRED', 'OCR needs at least one PDF page.',
                                category='setting', setting='max_pages',
                                suggested_fix='Set Maximum pages to one or more pages.')
    try:
        pdf_bytes = pdf_path.read_bytes()
    except OSError as exc:
        raise NodeContractError('REVIEW_ARTIFACT_UNAVAILABLE', 'The PDF could not be read for OCR.',
                                category='data', suggested_fix='Upload the PDF again and retry.') from exc
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise NodeContractError('REVIEW_OCR_FILE_LIMIT', 'The OCR provider accepts PDF files up to 50 MB.',
                                category='data', suggested_fix='Compress or split the PDF, then retry.',
                                details={'size_bytes': len(pdf_bytes), 'maximum_bytes': 50 * 1024 * 1024})

    endpoint = f"{config.openai_base_url.rstrip('/')}/ocr"
    payload = {
        'model': config.iota_ocr_model,
        'document': {
            'type': 'document_url',
            'document_url': f"data:application/pdf;base64,{base64.b64encode(pdf_bytes).decode('ascii')}",
        },
        'pages': pages,
        'include_image_base64': False,
    }
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {config.openai_api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        method='POST',
    )
    maximum_attempts = int(getattr(config, 'iota_ocr_request_attempts', 4))
    base_delay = float(getattr(config, 'iota_ocr_retry_base_seconds', 15.0))
    result: dict[str, Any] | None = None
    last_http_error: HTTPError | None = None
    for attempt in range(1, maximum_attempts + 1):
        try:
            with urlopen(request, timeout=300) as response:
                result = json.loads(response.read().decode('utf-8'))
            break
        except HTTPError as exc:
            status = int(exc.code)
            last_http_error = exc
            retryable = status == 429 or status >= 500
            if retryable and attempt < maximum_attempts:
                raw_retry_after = exc.headers.get('Retry-After') if exc.headers else None
                try:
                    retry_after = float(raw_retry_after) if raw_retry_after is not None else 0.0
                except (TypeError, ValueError):
                    retry_after = 0.0
                delay = min(120.0, max(retry_after, base_delay * (2 ** (attempt - 1))))
                time.sleep(delay)
                continue
            code = ('REVIEW_MODEL_AUTH' if status in {401, 403} else
                    'REVIEW_MODEL_RATE_LIMIT' if status == 429 else
                    'REVIEW_MODEL_PROVIDER_ERROR' if status >= 500 else
                    'REVIEW_MODEL_REQUEST_INVALID')
            fix = ('Check OPENAI_API_KEY and OCR-model access.' if status in {401, 403} else
                   'The OCR provider kept rate-limiting this request. Wait for the provider window to reset or increase its quota.' if status == 429 else
                   'The OCR provider is unavailable; retry later.' if status >= 500 else
                   'Check IOTA_OCR_MODEL, the PDF, and the provider OCR endpoint.')
            raise NodeContractError(code, f'OCR request failed with HTTP {status} after {attempt} attempts.',
                                    category='execution', responsibility='application' if retryable else 'user',
                                    suggested_fix=fix,
                                    details={'status_code': status, 'model': config.iota_ocr_model,
                                             'request_attempts': attempt}) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise NodeContractError('REVIEW_MODEL_UNREACHABLE', 'The OCR provider could not be reached.',
                                    category='execution', responsibility='application',
                                    suggested_fix='Check internet access and OPENAI_BASE_URL, then retry.',
                                    details={'model': config.iota_ocr_model, 'provider_error': type(exc).__name__}) from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise NodeContractError('REVIEW_OCR_OUTPUT_INVALID', 'The OCR provider returned invalid JSON.',
                                    category='execution', suggested_fix='Retry the OCR node or contact the provider.',
                                    details={'model': config.iota_ocr_model}) from exc

    if result is None and last_http_error is not None:  # Defensive; the loop raises on its final HTTP failure.
        raise last_http_error
    if not isinstance(result, dict) or not isinstance(result.get('pages'), list):
        raise NodeContractError('REVIEW_OCR_OUTPUT_INVALID', 'The OCR response does not contain a pages array.',
                                category='execution', suggested_fix='Check the configured OCR model and retry.',
                                details={'model': config.iota_ocr_model})
    return result

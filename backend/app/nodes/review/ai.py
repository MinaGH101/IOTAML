"""Bounded model calls and provider errors for document/review nodes."""
from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings
from app.workflow.contracts.errors import NodeContractError


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
        response = client.chat.completions.create(
            model=model, temperature=0, response_format={'type': 'json_object'},
            max_tokens=max_tokens,
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        )
        content = response.choices[0].message.content or ''
        result = json.loads(content)
        if not isinstance(result, dict):
            raise ValueError('Model response is not a JSON object.')
        return result
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


def ocr_image(image_base64: str, *, page: int, prompt: str) -> str:
    config = get_settings()
    if not config.openai_api_key.strip():
        raise NodeContractError('REVIEW_MODEL_KEY_MISSING', 'OpenAI API key is not configured.',
                                category='setting', setting='OPENAI_API_KEY',
                                suggested_fix='Set OPENAI_API_KEY and restart the backend and worker.')
    try:
        from openai import APIConnectionError, APITimeoutError, APIStatusError, AuthenticationError, RateLimitError, OpenAI
        client = OpenAI(api_key=config.openai_api_key, base_url=config.openai_base_url,
                        timeout=45.0, max_retries=1)
        response = client.chat.completions.create(
            model=config.iota_ocr_model, max_tokens=1800,
            messages=[{'role': 'system', 'content': 'Transcribe all visible text accurately. Preserve Persian text. Return plain text only.'},
                      {'role': 'user', 'content': [
                          {'type': 'text', 'text': f'Page {page}. {prompt[:1000]}'},
                          {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image_base64}', 'detail': 'high'}},
                      ]}],
        )
        return (response.choices[0].message.content or '').strip()
    except (AuthenticationError, RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
        code = ('REVIEW_MODEL_AUTH' if isinstance(exc, AuthenticationError) else
                'REVIEW_MODEL_RATE_LIMIT' if isinstance(exc, RateLimitError) else
                'REVIEW_MODEL_UNREACHABLE' if isinstance(exc, (APITimeoutError, APIConnectionError)) else
                'REVIEW_MODEL_PROVIDER_ERROR' if exc.status_code >= 500 else 'REVIEW_MODEL_REQUEST_INVALID')
        raise NodeContractError(code, f'OCR request failed on page {page} ({type(exc).__name__}).',
                                category='execution', suggested_fix='Check the OCR model, API key and network, then retry.',
                                details={'page': page, 'model': config.iota_ocr_model}) from exc

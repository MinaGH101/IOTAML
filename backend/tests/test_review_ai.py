from __future__ import annotations

import base64
from email.message import Message
from io import BytesIO
import json
import sys
from types import ModuleType, SimpleNamespace
from urllib.error import HTTPError

import app.nodes.review.ai as review_ai


class _Response:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return json.dumps({
            'model': 'mistral-ocr-latest',
            'pages': [{'index': 0, 'markdown': 'متن طرح'}],
        }, ensure_ascii=False).encode('utf-8')


def test_ocr_pdf_uses_the_dedicated_provider_endpoint(tmp_path, monkeypatch):
    pdf = tmp_path / 'proposal.pdf'
    pdf.write_bytes(b'%PDF-1.7\nproposal')
    monkeypatch.setattr(review_ai, 'get_settings', lambda: SimpleNamespace(
        openai_api_key='secret',
        openai_base_url='https://api.avalai.ir/v1/',
        iota_ocr_model='mistral-ocr-latest',
    ))
    captured = {}

    def fake_urlopen(request, timeout):
        captured['url'] = request.full_url
        captured['headers'] = dict(request.header_items())
        captured['body'] = json.loads(request.data.decode('utf-8'))
        captured['timeout'] = timeout
        return _Response()

    monkeypatch.setattr(review_ai, 'urlopen', fake_urlopen)
    result = review_ai.ocr_pdf(pdf, pages=[0])

    assert captured['url'] == 'https://api.avalai.ir/v1/ocr'
    assert captured['headers']['Authorization'] == 'Bearer secret'
    assert captured['timeout'] == 300
    assert captured['body'] == {
        'model': 'mistral-ocr-latest',
        'document': {
            'type': 'document_url',
            'document_url': 'data:application/pdf;base64,' + base64.b64encode(pdf.read_bytes()).decode('ascii'),
        },
        'pages': [0],
        'include_image_base64': False,
    }
    assert result['pages'][0]['markdown'] == 'متن طرح'


def test_ocr_pdf_retries_rate_limit_without_restarting_the_node(tmp_path, monkeypatch):
    pdf = tmp_path / 'proposal.pdf'
    pdf.write_bytes(b'%PDF-1.7\nproposal')
    monkeypatch.setattr(review_ai, 'get_settings', lambda: SimpleNamespace(
        openai_api_key='secret', openai_base_url='https://api.avalai.ir/v1/',
        iota_ocr_model='mistral-ocr-latest', iota_ocr_request_attempts=4,
        iota_ocr_retry_base_seconds=15,
    ))
    headers = Message()
    headers['Retry-After'] = '37'
    responses = [
        HTTPError('https://api.avalai.ir/v1/ocr', 429, 'rate limited', headers, BytesIO(b'{}')),
        _Response(),
    ]
    sleeps = []
    def fake_urlopen(*_args, **_kwargs):
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(review_ai, 'urlopen', fake_urlopen)
    monkeypatch.setattr(review_ai.time, 'sleep', sleeps.append)

    result = review_ai.ocr_pdf(pdf, pages=[0])

    assert result['pages'][0]['markdown'] == 'متن طرح'
    assert sleeps == [37.0]


def test_ask_json_retries_empty_content_and_accepts_wrapped_json(monkeypatch):
    responses = ['', '```json\n{"fields": {}, "evidence": {}}\n```']
    calls = []

    class _Client:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=self)

        def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=responses.pop(0)))])

    openai = ModuleType('openai')
    for name in ('APIConnectionError', 'APITimeoutError', 'APIStatusError', 'AuthenticationError', 'RateLimitError', 'BadRequestError'):
        setattr(openai, name, type(name, (Exception,), {}))
    openai.OpenAI = _Client
    monkeypatch.setitem(sys.modules, 'openai', openai)
    monkeypatch.setattr(review_ai, 'get_settings', lambda: SimpleNamespace(
        openai_api_key='secret', openai_base_url='https://api.avalai.ir/v1',
    ))

    result = review_ai.ask_json(model='deepseek-v4-flash', system='Return JSON.', user='Extract values.')

    assert result == {'fields': {}, 'evidence': {}}
    assert len(calls) == 2
    assert 'Return only one valid JSON object' in calls[0]['messages'][0]['content']
    assert 'previous output was not valid JSON' in calls[1]['messages'][0]['content']

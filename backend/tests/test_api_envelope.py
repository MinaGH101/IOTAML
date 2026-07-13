from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import NotFoundError
from app.core.http import ApiEnvelopeMiddleware, install_exception_handlers


def make_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(ApiEnvelopeMiddleware)
    install_exception_handlers(app)

    @app.get('/api/example')
    def example():
        return {'value': 42}

    @app.get('/api/missing')
    def missing():
        raise NotFoundError('EXAMPLE_NOT_FOUND', 'Example not found.')

    return app


def test_success_response_is_enveloped() -> None:
    response = TestClient(make_app()).get('/api/example')
    payload = response.json()
    assert response.status_code == 200
    assert payload['success'] is True
    assert payload['data'] == {'value': 42}
    assert payload['request_id']
    assert response.headers['X-Request-ID'] == payload['request_id']


def test_application_error_has_stable_contract() -> None:
    response = TestClient(make_app()).get('/api/missing')
    payload = response.json()
    assert response.status_code == 404
    assert payload['success'] is False
    assert payload['error']['code'] == 'EXAMPLE_NOT_FOUND'
    assert payload['error']['message'] == 'Example not found.'

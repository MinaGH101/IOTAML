"""Regression and contract tests for assistant optional."""

from app.domains.assistant.service import AssistantService


def test_assistant_does_not_require_credentials_during_startup() -> None:
    service = AssistantService(api_key="")

    assert service.is_configured is False


def test_assistant_accepts_injected_client_without_credentials() -> None:
    client = object()
    service = AssistantService(api_key="", client=client)  # type: ignore[arg-type]

    assert service.is_configured is True
    assert service._require_client() is client

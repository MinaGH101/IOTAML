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


def test_assistant_uses_configured_base_url() -> None:
    service = AssistantService(
        api_key="test-key",
        base_url="https://example.invalid/v1",
    )

    assert service.base_url == "https://example.invalid/v1"


def test_assistant_defaults_to_openai_base_url(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    service = AssistantService(api_key="test-key")

    assert service.base_url == "https://api.openai.com/v1"

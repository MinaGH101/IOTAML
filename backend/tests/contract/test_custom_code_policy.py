import pytest

from app.core.config import get_settings
from app.core.errors import ValidationAppError
from app.nodes.utilities.python_code_node import PythonCodeNode


def test_python_code_node_is_disabled_by_default(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "allow_custom_code", False)
    with pytest.raises(ValidationAppError) as exc:
        PythonCodeNode().run({"id": "code"}, {}, {"code": "return 1"}, None)
    assert exc.value.code == "CUSTOM_CODE_DISABLED"

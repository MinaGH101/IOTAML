from __future__ import annotations

import pytest

from app.nodes.utilities.python_code_node import _run_code


def test_python_code_node_runs_in_isolated_interpreter() -> None:
    result = _run_code('return {"ok": True}', None, timeout=5, memory_mb=256)
    assert result['result'] == {'ok': True}


def test_python_code_node_blocks_network() -> None:
    with pytest.raises(RuntimeError, match='Network access is disabled'):
        _run_code(
            'import urllib.request\nreturn urllib.request.urlopen("http://example.com", timeout=1).read()',
            None,
            timeout=5,
            memory_mb=256,
        )


def test_python_code_node_timeout() -> None:
    with pytest.raises(Exception):
        _run_code('while True:\n    pass', None, timeout=1, memory_mb=256)

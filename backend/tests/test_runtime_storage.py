from __future__ import annotations

from app.services import storage


def test_runtime_storage_writability_probe_cleans_up(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))
    storage.ensure_storage_writable()
    assert list(tmp_path.glob(".iota-write-probe-*")) == []

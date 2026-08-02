"""Regression and contract tests for migrations."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.database import Base
from app.core.config import get_settings
from app.core import model_registry  # noqa: F401


def alembic_config(database_url: str) -> Config:
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_fresh_database_reaches_head_with_model_table_parity(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'fresh.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    command.upgrade(alembic_config(database_url), "head")
    engine = create_engine(database_url)
    inspector = inspect(engine)
    actual = set(inspector.get_table_names()) - {"alembic_version"}
    assert actual == set(Base.metadata.tables)
    for table_name, model_table in Base.metadata.tables.items():
        assert {column["name"] for column in inspector.get_columns(table_name)} == set(model_table.columns.keys())
        actual_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        expected_indexes = {index.name for index in model_table.indexes if index.name}
        assert expected_indexes.issubset(actual_indexes), table_name
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260802_0007"


def test_legacy_0005_database_migrates_without_losing_rows(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'legacy-0005.db'}"
    config = alembic_config(database_url)
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    command.upgrade(config, "20260724_0005")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO projects (id, name, description, owner_username) "
            "VALUES (1, 'legacy project', '', 'legacy-owner')"
        ))
        connection.execute(text(
            "INSERT INTO artifacts (id, project_id, owner_username, artifact_type, storage_backend, object_key, "
            "original_filename, logical_name, content_type, size_bytes, checksum_sha256, status) "
            "VALUES (1, 1, 'legacy-owner', 'dataset', 'local', 'legacy/object.csv', 'object.csv', "
            "'object.csv', 'text/csv', 12, :checksum, 'available')"
        ), {"checksum": "0" * 64})
        connection.execute(text(
            "INSERT INTO datasets (id, name, filename, path, columns, row_count, project_id, artifact_id, size_bytes) "
            "VALUES (1, 'legacy dataset', 'object.csv', 'legacy/object.csv', :columns, 1, 1, 1, 12)"
        ), {"columns": '["id","value"]'})
        connection.execute(text(
            "INSERT INTO workflows (id, name, graph, project_id, owner_username, revision, graph_hash) "
            "VALUES (1, 'legacy workflow', :graph, 1, 'legacy-owner', 3, 'legacy-hash')"
        ), {"graph": '{"nodes":[],"edges":[]}'})
        connection.execute(text(
            "INSERT INTO runs (id, status, workflow_name, workflow_graph, workflow_id, workflow_revision, "
            "dataset_id, project_id, owner_username) VALUES (1, 'succeeded', 'legacy run', "
            ":graph, 1, 3, 1, 1, 'legacy-owner')"
        ), {"graph": '{"nodes":[],"edges":[]}'})

    command.upgrade(config, "head")
    command.upgrade(config, "head")

    inspector = inspect(engine)
    assert "users" in inspector.get_table_names()
    assert "run_attempts" in inspector.get_table_names()
    assert "run_events" in inspector.get_table_names()
    assert "artifact_quota_reservations" in inspector.get_table_names()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM projects WHERE id = 1")).scalar_one() == "legacy project"
        dataset = connection.execute(text("SELECT name, owner_username, id_column FROM datasets WHERE id = 1")).one()
        assert dataset.name == "legacy dataset"
        assert dataset.owner_username == "legacy-owner"
        assert dataset.id_column is None
        assert connection.execute(text("SELECT name FROM workflows WHERE id = 1")).scalar_one() == "legacy workflow"
        assert connection.execute(text("SELECT workflow_name FROM runs WHERE id = 1")).scalar_one() == "legacy run"
        assert connection.execute(text("SELECT original_filename FROM artifacts WHERE id = 1")).scalar_one() == "object.csv"
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260802_0007"

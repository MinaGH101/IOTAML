from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.database import Base
from app.config import get_settings
from app import models  # noqa: F401
from app.domains.artifacts import models as artifact_models  # noqa: F401


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
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260724_0005"


def test_legacy_database_migrates_without_losing_rows(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'legacy.db'}"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE projects (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL, "
            "description TEXT NOT NULL DEFAULT '', start_date VARCHAR(32), due_date VARCHAR(32), "
            "project_manager VARCHAR(255) NOT NULL DEFAULT '', state VARCHAR(32) NOT NULL DEFAULT 'open', "
            "owner_username VARCHAR(255) NOT NULL DEFAULT 'admin', "
            "created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"
        ))
        connection.execute(text(
            "INSERT INTO projects (id, name, description, owner_username, created_at, updated_at) "
            "VALUES (1, 'legacy', '', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))
        # The baseline must preserve this table and bootstrap every missing table.
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    command.upgrade(alembic_config(database_url), "head")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM projects WHERE id = 1")).scalar_one() == "legacy"
        project_columns = {column["name"] for column in inspect(engine).get_columns("projects")}
        assert {"priority", "color"}.issubset(project_columns)

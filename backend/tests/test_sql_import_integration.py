"""Optional live PostgreSQL connector test; owns and removes one temporary schema."""
import os
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pandas as pd
import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, insert
from sqlalchemy.schema import CreateSchema, DropSchema

from app.core.config import get_settings
from app.core.errors import ValidationAppError
from app.domains.datasets import sql_import


@pytest.mark.skipif(not os.getenv('TEST_SQL_DATABASE_URL'), reason='Set TEST_SQL_DATABASE_URL for a live PostgreSQL connector test.')
def test_postgresql_snapshot_and_row_limit(monkeypatch):
    url = os.environ['TEST_SQL_DATABASE_URL']
    engine = create_engine(url)
    schema = 'iota_import_test_' + uuid4().hex
    metadata = MetaData(schema=schema)
    table = Table('measurements', metadata, Column('id', Integer, primary_key=True), Column('batch', String), Column('value', Integer))
    user = SimpleNamespace(username='sql-import-test', role='expert')
    captured = []
    def upload(_db, *, upload, **_kwargs):
        result = pd.read_csv(BytesIO(upload.file.read()))
        captured.append(result)
        return result
    monkeypatch.setattr(sql_import, 'upload_dataset', upload)
    monkeypatch.setattr(get_settings(), 'sql_import_sources', {'laboratory': {
        'url': url, 'tables': [f'{schema}.measurements'], 'users': [user.username],
    }})
    created = False
    try:
        with engine.begin() as connection:
            connection.execute(CreateSchema(schema))
            created = True
            metadata.create_all(connection)
            connection.execute(insert(table), [{'id': 2, 'batch': 'B', 'value': 20}, {'id': 1, 'batch': 'A', 'value': 10}])
        result = sql_import.import_sql_table(None, user=user, source='laboratory', table_name=f'{schema}.measurements', project_id=1, owner_username=user.username, limit=2)
        assert result.id.tolist() == [1, 2]
        assert result.value.tolist() == [10, 20]
        with pytest.raises(ValidationAppError) as error:
            sql_import.import_sql_table(None, user=user, source='laboratory', table_name=f'{schema}.measurements', project_id=1, owner_username=user.username, limit=1)
        assert error.value.code == 'SQL_IMPORT_LIMIT'
        assert len(captured) == 1  # Oversize imports never publish a partial snapshot.
    finally:
        if created:
            with engine.begin() as connection:
                connection.execute(DropSchema(schema, cascade=True))
        engine.dispose()

"""Read-only snapshots from installer-approved PostgreSQL tables."""
from tempfile import SpooledTemporaryFile

import pandas as pd
from fastapi import UploadFile
from starlette.datastructures import Headers
from sqlalchemy import MetaData, Table, create_engine, select, text
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.core.errors import ValidationAppError
from app.domains.datasets.service import upload_dataset


def available_sources(user):
    sources = get_settings().sql_import_sources
    # Grant access explicitly per account; administrators can use every source.
    return {name: spec for name, spec in sources.items()
            if user.role == 'admin' or user.username in spec.get('users', [])}


def import_sql_table(db, *, user, source, table_name, project_id, owner_username, limit):
    spec = available_sources(user).get(source)
    if not spec or table_name not in spec.get('tables', []):
        raise ValidationAppError('SQL_SOURCE_FORBIDDEN', 'This SQL source or table is unavailable.')
    maximum = get_settings().sql_import_max_rows
    if not 1 <= limit <= maximum:
        raise ValidationAppError('SQL_IMPORT_LIMIT', f'Row limit must be between 1 and {maximum}.')
    engine = None
    try:
        url = make_url(spec['url'])
        if url.drivername not in {'postgresql', 'postgresql+psycopg2'}:
            raise ValueError('Only PostgreSQL sources are supported.')
        engine = create_engine(url, connect_args={'connect_timeout': 5}, pool_pre_ping=True)
        parts = table_name.split('.', 1)
        schema, name = parts if len(parts) == 2 else ('public', parts[0])
        with engine.connect() as connection, connection.begin():
            connection.execute(text('SET TRANSACTION READ ONLY'))
            connection.execute(text("SET LOCAL statement_timeout = '30s'"))
            table = Table(name, MetaData(), schema=schema, autoload_with=connection)
            query = select(table).limit(limit + 1)
            if list(table.primary_key.columns):
                query = query.order_by(*table.primary_key.columns)
            result = connection.execution_options(stream_results=True).execute(query)
            with SpooledTemporaryFile(max_size=2 * 1024 * 1024, mode='w+b') as file:
                count = 0
                first = True
                while rows := result.fetchmany(1000):
                    count += len(rows)
                    if count > limit:
                        raise ValidationAppError('SQL_IMPORT_LIMIT', 'Table exceeds the row limit. Use a smaller source view or increase the limit.')
                    chunk = pd.DataFrame.from_records(rows, columns=list(result.keys()))
                    file.write(chunk.to_csv(index=False, header=first).encode('utf-8'))
                    first = False
                    if file.tell() > 50 * 1024 * 1024:
                        raise ValidationAppError('SQL_IMPORT_LIMIT', 'SQL snapshot exceeds 50 MiB. Use a smaller source view.')
                if first:
                    raise ValidationAppError('SQL_IMPORT_EMPTY', 'The selected table has no rows.')
                file.seek(0)
                upload = UploadFile(file=file, filename=f'{source}-{name}.csv', headers=Headers({'content-type': 'text/csv'}))
                return upload_dataset(db, upload=upload, project_id=project_id, owner_username=owner_username)
    except ValidationAppError:
        raise
    except Exception:
        # Drivers can include connection credentials and SQL in exception text.
        raise ValidationAppError('SQL_IMPORT_FAILED', 'Could not read the approved SQL table. Check connection settings and read permissions.') from None
    finally:
        if engine is not None:
            engine.dispose()

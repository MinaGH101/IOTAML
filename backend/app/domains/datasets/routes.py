"""Dataset routes with project-level authorization."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.datasets.repository import dataset_repository
from app.domains.datasets.schemas import DatasetOut, SqlImportRequest
from app.domains.datasets.sql_import import available_sources, import_sql_table
from app.domains.datasets.service import delete_dataset, get_dataset, read_dataset, upload_dataset
from app.domains.projects.access import require_project_edit, require_project_view

router = APIRouter(prefix='/datasets', tags=['datasets'])


@router.get('/sql-sources')
def sql_sources(current_user: User = Depends(get_current_user_model)):
    return [{'name': name, 'tables': spec.get('tables', [])} for name, spec in available_sources(current_user).items()]


@router.post('/sql-import', response_model=DatasetOut)
def sql_import_route(payload: SqlImportRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model),
                     _: None = Depends(rate_limit('sql_import', limit=5))):
    project, _ = require_project_edit(db, payload.project_id, current_user)
    return import_sql_table(db, user=current_user, source=payload.source, table_name=payload.table,
                            project_id=project.id, owner_username=project.owner_username, limit=payload.limit)


def _dataset_and_owner(db: Session, dataset_id: int, user: User, *, write: bool = False):
    dataset = dataset_repository.get(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail='Dataset not found.')
    if dataset.project_id is None:
        if dataset.owner_username.lower() != user.username.lower():
            raise HTTPException(status_code=404, detail='Dataset not found.')
    elif write:
        require_project_edit(db, dataset.project_id, user)
    else:
        require_project_view(db, dataset.project_id, user)
    return dataset, dataset.owner_username


@router.post('/upload', response_model=DatasetOut)
def upload_dataset_route(
    file: UploadFile = File(...), project_id: int | None = Form(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model),
    _: None = Depends(rate_limit('dataset_upload', limit=get_settings().upload_rate_limit_per_minute)),
):
    owner = current_user.username
    if project_id is not None:
        project, _ = require_project_edit(db, project_id, current_user)
        owner = project.owner_username
    return upload_dataset(db, upload=file, project_id=project_id, owner_username=owner)


@router.get('', response_model=list[DatasetOut])
def list_datasets(project_id: int | None = None, limit: int = Query(default=50, ge=1), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    owner = current_user.username
    if project_id is not None:
        project, _ = require_project_view(db, project_id, current_user)
        owner = project.owner_username
    return dataset_repository.list(db, owner, project_id, limit=min(limit, get_settings().api_max_page_size), offset=offset)


@router.get('/{dataset_id}/preview')
def preview_dataset(dataset_id: int, limit: int = Query(default=25, ge=1), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    settings = get_settings()
    dataset, _ = _dataset_and_owner(db, dataset_id, current_user)
    frame = read_dataset(db, dataset, max_rows=min(limit, settings.upload_preview_max_rows))
    frame = frame.iloc[:, : settings.upload_preview_max_columns]
    return {'columns': [item for item in dataset.columns if item.get('name') in frame.columns], 'rows': frame.where(frame.notna(), None).to_dict(orient='records'), 'rows_total': dataset.row_count, 'columns_total': len(dataset.columns)}


@router.delete('/{dataset_id}')
def delete_dataset_route(dataset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _dataset_and_owner(db, dataset_id, current_user, write=True)
    delete_dataset(db, dataset_id, owner)
    return {'ok': True}

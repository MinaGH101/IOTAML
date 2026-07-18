from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.config import get_settings
from app.core.http import ApiEnvelopeMiddleware, install_exception_handlers
from app.core.openapi import install_openapi
from app.database import Base, SessionLocal, engine
from app.domains.artifacts import models as artifact_models  # noqa: F401
from app.domains.artifacts.routes import router as artifacts_router
from app.domains.components.routes import router as components_router
from app.domains.auth.routes import router as auth_router
from app.domains.datasets.routes import router as datasets_router
from app.domains.nodes.routes import router as nodes_router
from app.domains.projects.routes import router as projects_router
from app.domains.runs.routes import router as runs_router
from app.domains.workflows.routes import router as workflows_router
from app.domains.assistant.router import router as assistant_router

from app.infrastructure.storage import get_storage_backend
from app.services.run_queue import queue_metrics
from app.services.storage import ensure_dirs
from app.services.users import ensure_user_file


settings = get_settings()

app = FastAPI(title="No-Code ML Builder API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ApiEnvelopeMiddleware)
install_exception_handlers(app)
install_openapi(app)


def ensure_runtime_schema() -> None:
    """Compatibility guard for older local databases.

    Alembic remains the source of truth. This only adds small nullable/default
    columns needed to keep a developer database bootable before a manual reset.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in ("datasets", "workflows", "runs"):
            if table not in tables:
                continue
            columns = {column["name"] for column in inspector.get_columns(table)}
            if "project_id" not in columns:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN project_id INTEGER NULL"))
        if "datasets" in tables:
            columns = {column["name"] for column in inspector.get_columns("datasets")}
            additions = {
                "artifact_id": "INTEGER NULL",
                "content_type": "VARCHAR(255) NOT NULL DEFAULT 'text/csv'",
                "size_bytes": "INTEGER NOT NULL DEFAULT 0",
                "checksum_sha256": "VARCHAR(64) NULL",
            }
            for name, ddl in additions.items():
                if name not in columns:
                    conn.execute(text(f"ALTER TABLE datasets ADD COLUMN {name} {ddl}"))
        if "projects" in tables:
            columns = {column["name"] for column in inspector.get_columns("projects")}
            if "color" not in columns:
                conn.execute(text("ALTER TABLE projects ADD COLUMN color VARCHAR(32) NOT NULL DEFAULT '#31cde3'"))
            if "priority" not in columns:
                conn.execute(text("ALTER TABLE projects ADD COLUMN priority VARCHAR(32) NOT NULL DEFAULT 'medium'"))


@app.on_event("startup")
def startup() -> None:
    ensure_dirs()
    ensure_user_file()
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    get_storage_backend().ensure_ready()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/health/ready")
def readiness() -> dict:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    with SessionLocal() as db:
        queue = queue_metrics(db)
    storage = get_storage_backend().health()
    return {"status": "ready", "database": "ok", "queue": queue, "storage": storage}


# Legacy local media is retained only for current profile images. New datasets,
# outputs, reports, and models are stored through the artifact domain.
Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(Path(settings.storage_dir))), name="media")

for router in (
    auth_router,
    nodes_router,
    projects_router,
    datasets_router,
    workflows_router,
    runs_router,
    artifacts_router,
    components_router,
    assistant_router,
):
    app.include_router(router, prefix="/api")

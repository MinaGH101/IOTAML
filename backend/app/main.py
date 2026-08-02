"""IOTA ML FastAPI application composition root."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.core.http import ApiEnvelopeMiddleware, install_exception_handlers
from app.core.logging import configure_logging
from app.core.openapi import install_openapi
from app.domains.artifacts.routes import router as artifacts_router
from app.domains.components.routes import router as components_router
from app.domains.auth.routes import router as auth_router
from app.domains.datasets.routes import router as datasets_router
from app.domains.nodes.routes import router as nodes_router
from app.domains.projects.routes import router as projects_router
from app.domains.runs.routes import router as runs_router
from app.domains.workflows.routes import router as workflows_router
from app.domains.assistant.router import router as assistant_router
from app.domains.admin.routes import router as admin_router
from app.infrastructure.observability import render_prometheus
from app.infrastructure.storage import get_storage_backend
from app.infrastructure.storage.runtime import ensure_dirs, ensure_storage_writable
from app.domains.auth.service import bootstrap_users

settings = get_settings()
configure_logging()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.add_middleware(ApiEnvelopeMiddleware)
install_exception_handlers(app)
install_openapi(app)


@app.on_event('startup')
def startup() -> None:
    ensure_storage_writable()
    ensure_dirs()
    with SessionLocal() as db:
        bootstrap_users(db)
    get_storage_backend().ensure_ready()


@app.get('/health/live')
def liveness() -> dict:
    return {'status': 'live'}


@app.get('/health')
def legacy_health() -> dict:
    return {'status': 'ok'}


@app.get('/health/ready')
def readiness() -> dict:
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
    storage = get_storage_backend().health()
    redis_status = 'optional'
    if settings.redis_required_for_readiness:
        from redis import Redis

        client = Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=settings.redis_connect_timeout_seconds,
            socket_timeout=settings.redis_connect_timeout_seconds,
        )
        if not client.ping():
            raise RuntimeError('Redis readiness check failed.')
        redis_status = 'ok'
    return {'status': 'ready', 'database': 'ok', 'storage': storage, 'redis': redis_status}


@app.get('/metrics', response_class=PlainTextResponse, include_in_schema=False)
def metrics() -> str:
    return render_prometheus() if settings.metrics_enabled else ''


# Only profile images are exposed as static media. Artifact objects, caches,
# runtime snapshots, and uploaded datasets require authenticated routes.
profile_dir = Path(settings.storage_dir) / 'profile-images'
profile_dir.mkdir(parents=True, exist_ok=True)
app.mount('/media/profile-images', StaticFiles(directory=str(profile_dir)), name='profile-images')

for router in (
    auth_router, nodes_router, projects_router, datasets_router, workflows_router,
    runs_router, artifacts_router, components_router, assistant_router, admin_router,
):
    app.include_router(router, prefix='/api')

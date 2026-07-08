from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes_auth import router as auth_router
from app.api.routes_datasets import router as datasets_router
from app.api.routes_nodes import router as nodes_router
from app.api.routes_projects import router as projects_router
from app.api.routes_runs import router as runs_router
from app.api.routes_workflows import router as workflows_router
from app.config import get_settings
from app.database import Base, engine
from app.services.storage import ensure_dirs
from app.services.users import ensure_user_file

settings = get_settings()

app = FastAPI(title="No-Code ML Builder API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



def ensure_runtime_schema() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in ("datasets", "workflows", "runs"):
            if table not in tables:
                continue
            columns = {column["name"] for column in inspector.get_columns(table)}
            if "project_id" not in columns:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN project_id INTEGER NULL"))
        if "projects" in tables:
            project_columns = {column["name"] for column in inspector.get_columns("projects")}
            if "color" not in project_columns:
                conn.execute(text("ALTER TABLE projects ADD COLUMN color VARCHAR(32) NOT NULL DEFAULT '#31cde3'"))
            if "priority" not in project_columns:
                conn.execute(text("ALTER TABLE projects ADD COLUMN priority VARCHAR(32) NOT NULL DEFAULT 'medium'"))


@app.on_event("startup")
def startup() -> None:
    ensure_dirs()
    ensure_user_file()
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.mount("/media", StaticFiles(directory=str(Path(settings.storage_dir))), name="media")

app.include_router(auth_router, prefix="/api")
app.include_router(nodes_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(datasets_router, prefix="/api")
app.include_router(workflows_router, prefix="/api")
app.include_router(runs_router, prefix="/api")

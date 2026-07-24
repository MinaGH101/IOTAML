"""Create the application baseline and reliable run queue.

Revision ID: 20260712_0001
Revises:
Create Date: 2026-07-12

This revision is deliberately able to bootstrap an empty database and to
upgrade the pre-Alembic local schema.  Later revisions add artifacts, cache
metadata, versions, and reusable components.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260712_0001"
down_revision = None
branch_labels = None
depends_on = None


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(inspector: sa.Inspector, table: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table) if index.get("name")}


def _unique_constraints(inspector: sa.Inspector, table: str) -> set[str]:
    return {item["name"] for item in inspector.get_unique_constraints(table) if item.get("name")}


def _create_baseline_tables() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "projects" not in tables:
        op.create_table(
            "projects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("start_date", sa.String(32), nullable=True),
            sa.Column("due_date", sa.String(32), nullable=True),
            sa.Column("project_manager", sa.String(255), nullable=False, server_default=""),
            sa.Column("state", sa.String(32), nullable=False, server_default="open"),
            sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
            sa.Column("color", sa.String(32), nullable=False, server_default="#31cde3"),
            sa.Column("owner_username", sa.String(255), nullable=False, server_default="admin"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if "datasets" not in tables:
        op.create_table(
            "datasets",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("filename", sa.String(255), nullable=False),
            sa.Column("path", sa.Text(), nullable=False),
            sa.Column("columns", sa.JSON(), nullable=False),
            sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if "workflows" not in tables:
        op.create_table(
            "workflows",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("graph", sa.JSON(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if "runs" not in tables:
        op.create_table(
            "runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
            sa.Column("workflow_name", sa.String(255), nullable=False, server_default="Untitled Run"),
            sa.Column("workflow_graph", sa.JSON(), nullable=False),
            sa.Column("dataset_id", sa.Integer(), nullable=True),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("owner_username", sa.String(255), nullable=False, server_default="admin"),
            sa.Column("target_column", sa.String(255), nullable=True),
            sa.Column("task_type", sa.String(32), nullable=False, server_default="auto"),
            sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="7200"),
            sa.Column("idempotency_key", sa.String(128), nullable=True),
            sa.Column("next_attempt_at", sa.DateTime(), nullable=True),
            sa.Column("locked_by", sa.String(255), nullable=True),
            sa.Column("locked_at", sa.DateTime(), nullable=True),
            sa.Column("heartbeat_at", sa.DateTime(), nullable=True),
            sa.Column("process_pid", sa.Integer(), nullable=True),
            sa.Column("worker_exit_code", sa.Integer(), nullable=True),
            sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("progress", sa.JSON(), nullable=True),
            sa.Column("node_statuses", sa.JSON(), nullable=True),
            sa.Column("logs", sa.JSON(), nullable=True),
            sa.Column("metrics", sa.JSON(), nullable=True),
            sa.Column("artifacts", sa.JSON(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("queued_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("owner_username", "idempotency_key", name="uq_runs_owner_idempotency"),
        )
    if "custom_nodes" not in tables:
        op.create_table(
            "custom_nodes",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("owner_username", sa.String(255), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("inputs", sa.JSON(), nullable=False),
            sa.Column("outputs", sa.JSON(), nullable=False),
            sa.Column("code", sa.Text(), nullable=False),
            sa.Column("template", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def upgrade() -> None:
    _create_baseline_tables()
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    legacy_additions: dict[str, dict[str, sa.Column]] = {
        "projects": {
            "priority": sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
            "color": sa.Column("color", sa.String(32), nullable=False, server_default="#31cde3"),
        },
        "datasets": {"project_id": sa.Column("project_id", sa.Integer(), nullable=True)},
        "workflows": {"project_id": sa.Column("project_id", sa.Integer(), nullable=True)},
        "runs": {
            "project_id": sa.Column("project_id", sa.Integer(), nullable=True),
            "owner_username": sa.Column("owner_username", sa.String(255), nullable=False, server_default="admin"),
            "priority": sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
            "attempts": sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            "max_attempts": sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
            "timeout_seconds": sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="7200"),
            "idempotency_key": sa.Column("idempotency_key", sa.String(128), nullable=True),
            "next_attempt_at": sa.Column("next_attempt_at", sa.DateTime(), nullable=True),
            "locked_by": sa.Column("locked_by", sa.String(255), nullable=True),
            "locked_at": sa.Column("locked_at", sa.DateTime(), nullable=True),
            "heartbeat_at": sa.Column("heartbeat_at", sa.DateTime(), nullable=True),
            "process_pid": sa.Column("process_pid", sa.Integer(), nullable=True),
            "worker_exit_code": sa.Column("worker_exit_code", sa.Integer(), nullable=True),
            "cancel_requested": sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
            "progress": sa.Column("progress", sa.JSON(), nullable=True),
            "node_statuses": sa.Column("node_statuses", sa.JSON(), nullable=True),
            "logs": sa.Column("logs", sa.JSON(), nullable=True),
            "queued_at": sa.Column("queued_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        },
    }
    for table, additions in legacy_additions.items():
        existing = _columns(sa.inspect(bind), table)
        for name, column in additions.items():
            if name not in existing:
                op.add_column(table, column)

    index_specs = {
        "projects": {"ix_projects_id": ["id"]},
        "datasets": {"ix_datasets_id": ["id"], "ix_datasets_project_id": ["project_id"]},
        "workflows": {"ix_workflows_id": ["id"], "ix_workflows_project_id": ["project_id"]},
        "custom_nodes": {
            "ix_custom_nodes_id": ["id"],
            "ix_custom_nodes_owner_username": ["owner_username"],
        },
        "runs": {
            "ix_runs_id": ["id"],
            "ix_runs_status": ["status"],
            "ix_runs_project_id": ["project_id"],
            "ix_runs_owner_username": ["owner_username"],
            "ix_runs_idempotency_key": ["idempotency_key"],
            "ix_runs_next_attempt_at": ["next_attempt_at"],
            "ix_runs_locked_by": ["locked_by"],
            "ix_runs_heartbeat_at": ["heartbeat_at"],
            "ix_runs_queue_claim": ["status", "priority", "next_attempt_at", "created_at"],
            "ix_runs_owner_status": ["owner_username", "status"],
            "ix_runs_project_status": ["project_id", "status"],
        },
    }
    for table, specs in index_specs.items():
        existing = _indexes(sa.inspect(bind), table)
        for name, columns in specs.items():
            if name not in existing:
                op.create_index(name, table, columns)
    inspector = sa.inspect(bind)
    if (
        "uq_runs_owner_idempotency" not in _indexes(inspector, "runs")
        and "uq_runs_owner_idempotency" not in _unique_constraints(inspector, "runs")
    ):
        op.create_index("uq_runs_owner_idempotency", "runs", ["owner_username", "idempotency_key"], unique=True)


def downgrade() -> None:
    for table in ("custom_nodes", "runs", "workflows", "datasets", "projects"):
        if table in sa.inspect(op.get_bind()).get_table_names():
            op.drop_table(table)

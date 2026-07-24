"""Converge databases previously maintained by startup-time DDL.

Revision ID: 20260724_0005
Revises: 20260716_0004
Create Date: 2026-07-24
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260724_0005"
down_revision = "20260716_0004"
branch_labels = None
depends_on = None


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(inspector: sa.Inspector, table: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table) if index.get("name")}


def _add_missing_columns(table: str, additions: dict[str, sa.Column]) -> None:
    existing = _columns(sa.inspect(op.get_bind()), table)
    for name, column in additions.items():
        if name not in existing:
            op.add_column(table, column)


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    required = {"projects", "datasets", "workflows", "runs", "custom_nodes"}
    missing = sorted(required - tables)
    if missing:
        raise RuntimeError(
            "Legacy schema is missing base tables: "
            + ", ".join(missing)
            + ". Restore the database backup before migrating."
        )

    _add_missing_columns("projects", {
        "priority": sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
        "color": sa.Column("color", sa.String(32), nullable=False, server_default="#31cde3"),
    })
    for table in ("datasets", "workflows", "runs"):
        _add_missing_columns(table, {"project_id": sa.Column("project_id", sa.Integer(), nullable=True)})

    index_specs = {
        "projects": {"ix_projects_id": ["id"]},
        "datasets": {
            "ix_datasets_id": ["id"],
            "ix_datasets_project_id": ["project_id"],
            "ix_datasets_artifact_id": ["artifact_id"],
            "ix_datasets_checksum_sha256": ["checksum_sha256"],
        },
        "workflows": {
            "ix_workflows_id": ["id"],
            "ix_workflows_project_id": ["project_id"],
            "ix_workflows_owner_username": ["owner_username"],
            "ix_workflows_graph_hash": ["graph_hash"],
            "ix_workflows_last_run_id": ["last_run_id"],
            "ix_workflows_owner_project_updated": ["owner_username", "project_id", "updated_at"],
        },
        "runs": {
            "ix_runs_id": ["id"],
            "ix_runs_status": ["status"],
            "ix_runs_project_id": ["project_id"],
            "ix_runs_owner_username": ["owner_username"],
            "ix_runs_workflow_id": ["workflow_id"],
            "ix_runs_idempotency_key": ["idempotency_key"],
            "ix_runs_next_attempt_at": ["next_attempt_at"],
            "ix_runs_locked_by": ["locked_by"],
            "ix_runs_heartbeat_at": ["heartbeat_at"],
            "ix_runs_queue_claim": ["status", "priority", "next_attempt_at", "created_at"],
            "ix_runs_owner_status": ["owner_username", "status"],
            "ix_runs_project_status": ["project_id", "status"],
            "ix_runs_workflow_created": ["workflow_id", "created_at"],
        },
        "custom_nodes": {
            "ix_custom_nodes_id": ["id"],
            "ix_custom_nodes_owner_username": ["owner_username"],
        },
        "artifacts": {
            "ix_artifacts_id": ["id"],
            "ix_artifacts_project_id": ["project_id"],
            "ix_artifacts_workflow_id": ["workflow_id"],
            "ix_artifacts_run_id": ["run_id"],
            "ix_artifacts_node_id": ["node_id"],
            "ix_artifacts_owner_username": ["owner_username"],
            "ix_artifacts_artifact_type": ["artifact_type"],
            "ix_artifacts_parent_artifact_id": ["parent_artifact_id"],
            "ix_artifacts_checksum_sha256": ["checksum_sha256"],
            "ix_artifacts_cache_key": ["cache_key"],
            "ix_artifacts_status": ["status"],
            "ix_artifacts_owner_status": ["owner_username", "status"],
            "ix_artifacts_project_type": ["project_id", "artifact_type"],
            "ix_artifacts_run_node": ["run_id", "node_id"],
            "ix_artifacts_expires_at": ["expires_at"],
            "ix_artifacts_version": ["owner_username", "project_id", "artifact_type", "logical_name", "version"],
        },
    }
    for table, specs in index_specs.items():
        existing = _indexes(sa.inspect(bind), table)
        for name, columns in specs.items():
            if name not in existing:
                op.create_index(name, table, columns)


def downgrade() -> None:
    # This migration only converges legacy schemas. Downgrading must not remove
    # columns or indexes that may predate Alembic.
    pass

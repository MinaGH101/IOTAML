"""Add node cache, artifact lineage, workflow drafts and named versions.

Revision ID: 20260716_0003
Revises: 20260712_0002
Create Date: 2026-07-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260716_0003"
down_revision = "20260712_0002"
branch_labels = None
depends_on = None


def _columns(inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(inspector, table: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table) if index.get("name")}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "workflows" in tables:
        existing = _columns(inspector, "workflows")
        additions = {
            "owner_username": sa.Column("owner_username", sa.String(length=255), nullable=False, server_default="admin"),
            "revision": sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
            "graph_hash": sa.Column("graph_hash", sa.String(length=64), nullable=False, server_default=""),
            "last_run_id": sa.Column("last_run_id", sa.Integer(), nullable=True),
            "last_autosaved_at": sa.Column("last_autosaved_at", sa.DateTime(), nullable=True),
        }
        for name, column in additions.items():
            if name not in existing:
                op.add_column("workflows", column)
        # Preserve ownership for existing workflows instead of assigning them to the migration default.
        if "projects" in tables:
            op.execute(sa.text(
                "UPDATE workflows SET owner_username = COALESCE("
                "(SELECT projects.owner_username FROM projects WHERE projects.id = workflows.project_id), "
                "workflows.owner_username)"
            ))
        existing_indexes = _indexes(sa.inspect(bind), "workflows")
        for name, columns in {
            "ix_workflows_owner_username": ["owner_username"],
            "ix_workflows_graph_hash": ["graph_hash"],
            "ix_workflows_last_run_id": ["last_run_id"],
            "ix_workflows_owner_project_updated": ["owner_username", "project_id", "updated_at"],
        }.items():
            if name not in existing_indexes:
                op.create_index(name, "workflows", columns)

    if "runs" in tables:
        existing = _columns(sa.inspect(bind), "runs")
        additions = {
            "workflow_id": sa.Column("workflow_id", sa.Integer(), nullable=True),
            "workflow_revision": sa.Column("workflow_revision", sa.Integer(), nullable=True),
            "bypass_cache": sa.Column("bypass_cache", sa.Boolean(), nullable=False, server_default=sa.false()),
        }
        for name, column in additions.items():
            if name not in existing:
                op.add_column("runs", column)
        existing_indexes = _indexes(sa.inspect(bind), "runs")
        for name, columns in {
            "ix_runs_workflow_id": ["workflow_id"],
            "ix_runs_workflow_created": ["workflow_id", "created_at"],
        }.items():
            if name not in existing_indexes:
                op.create_index(name, "runs", columns)

    if "artifacts" in tables:
        existing = _columns(sa.inspect(bind), "artifacts")
        additions = {
            "cache_key": sa.Column("cache_key", sa.String(length=64), nullable=True),
            "schema_json": sa.Column("schema_json", sa.JSON(), nullable=True),
            "metadata_json": sa.Column("metadata_json", sa.JSON(), nullable=True),
            "pinned": sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
            "last_accessed_at": sa.Column("last_accessed_at", sa.DateTime(), nullable=True),
        }
        for name, column in additions.items():
            if name not in existing:
                op.add_column("artifacts", column)
        existing_indexes = _indexes(sa.inspect(bind), "artifacts")
        if "ix_artifacts_cache_key" not in existing_indexes:
            op.create_index("ix_artifacts_cache_key", "artifacts", ["cache_key"])

    tables = set(sa.inspect(bind).get_table_names())
    if "workflow_versions" not in tables:
        op.create_table(
            "workflow_versions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("workflow_id", sa.Integer(), nullable=False),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("graph", sa.JSON(), nullable=False),
            sa.Column("graph_hash", sa.String(length=64), nullable=False),
            sa.Column("source_revision", sa.Integer(), nullable=False),
            sa.Column("run_id", sa.Integer(), nullable=True),
            sa.Column("owner_username", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("workflow_id", "version_number", name="uq_workflow_versions_number"),
        )
        op.create_index("ix_workflow_versions_id", "workflow_versions", ["id"])
        op.create_index("ix_workflow_versions_workflow_id", "workflow_versions", ["workflow_id"])
        op.create_index("ix_workflow_versions_graph_hash", "workflow_versions", ["graph_hash"])
        op.create_index("ix_workflow_versions_run_id", "workflow_versions", ["run_id"])
        op.create_index("ix_workflow_versions_owner_username", "workflow_versions", ["owner_username"])
        op.create_index("ix_workflow_versions_workflow_created", "workflow_versions", ["workflow_id", "created_at"])
        op.create_index("ix_workflow_versions_owner_workflow", "workflow_versions", ["owner_username", "workflow_id"])

    if "artifact_lineage" not in tables:
        op.create_table(
            "artifact_lineage",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("parent_artifact_id", sa.Integer(), nullable=False),
            sa.Column("child_artifact_id", sa.Integer(), nullable=False),
            sa.Column("input_name", sa.String(length=255), nullable=False, server_default="input"),
            sa.Column("source_node_id", sa.String(length=255), nullable=True),
            sa.Column("target_node_id", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("parent_artifact_id", "child_artifact_id", "input_name", name="uq_artifact_lineage_edge"),
        )
        op.create_index("ix_artifact_lineage_child", "artifact_lineage", ["child_artifact_id"])
        op.create_index("ix_artifact_lineage_parent", "artifact_lineage", ["parent_artifact_id"])

    if "node_cache_entries" not in tables:
        op.create_table(
            "node_cache_entries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_username", sa.String(length=255), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("workflow_id", sa.Integer(), nullable=True),
            sa.Column("source_run_id", sa.Integer(), nullable=True),
            sa.Column("node_id", sa.String(length=255), nullable=False),
            sa.Column("node_type", sa.String(length=128), nullable=False),
            sa.Column("node_version", sa.String(length=64), nullable=False),
            sa.Column("static_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("cache_key", sa.String(length=64), nullable=False),
            sa.Column("output_digest", sa.String(length=64), nullable=False),
            sa.Column("artifact_id", sa.Integer(), nullable=False),
            sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
            sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="available"),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("last_accessed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("owner_username", "project_id", "cache_key", name="uq_node_cache_scope_key"),
        )
        for name, columns in {
            "ix_node_cache_entries_id": ["id"],
            "ix_node_cache_entries_owner_username": ["owner_username"],
            "ix_node_cache_entries_project_id": ["project_id"],
            "ix_node_cache_entries_workflow_id": ["workflow_id"],
            "ix_node_cache_entries_source_run_id": ["source_run_id"],
            "ix_node_cache_entries_node_id": ["node_id"],
            "ix_node_cache_entries_node_type": ["node_type"],
            "ix_node_cache_entries_static_fingerprint": ["static_fingerprint"],
            "ix_node_cache_entries_cache_key": ["cache_key"],
            "ix_node_cache_entries_artifact_id": ["artifact_id"],
            "ix_node_cache_entries_status": ["status"],
            "ix_node_cache_lookup": ["owner_username", "project_id", "static_fingerprint", "status"],
            "ix_node_cache_lru": ["status", "pinned", "last_accessed_at"],
            "ix_node_cache_artifact": ["artifact_id"],
        }.items():
            op.create_index(name, "node_cache_entries", columns)

    if "node_executions" not in tables:
        op.create_table(
            "node_executions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("run_id", sa.Integer(), nullable=False),
            sa.Column("workflow_id", sa.Integer(), nullable=True),
            sa.Column("node_id", sa.String(length=255), nullable=False),
            sa.Column("node_type", sa.String(length=128), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("cache_key", sa.String(length=64), nullable=True),
            sa.Column("cache_hit", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("cache_entry_id", sa.Integer(), nullable=True),
            sa.Column("artifact_id", sa.Integer(), nullable=True),
            sa.Column("output_digest", sa.String(length=64), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("run_id", "node_id", name="uq_node_execution_run_node"),
        )
        op.create_index("ix_node_executions_id", "node_executions", ["id"])
        op.create_index("ix_node_executions_run", "node_executions", ["run_id"])
        op.create_index("ix_node_executions_cache", "node_executions", ["cache_key"])
        op.create_index("ix_node_executions_artifact", "node_executions", ["artifact_id"])
        op.create_index("ix_node_executions_workflow_id", "node_executions", ["workflow_id"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    for table in ("node_executions", "node_cache_entries", "artifact_lineage", "workflow_versions"):
        if table in tables:
            op.drop_table(table)

    inspector = sa.inspect(bind)
    if "artifacts" in inspector.get_table_names():
        indexes = _indexes(inspector, "artifacts")
        if "ix_artifacts_cache_key" in indexes:
            op.drop_index("ix_artifacts_cache_key", table_name="artifacts")
        existing = _columns(sa.inspect(bind), "artifacts")
        for name in ("last_accessed_at", "pinned", "metadata_json", "schema_json", "cache_key"):
            if name in existing:
                op.drop_column("artifacts", name)

    inspector = sa.inspect(bind)
    if "runs" in inspector.get_table_names():
        indexes = _indexes(inspector, "runs")
        for name in ("ix_runs_workflow_created", "ix_runs_workflow_id"):
            if name in indexes:
                op.drop_index(name, table_name="runs")
        existing = _columns(sa.inspect(bind), "runs")
        for name in ("bypass_cache", "workflow_revision", "workflow_id"):
            if name in existing:
                op.drop_column("runs", name)

    inspector = sa.inspect(bind)
    if "workflows" in inspector.get_table_names():
        indexes = _indexes(inspector, "workflows")
        for name in ("ix_workflows_owner_project_updated", "ix_workflows_last_run_id", "ix_workflows_graph_hash", "ix_workflows_owner_username"):
            if name in indexes:
                op.drop_index(name, table_name="workflows")
        existing = _columns(sa.inspect(bind), "workflows")
        for name in ("last_autosaved_at", "last_run_id", "graph_hash", "revision", "owner_username"):
            if name in existing:
                op.drop_column("workflows", name)

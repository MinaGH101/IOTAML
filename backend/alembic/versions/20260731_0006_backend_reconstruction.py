"""Consolidate backend ownership and add recoverability metadata.

Revision ID: 20260731_0006
Revises: 20260724_0005
Create Date: 2026-07-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260731_0006"
down_revision = "20260724_0005"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _indexes(table: str) -> set[str]:
    return {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table) if index.get("name")}


def _add_columns(table: str, additions: dict[str, sa.Column]) -> None:
    existing = _columns(table)
    for name, column in additions.items():
        if name not in existing:
            op.add_column(table, column)


def _add_indexes(table: str, specs: dict[str, list[str]]) -> None:
    existing = _indexes(table)
    for name, columns in specs.items():
        if name not in existing:
            op.create_index(name, table, columns)


def _postgres_fk(name: str, source: str, target: str, local: str, remote: str = "id", ondelete: str = "SET NULL") -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    inspector = sa.inspect(bind)
    if any(fk.get("name") == name for fk in inspector.get_foreign_keys(source)):
        return
    orphan_count = bind.execute(sa.text(
        f'SELECT COUNT(*) FROM "{source}" s LEFT JOIN "{target}" t ON s."{local}" = t."{remote}" '
        f'WHERE s."{local}" IS NOT NULL AND t."{remote}" IS NULL'
    )).scalar_one()
    if orphan_count:
        raise RuntimeError(
            f"Cannot add {name}: {orphan_count} orphan reference(s) exist in {source}.{local}. "
            "Repair or preserve those rows before rerunning the migration."
        )
    op.create_foreign_key(name, source, target, [local], [remote], ondelete=ondelete)


def upgrade() -> None:
    tables = _tables()
    required = {"projects", "datasets", "workflows", "runs", "custom_nodes", "artifacts"}
    missing = sorted(required - tables)
    if missing:
        raise RuntimeError("Schema is missing required tables: " + ", ".join(missing))

    _add_columns("datasets", {
        "owner_username": sa.Column("owner_username", sa.String(255), nullable=False, server_default="admin"),
        "id_column": sa.Column("id_column", sa.String(255), nullable=True),
    })
    # Preserve ownership where a dataset belongs to a known project.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text(
            "UPDATE datasets d SET owner_username = p.owner_username FROM projects p "
            "WHERE d.project_id = p.id AND (d.owner_username IS NULL OR d.owner_username = 'admin')"
        ))
    else:
        bind.execute(sa.text(
            "UPDATE datasets SET owner_username = COALESCE((SELECT owner_username FROM projects WHERE projects.id = datasets.project_id), owner_username, 'admin')"
        ))

    _add_columns("runs", {
        "selected_node_id": sa.Column("selected_node_id", sa.String(255), nullable=True),
        "failure_code": sa.Column("failure_code", sa.String(128), nullable=True),
        "failure_retryable": sa.Column("failure_retryable", sa.Boolean(), nullable=True),
        "dead_lettered_at": sa.Column("dead_lettered_at", sa.DateTime(), nullable=True),
    })
    _add_columns("custom_nodes", {
        "enabled": sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    })

    tables = _tables()
    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("username", sa.String(255), nullable=False),
            sa.Column("password_hash", sa.String(512), nullable=False),
            sa.Column("first_name", sa.String(255), nullable=False, server_default=""),
            sa.Column("last_name", sa.String(255), nullable=False, server_default=""),
            sa.Column("phone_number", sa.String(64), nullable=False, server_default=""),
            sa.Column("email", sa.String(320), nullable=False, server_default=""),
            sa.Column("access_level", sa.String(64), nullable=False, server_default="Viewer"),
            sa.Column("profile_image", sa.String(1024), nullable=False, server_default=""),
            sa.Column("title", sa.String(255), nullable=False, server_default=""),
            sa.Column("department", sa.String(255), nullable=False, server_default=""),
            sa.Column("activity", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("alarms", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("notifications", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("username", name="uq_users_username"),
        )
    if "run_attempts" not in tables:
        op.create_table(
            "run_attempts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("run_id", sa.Integer(), nullable=False),
            sa.Column("attempt_number", sa.Integer(), nullable=False),
            sa.Column("worker_id", sa.String(255), nullable=True),
            sa.Column("status", sa.String(32), nullable=False),
            sa.Column("error_code", sa.String(128), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("retryable", sa.Boolean(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("run_id", "attempt_number", name="uq_run_attempt_number"),
            sa.ForeignKeyConstraint(["run_id"], ["runs.id"], name="fk_run_attempts_run", ondelete="CASCADE"),
        )
    if "run_events" not in tables:
        op.create_table(
            "run_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("run_id", sa.Integer(), nullable=False),
            sa.Column("sequence", sa.Integer(), nullable=False),
            sa.Column("level", sa.String(16), nullable=False, server_default="info"),
            sa.Column("event_type", sa.String(64), nullable=False),
            sa.Column("node_id", sa.String(255), nullable=True),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("details", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["run_id"], ["runs.id"], name="fk_run_events_run", ondelete="CASCADE"),
        )
    if "artifact_quota_reservations" not in tables:
        op.create_table(
            "artifact_quota_reservations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("owner_username", sa.String(255), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("artifact_id", sa.Integer(), nullable=True),
            sa.Column("reserved_bytes", sa.BigInteger(), nullable=False),
            sa.Column("status", sa.String(32), nullable=False, server_default="active"),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("released_at", sa.DateTime(), nullable=True),
        )

    index_specs = {
        "users": {
            "ix_users_username": ["username"],
            "ix_users_active_username": ["is_active", "username"],
        },
        "projects": {
            "ix_projects_owner_username": ["owner_username"],
            "ix_projects_owner_updated": ["owner_username", "updated_at"],
        },
        "datasets": {
            "ix_datasets_owner_username": ["owner_username"],
        },
        "runs": {
            "ix_runs_dataset_id": ["dataset_id"],
            "ix_runs_failure_code": ["failure_code"],
        },
        "run_attempts": {
            "ix_run_attempts_run_id": ["run_id"],
            "ix_run_attempts_status_created": ["status", "created_at"],
        },
        "run_events": {
            "ix_run_events_run_id": ["run_id"],
            "ix_run_events_run_sequence": ["run_id", "sequence"],
        },
        "artifact_quota_reservations": {
            "ix_artifact_quota_reservations_owner_username": ["owner_username"],
            "ix_artifact_quota_reservations_project_id": ["project_id"],
            "ix_artifact_quota_reservations_artifact_id": ["artifact_id"],
            "ix_artifact_quota_reservations_status": ["status"],
            "ix_artifact_quota_reservations_expires_at": ["expires_at"],
            "ix_artifact_reservations_scope_status": ["owner_username", "project_id", "status"],
        },
        "node_executions": {"ix_node_executions_run_id": ["run_id"]},
    }
    for table, specs in index_specs.items():
        _add_indexes(table, specs)

    # PostgreSQL deployments receive restrictive constraints only after an
    # explicit orphan check. SQLite remains compatible with legacy test files.
    _postgres_fk("fk_datasets_project", "datasets", "projects", "project_id")
    _postgres_fk("fk_datasets_artifact", "datasets", "artifacts", "artifact_id")
    _postgres_fk("fk_workflows_project", "workflows", "projects", "project_id")
    _postgres_fk("fk_runs_workflow", "runs", "workflows", "workflow_id")
    _postgres_fk("fk_runs_dataset", "runs", "datasets", "dataset_id")
    _postgres_fk("fk_runs_project", "runs", "projects", "project_id")


def downgrade() -> None:
    """Intentionally preserve recovery metadata and user data.

    This migration hardens an already deployed schema. Automatically dropping
    attempt history, ownership fields, or artifact reservations would be a data-
    destroying downgrade, so rollback is performed by restoring the documented
    pre-migration database and object-storage backup instead.
    """
    return None

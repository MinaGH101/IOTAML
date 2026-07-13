"""Add artifact storage metadata and dataset artifact references.

Revision ID: 20260712_0002
Revises: 20260712_0001
Create Date: 2026-07-12
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260712_0002"
down_revision = "20260712_0001"
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

    if "artifacts" not in tables:
        op.create_table(
            "artifacts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("workflow_id", sa.Integer(), nullable=True),
            sa.Column("run_id", sa.Integer(), nullable=True),
            sa.Column("node_id", sa.String(length=255), nullable=True),
            sa.Column("owner_username", sa.String(length=255), nullable=False),
            sa.Column("artifact_type", sa.String(length=64), nullable=False),
            sa.Column("storage_backend", sa.String(length=32), nullable=False),
            sa.Column("bucket", sa.String(length=255), nullable=True),
            sa.Column("object_key", sa.Text(), nullable=False),
            sa.Column("original_filename", sa.String(length=512), nullable=False),
            sa.Column("logical_name", sa.String(length=512), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("parent_artifact_id", sa.Integer(), nullable=True),
            sa.Column("content_type", sa.String(length=255), nullable=False, server_default="application/octet-stream"),
            sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
            sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="available"),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("object_key", name="uq_artifacts_object_key"),
        )
        op.create_index("ix_artifacts_id", "artifacts", ["id"])
        op.create_index("ix_artifacts_owner_status", "artifacts", ["owner_username", "status"])
        op.create_index("ix_artifacts_project_type", "artifacts", ["project_id", "artifact_type"])
        op.create_index("ix_artifacts_run_node", "artifacts", ["run_id", "node_id"])
        op.create_index("ix_artifacts_expires_at", "artifacts", ["expires_at"])
        op.create_index("ix_artifacts_checksum_sha256", "artifacts", ["checksum_sha256"])
        op.create_index("ix_artifacts_parent_artifact_id", "artifacts", ["parent_artifact_id"])
        op.create_index("ix_artifacts_version", "artifacts", ["owner_username", "project_id", "artifact_type", "logical_name", "version"])

    inspector = sa.inspect(bind)
    if "datasets" in inspector.get_table_names():
        existing = _columns(inspector, "datasets")
        additions = {
            "artifact_id": sa.Column("artifact_id", sa.Integer(), nullable=True),
            "content_type": sa.Column("content_type", sa.String(length=255), nullable=False, server_default="text/csv"),
            "size_bytes": sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
            "checksum_sha256": sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        }
        for name, column in additions.items():
            if name not in existing:
                op.add_column("datasets", column)
        existing_indexes = _indexes(sa.inspect(bind), "datasets")
        if "ix_datasets_artifact_id" not in existing_indexes:
            op.create_index("ix_datasets_artifact_id", "datasets", ["artifact_id"])
        if "ix_datasets_checksum_sha256" not in existing_indexes:
            op.create_index("ix_datasets_checksum_sha256", "datasets", ["checksum_sha256"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "datasets" in inspector.get_table_names():
        existing_indexes = _indexes(inspector, "datasets")
        for name in ("ix_datasets_checksum_sha256", "ix_datasets_artifact_id"):
            if name in existing_indexes:
                op.drop_index(name, table_name="datasets")
        existing = _columns(sa.inspect(bind), "datasets")
        for name in ("checksum_sha256", "size_bytes", "content_type", "artifact_id"):
            if name in existing:
                op.drop_column("datasets", name)
    if "artifacts" in sa.inspect(bind).get_table_names():
        op.drop_table("artifacts")

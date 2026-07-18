"""Add reusable workflow components and immutable versions.

Revision ID: 20260716_0004
Revises: 20260716_0003
Create Date: 2026-07-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260716_0004"
down_revision = "20260716_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "workflow_components" not in tables:
        op.create_table(
            "workflow_components",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("category", sa.String(120), nullable=False, server_default="Components"),
            sa.Column("icon", sa.String(64), nullable=False, server_default="workflow"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="private"),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("owner_username", sa.String(255), nullable=False),
            sa.Column("current_version_id", sa.Integer(), nullable=True),
            sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_workflow_components_id", "workflow_components", ["id"])
        op.create_index("ix_workflow_components_project_id", "workflow_components", ["project_id"])
        op.create_index("ix_workflow_components_owner_username", "workflow_components", ["owner_username"])
        op.create_index("ix_workflow_components_current_version_id", "workflow_components", ["current_version_id"])
        op.create_index("ix_workflow_components_owner_updated", "workflow_components", ["owner_username", "updated_at"])
        op.create_index("ix_workflow_components_scope", "workflow_components", ["visibility", "project_id"])
    if "workflow_component_versions" not in tables:
        op.create_table(
            "workflow_component_versions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("component_id", sa.Integer(), nullable=False),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("semantic_version", sa.String(32), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("graph", sa.JSON(), nullable=False),
            sa.Column("graph_hash", sa.String(64), nullable=False),
            sa.Column("interface_json", sa.JSON(), nullable=False),
            sa.Column("exposed_parameters", sa.JSON(), nullable=False),
            sa.Column("dependencies_json", sa.JSON(), nullable=False),
            sa.Column("changelog", sa.Text(), nullable=False, server_default=""),
            sa.Column("owner_username", sa.String(255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("component_id", "version_number", name="uq_workflow_component_version_number"),
            sa.UniqueConstraint("component_id", "semantic_version", name="uq_workflow_component_semver"),
        )
        op.create_index("ix_workflow_component_versions_id", "workflow_component_versions", ["id"])
        op.create_index("ix_workflow_component_versions_component_id", "workflow_component_versions", ["component_id"])
        op.create_index("ix_workflow_component_versions_graph_hash", "workflow_component_versions", ["graph_hash"])
        op.create_index("ix_workflow_component_versions_owner_username", "workflow_component_versions", ["owner_username"])
        op.create_index("ix_workflow_component_versions_component_created", "workflow_component_versions", ["component_id", "created_at"])
        op.create_index("ix_workflow_component_versions_owner_component", "workflow_component_versions", ["owner_username", "component_id"])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "workflow_component_versions" in tables:
        op.drop_table("workflow_component_versions")
    if "workflow_components" in tables:
        op.drop_table("workflow_components")

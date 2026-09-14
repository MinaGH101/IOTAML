"""Persist workflow-scoped assistant conversations.

Revision ID: 20260813_0008
Revises: 20260802_0007
Create Date: 2026-08-13
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260813_0008"
down_revision = "20260802_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "assistant_messages" in inspector.get_table_names():
        return

    op.create_table(
        "assistant_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('user', 'assistant')",
            name="ck_assistant_messages_role",
        ),
        sa.ForeignKeyConstraint(
            ["workflow_id"],
            ["workflows.id"],
            name="fk_assistant_messages_workflow",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_assistant_messages_user",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_assistant_messages_workflow_id",
        "assistant_messages",
        ["workflow_id"],
    )
    op.create_index(
        "ix_assistant_messages_user_id",
        "assistant_messages",
        ["user_id"],
    )
    op.create_index(
        "ix_assistant_messages_workflow_user_id",
        "assistant_messages",
        ["workflow_id", "user_id", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_assistant_messages_workflow_user_id",
        table_name="assistant_messages",
    )
    op.drop_index(
        "ix_assistant_messages_user_id",
        table_name="assistant_messages",
    )
    op.drop_index(
        "ix_assistant_messages_workflow_id",
        table_name="assistant_messages",
    )
    op.drop_table("assistant_messages")

"""Durable reviewer form assignments.

Revision ID: 20261005_0009
Revises: 20260813_0008
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '20261005_0009'
down_revision = '20260813_0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'review_tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('run_id', sa.Integer(), sa.ForeignKey('runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('node_id', sa.String(255), nullable=False),
        sa.Column('case_id', sa.String(128), nullable=False),
        sa.Column('form_id', sa.String(64), nullable=False),
        sa.Column('assignee_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('form_json', sa.JSON(), nullable=False),
        sa.Column('case_summary', sa.JSON(), nullable=False),
        sa.Column('response_json', sa.JSON(), nullable=True),
        sa.Column('due_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('run_id', 'node_id', 'assignee_user_id', name='uq_review_task_run_node_assignee'),
    )
    op.create_index('ix_review_task_assignee_status', 'review_tasks', ['assignee_user_id', 'status', 'due_at'])
    op.create_index('ix_review_task_project_case', 'review_tasks', ['project_id', 'case_id'])
    op.create_index('ix_review_tasks_project_id', 'review_tasks', ['project_id'])


def downgrade() -> None:
    op.drop_table('review_tasks')

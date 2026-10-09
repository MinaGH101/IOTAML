"""Durable task identities, submissions, watches, and notifications.

Revision ID: 20261008_0014
Revises: 20261007_0013
"""
from alembic import op
import sqlalchemy as sa

revision = '20261008_0014'
down_revision = '20261007_0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('review_tasks', sa.Column('assignment_group_id', sa.String(64), nullable=False, server_default=''))
    op.add_column('review_tasks', sa.Column('assignment_fingerprint', sa.String(64), nullable=False, server_default=''))
    op.add_column('review_tasks', sa.Column('overdue_notified_at', sa.DateTime(), nullable=True))
    op.create_index('uq_review_task_fingerprint', 'review_tasks', ['assignment_fingerprint'], unique=True,
                    postgresql_where=sa.text("assignment_fingerprint <> ''"),
                    sqlite_where=sa.text("assignment_fingerprint <> ''"))
    op.create_table(
        'task_submissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('review_tasks.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('assignment_group_id', sa.String(64), nullable=False),
        sa.Column('assignee_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('answers_json', sa.JSON(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_task_submission_group_cursor', 'task_submissions', ['assignment_group_id', 'id'])
    op.create_table(
        'task_submission_watches',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), nullable=True, index=True),
        sa.Column('source_run_id', sa.Integer(), sa.ForeignKey('runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('node_id', sa.String(255), nullable=False),
        sa.Column('assignment_group_id', sa.String(64), nullable=False),
        sa.Column('owner_username', sa.String(255), nullable=False),
        sa.Column('refresh_interval_minutes', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('last_submission_id', sa.Integer(), nullable=True),
        sa.Column('next_check_at', sa.DateTime(), nullable=False),
        sa.Column('active', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('source_run_id', 'node_id', 'assignment_group_id', name='uq_task_watch_source_node_group'),
    )
    op.create_index('ix_task_watch_due', 'task_submission_watches', ['active', 'next_check_at'])
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('recipient_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(64), nullable=False),
        sa.Column('title', sa.String(160), nullable=False),
        sa.Column('message', sa.String(500), nullable=False, server_default=''),
        sa.Column('path', sa.String(500), nullable=True),
        sa.Column('entity_type', sa.String(64), nullable=True),
        sa.Column('entity_id', sa.String(128), nullable=True),
        sa.Column('dedupe_key', sa.String(255), nullable=False, unique=True),
        sa.Column('data_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_notification_recipient_read_created', 'notifications', ['recipient_user_id', 'read_at', 'created_at'])


def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('task_submission_watches')
    op.drop_table('task_submissions')
    op.drop_index('uq_review_task_fingerprint', table_name='review_tasks')
    op.drop_column('review_tasks', 'overdue_notified_at')
    op.drop_column('review_tasks', 'assignment_fingerprint')
    op.drop_column('review_tasks', 'assignment_group_id')

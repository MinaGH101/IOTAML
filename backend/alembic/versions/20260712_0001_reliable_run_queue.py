"""Add reliable workflow-run queue fields.

Revision ID: 20260712_0001
Revises:
Create Date: 2026-07-12
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '20260712_0001'
down_revision = None
branch_labels = None
depends_on = None


def _columns(inspector, table: str) -> set[str]:
    return {column['name'] for column in inspector.get_columns(table)}


def _indexes(inspector, table: str) -> set[str]:
    return {index['name'] for index in inspector.get_indexes(table) if index.get('name')}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'runs' not in inspector.get_table_names():
        return

    existing = _columns(inspector, 'runs')
    additions = {
        'owner_username': sa.Column('owner_username', sa.String(length=255), nullable=False, server_default='admin'),
        'priority': sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        'attempts': sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        'max_attempts': sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='3'),
        'timeout_seconds': sa.Column('timeout_seconds', sa.Integer(), nullable=False, server_default='7200'),
        'idempotency_key': sa.Column('idempotency_key', sa.String(length=128), nullable=True),
        'next_attempt_at': sa.Column('next_attempt_at', sa.DateTime(), nullable=True),
        'locked_by': sa.Column('locked_by', sa.String(length=255), nullable=True),
        'locked_at': sa.Column('locked_at', sa.DateTime(), nullable=True),
        'heartbeat_at': sa.Column('heartbeat_at', sa.DateTime(), nullable=True),
        'process_pid': sa.Column('process_pid', sa.Integer(), nullable=True),
        'worker_exit_code': sa.Column('worker_exit_code', sa.Integer(), nullable=True),
        'cancel_requested': sa.Column('cancel_requested', sa.Boolean(), nullable=False, server_default=sa.false()),
        'progress': sa.Column('progress', sa.JSON(), nullable=True),
        'node_statuses': sa.Column('node_statuses', sa.JSON(), nullable=True),
        'logs': sa.Column('logs', sa.JSON(), nullable=True),
        'queued_at': sa.Column('queued_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    }
    for name, column in additions.items():
        if name not in existing:
            op.add_column('runs', column)

    inspector = sa.inspect(bind)
    existing_indexes = _indexes(inspector, 'runs')
    index_specs = {
        'ix_runs_queue_claim': ['status', 'priority', 'next_attempt_at', 'created_at'],
        'ix_runs_owner_status': ['owner_username', 'status'],
        'ix_runs_project_status': ['project_id', 'status'],
        'ix_runs_idempotency_key': ['idempotency_key'],
        'ix_runs_locked_by': ['locked_by'],
        'ix_runs_heartbeat_at': ['heartbeat_at'],
    }
    for name, columns in index_specs.items():
        if name not in existing_indexes:
            op.create_index(name, 'runs', columns, unique=False)
    if 'uq_runs_owner_idempotency' not in existing_indexes:
        op.create_index('uq_runs_owner_idempotency', 'runs', ['owner_username', 'idempotency_key'], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'runs' not in inspector.get_table_names():
        return
    existing_indexes = _indexes(inspector, 'runs')
    for name in ('uq_runs_owner_idempotency', 'ix_runs_queue_claim', 'ix_runs_owner_status', 'ix_runs_project_status', 'ix_runs_idempotency_key', 'ix_runs_locked_by', 'ix_runs_heartbeat_at'):
        if name in existing_indexes:
            op.drop_index(name, table_name='runs')
    existing = _columns(sa.inspect(bind), 'runs')
    for name in ('queued_at', 'logs', 'node_statuses', 'progress', 'cancel_requested', 'worker_exit_code', 'process_pid', 'heartbeat_at', 'locked_at', 'locked_by', 'next_attempt_at', 'idempotency_key', 'timeout_seconds', 'max_attempts', 'attempts', 'priority', 'owner_username'):
        if name in existing:
            op.drop_column('runs', name)

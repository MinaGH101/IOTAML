"""Add canonical roles, revocable sessions, and project assignments.

Revision ID: 20260802_0007
Revises: 20260731_0006
Create Date: 2026-08-02
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '20260802_0007'
down_revision = '20260731_0006'
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    return {column['name'] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _indexes(table: str) -> set[str]:
    return {index['name'] for index in sa.inspect(op.get_bind()).get_indexes(table) if index.get('name')}


def upgrade() -> None:
    bind = op.get_bind()
    user_columns = _columns('users')
    if 'role' not in user_columns:
        op.add_column('users', sa.Column('role', sa.String(32), nullable=False, server_default='expert'))
    if 'auth_version' not in user_columns:
        op.add_column('users', sa.Column('auth_version', sa.Integer(), nullable=False, server_default='1'))

    bind.execute(sa.text("""
        UPDATE users SET role = CASE
            WHEN lower(coalesce(access_level, '')) IN ('admin', 'administrator') THEN 'admin'
            WHEN lower(coalesce(access_level, '')) IN ('manager', 'project manager') THEN 'manager'
            WHEN lower(coalesce(access_level, '')) IN ('guest', 'viewer', 'view') THEN 'guest'
            ELSE 'expert'
        END
        WHERE role IS NULL OR role = '' OR role = 'expert'
    """))
    bind.execute(sa.text("""
        UPDATE users SET access_level = CASE role
            WHEN 'admin' THEN 'Admin' WHEN 'manager' THEN 'Manager'
            WHEN 'guest' THEN 'Guest' ELSE 'Expert' END
    """))

    indexes = _indexes('users')
    if 'ix_users_role' not in indexes:
        op.create_index('ix_users_role', 'users', ['role'])
    if 'ix_users_email' not in indexes:
        op.create_index('ix_users_email', 'users', ['email'])
    if 'ix_users_role_active' not in indexes:
        op.create_index('ix_users_role_active', 'users', ['role', 'is_active'])

    if 'project_assignments' not in sa.inspect(bind).get_table_names():
        op.create_table(
            'project_assignments',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('access_type', sa.String(16), nullable=False),
            sa.Column('assigned_by_user_id', sa.Integer(), nullable=True),
            sa.Column('is_new', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
            sa.CheckConstraint("access_type IN ('edit', 'view')", name='ck_project_assignments_access_type'),
            sa.UniqueConstraint('project_id', 'user_id', name='uq_project_assignments_project_user'),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_project_assignments_project', ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_project_assignments_user', ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['assigned_by_user_id'], ['users.id'], name='fk_project_assignments_assigner', ondelete='SET NULL'),
        )
        op.create_index('ix_project_assignments_project_id', 'project_assignments', ['project_id'])
        op.create_index('ix_project_assignments_user_id', 'project_assignments', ['user_id'])
        op.create_index('ix_project_assignments_user_new', 'project_assignments', ['user_id', 'is_new'])
        op.create_index('ix_project_assignments_project_access', 'project_assignments', ['project_id', 'access_type'])


def downgrade() -> None:
    # User/project data is intentionally retained. Restore a pre-migration backup
    # for a destructive rollback.
    return None

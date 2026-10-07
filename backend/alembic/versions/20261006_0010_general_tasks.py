"""Generalize durable human assignments while preserving existing review tasks.

Revision ID: 20261006_0010
Revises: 20261005_0009
"""
from alembic import op
import sqlalchemy as sa

revision = '20261006_0010'
down_revision = '20261005_0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('review_tasks', sa.Column('task_kind', sa.String(20), nullable=False, server_default='review'))
    op.add_column('review_tasks', sa.Column('instructions', sa.String(4000), nullable=False, server_default=''))
    op.add_column('review_tasks', sa.Column('subject_type', sa.String(32), nullable=False, server_default='case'))
    op.add_column('review_tasks', sa.Column('subject_id', sa.String(128), nullable=False, server_default=''))
    op.execute('UPDATE review_tasks SET subject_id = case_id')


def downgrade() -> None:
    op.drop_column('review_tasks', 'subject_id')
    op.drop_column('review_tasks', 'subject_type')
    op.drop_column('review_tasks', 'instructions')
    op.drop_column('review_tasks', 'task_kind')

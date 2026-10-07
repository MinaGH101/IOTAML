"""Add personal and team project modes.

Revision ID: 20261006_0012
Revises: 20261006_0011
"""
from alembic import op
import sqlalchemy as sa

revision = '20261006_0012'
down_revision = '20261006_0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('projects') as batch:
        batch.add_column(sa.Column('project_type', sa.String(length=16), nullable=False,
                                   server_default='personal'))
        batch.create_index('ix_projects_project_type', ['project_type'])
    op.execute("UPDATE projects SET project_type = 'team' WHERE id IN (SELECT DISTINCT project_id FROM project_assignments)")


def downgrade() -> None:
    with op.batch_alter_table('projects') as batch:
        batch.drop_index('ix_projects_project_type')
        batch.drop_column('project_type')

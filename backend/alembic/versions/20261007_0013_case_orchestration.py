"""Add durable cases and link workflow runs to a case stage.

Revision ID: 20261007_0013
Revises: 20261006_0012
"""
from alembic import op
import sqlalchemy as sa

revision = '20261007_0013'
down_revision = '20261006_0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'case_records',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('case_id', sa.String(128), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('fields_json', sa.JSON(), nullable=False),
        sa.Column('primary_artifact_id', sa.Integer(), sa.ForeignKey('artifacts.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('source_checksum', sa.String(64), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='new'),
        sa.Column('workflow_id', sa.Integer(), sa.ForeignKey('workflows.id', ondelete='SET NULL'), nullable=True),
        sa.Column('latest_run_id', sa.Integer(), nullable=True),
        sa.Column('results_json', sa.JSON(), nullable=False),
        sa.Column('score_total', sa.Float(), nullable=True),
        sa.Column('score_maximum', sa.Float(), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('project_id', 'case_id', name='uq_case_records_project_case'),
    )
    op.create_index('ix_case_records_project_id', 'case_records', ['project_id'])
    op.create_index('ix_case_records_case_id', 'case_records', ['case_id'])
    op.create_index('ix_case_records_source_checksum', 'case_records', ['source_checksum'])
    op.create_index('ix_case_records_status', 'case_records', ['status'])
    op.create_index('ix_case_records_score_total', 'case_records', ['score_total'])
    op.create_index('ix_case_records_latest_run_id', 'case_records', ['latest_run_id'])
    op.create_index('ix_case_records_project_status_score', 'case_records', ['project_id', 'status', 'score_total'])
    with op.batch_alter_table('runs') as batch:
        batch.add_column(sa.Column('case_record_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('case_stage', sa.String(32), nullable=True))
        batch.create_foreign_key('fk_runs_case_record_id', 'case_records', ['case_record_id'], ['id'], ondelete='SET NULL')
        batch.create_index('ix_runs_case_record_id', ['case_record_id'])
        batch.create_index('ix_runs_case_stage', ['case_stage'])


def downgrade() -> None:
    with op.batch_alter_table('runs') as batch:
        batch.drop_index('ix_runs_case_stage')
        batch.drop_index('ix_runs_case_record_id')
        batch.drop_constraint('fk_runs_case_record_id', type_='foreignkey')
        batch.drop_column('case_stage')
        batch.drop_column('case_record_id')
    op.drop_table('case_records')

"""Allow one task per item and assignee from a single workflow node.

Revision ID: 20261006_0011
Revises: 20261006_0010
"""
from alembic import op

revision = '20261006_0011'
down_revision = '20261006_0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('review_tasks') as batch:
        batch.drop_constraint('uq_review_task_run_node_assignee', type_='unique')
        batch.create_unique_constraint('uq_review_task_run_node_assignee_subject',
                                       ['run_id', 'node_id', 'assignee_user_id', 'subject_id'])


def downgrade() -> None:
    with op.batch_alter_table('review_tasks') as batch:
        batch.drop_constraint('uq_review_task_run_node_assignee_subject', type_='unique')
        batch.create_unique_constraint('uq_review_task_run_node_assignee',
                                       ['run_id', 'node_id', 'assignee_user_id'])

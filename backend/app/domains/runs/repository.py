"""Runs domain repository for the IOTA ML backend."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.runs.models import Run


class RunRepository:
    def get(self, db: Session, run_id: int) -> Run | None:
        return db.get(Run, run_id)

    def latest_successful_for_workflow(
        self,
        db: Session,
        *,
        workflow_id: int,
        owner_username: str,
        exclude_run_id: int | None = None,
    ) -> Run | None:
        statement = select(Run).where(
            Run.workflow_id == workflow_id,
            Run.owner_username == owner_username,
            Run.status == 'succeeded',
        )
        if exclude_run_id is not None:
            statement = statement.where(Run.id != exclude_run_id)
        return db.execute(
            statement.order_by(Run.finished_at.desc(), Run.id.desc()).limit(1)
        ).scalar_one_or_none()


run_repository = RunRepository()

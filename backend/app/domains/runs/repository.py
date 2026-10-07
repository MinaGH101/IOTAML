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
        case_record_id: int | None = None,
    ) -> Run | None:
        statement = select(Run).where(
            Run.workflow_id == workflow_id,
            Run.owner_username == owner_username,
            Run.status == 'succeeded',
        )
        if exclude_run_id is not None:
            statement = statement.where(Run.id != exclude_run_id)
        # A workflow has two independent state streams: interactive runs made in
        # the editor and orchestrated runs for an individual case.  SQL NULL is
        # a real scope here, not a request to omit the filter.  Without this
        # predicate, an editor run can inherit the latest case run and replace
        # the editor's durable node outputs with an unrelated partial snapshot.
        if case_record_id is None:
            statement = statement.where(Run.case_record_id.is_(None))
        else:
            statement = statement.where(Run.case_record_id == case_record_id)
        return db.execute(
            statement.order_by(Run.finished_at.desc(), Run.id.desc()).limit(1)
        ).scalar_one_or_none()


run_repository = RunRepository()

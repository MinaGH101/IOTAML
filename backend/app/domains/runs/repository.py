"""Runs domain repository for the IOTA ML backend."""

from sqlalchemy.orm import Session
from app.domains.runs.models import Run


class RunRepository:
    def get(self, db: Session, run_id: int) -> Run | None:
        return db.get(Run, run_id)


run_repository = RunRepository()

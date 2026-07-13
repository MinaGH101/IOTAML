from sqlalchemy.orm import Session
from app.models import Run


class RunRepository:
    def get(self, db: Session, run_id: int) -> Run | None:
        return db.get(Run, run_id)


run_repository = RunRepository()

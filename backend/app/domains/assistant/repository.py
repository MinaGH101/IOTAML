"""Database access for persisted workflow assistant conversations."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import AssistantMessage


class AssistantMessageRepository:
    @staticmethod
    def list_recent(
        db: Session,
        *,
        workflow_id: int,
        user_id: int,
        limit: int,
    ) -> list[AssistantMessage]:
        if limit <= 0:
            return []

        rows = list(
            db.scalars(
                select(AssistantMessage)
                .where(
                    AssistantMessage.workflow_id == workflow_id,
                    AssistantMessage.user_id == user_id,
                )
                .order_by(AssistantMessage.id.desc())
                .limit(limit)
            )
        )
        rows.reverse()
        return rows

    @staticmethod
    def list_history(
        db: Session,
        *,
        workflow_id: int,
        user_id: int,
        limit: int,
    ) -> list[AssistantMessage]:
        return AssistantMessageRepository.list_recent(
            db,
            workflow_id=workflow_id,
            user_id=user_id,
            limit=limit,
        )

    @staticmethod
    def add_exchange(
        db: Session,
        *,
        workflow_id: int,
        user_id: int,
        user_message: str,
        assistant_message: str,
    ) -> tuple[AssistantMessage, AssistantMessage]:
        user_row = AssistantMessage(
            workflow_id=workflow_id,
            user_id=user_id,
            role="user",
            content=user_message,
        )
        assistant_row = AssistantMessage(
            workflow_id=workflow_id,
            user_id=user_id,
            role="assistant",
            content=assistant_message,
        )
        db.add_all([user_row, assistant_row])
        db.flush()
        return user_row, assistant_row

    @staticmethod
    def clear(
        db: Session,
        *,
        workflow_id: int,
        user_id: int,
    ) -> int:
        result = db.execute(
            delete(AssistantMessage).where(
                AssistantMessage.workflow_id == workflow_id,
                AssistantMessage.user_id == user_id,
            )
        )
        return int(result.rowcount or 0)


assistant_message_repository = AssistantMessageRepository()

"""Assistant domain router for the IOTA ML backend."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.projects.access import require_project_view
from app.domains.workflows.models import Workflow

from .models import AssistantMessage
from .repository import assistant_message_repository
from .service import AssistantNotConfiguredError, AssistantProviderError, AssistantService


router = APIRouter(prefix="/assistant", tags=["assistant"])
service = AssistantService()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    workflow_id: int | None = Field(default=None, ge=1)


class ChatResponse(BaseModel):
    message: str
    workflow_changed: bool = False


class AssistantMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_id: int
    role: str
    content: str
    created_at: datetime


def _resolve_workflow(
    db: Session,
    workflow_id: int,
    current_user: User,
) -> tuple[Workflow, str]:
    workflow = db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    owner_username = workflow.owner_username
    if workflow.project_id is None:
        if workflow.owner_username.lower() != current_user.username.lower():
            raise HTTPException(status_code=404, detail="Workflow not found.")
    else:
        project, _ = require_project_view(db, workflow.project_id, current_user)
        owner_username = project.owner_username

    return workflow, owner_username


@router.get(
    "/history/{workflow_id}",
    response_model=list[AssistantMessageOut],
)
def history(
    workflow_id: int,
    limit: int = Query(default=300, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> list[AssistantMessage]:
    _resolve_workflow(db, workflow_id, current_user)
    return assistant_message_repository.list_history(
        db,
        workflow_id=workflow_id,
        user_id=current_user.id,
        limit=limit,
    )


@router.delete("/history/{workflow_id}")
def clear_history(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> dict[str, int | bool]:
    _resolve_workflow(db, workflow_id, current_user)
    deleted = assistant_message_repository.clear(
        db,
        workflow_id=workflow_id,
        user_id=current_user.id,
    )
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> ChatResponse:
    try:
        owner_username = current_user.username
        recent_history: list[dict[str, str]] = []

        if request.workflow_id is not None:
            _, owner_username = _resolve_workflow(
                db,
                request.workflow_id,
                current_user,
            )

            # The configured limit includes the current user message. With the
            # default of 5, we load at most 4 persisted messages plus the new one.
            context_limit = get_settings().assistant_context_message_limit
            previous_limit = max(context_limit - 1, 0)
            recent_rows = assistant_message_repository.list_recent(
                db,
                workflow_id=request.workflow_id,
                user_id=current_user.id,
                limit=previous_limit,
            )
            recent_history = [
                {"role": row.role, "content": row.content}
                for row in recent_rows
            ]

        result = await service.chat(
            message=request.message,
            history=recent_history,
            db=db,
            workflow_id=request.workflow_id,
            owner_username=owner_username,
        )

        if request.workflow_id is not None:
            assistant_message_repository.add_exchange(
                db,
                workflow_id=request.workflow_id,
                user_id=current_user.id,
                user_message=request.message,
                assistant_message=result.message,
            )
            db.commit()

        return ChatResponse(
            message=result.message,
            workflow_changed=result.workflow_changed,
        )

    except AssistantNotConfiguredError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "The optional AI assistant is not configured. "
                "Set OPENAI_API_KEY to enable it."
            ),
        ) from exc
    except AssistantProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not generate a response.",
        ) from exc

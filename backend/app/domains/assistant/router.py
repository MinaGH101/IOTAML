"""Assistant domain router for the IOTA ML backend."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.projects.access import require_project_view
from app.domains.workflows.models import Workflow

from .service import AssistantNotConfiguredError, AssistantProviderError, AssistantService


router = APIRouter(prefix="/assistant", tags=["assistant"])
service = AssistantService()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    workflow_id: int | None = Field(default=None, ge=1)


class ChatResponse(BaseModel):
    message: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> ChatResponse:
    try:
        owner_username = current_user.username
        if request.workflow_id is not None:
            workflow = db.get(Workflow, request.workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail='Workflow not found.')
            if workflow.project_id is None:
                if workflow.owner_username.lower() != current_user.username.lower():
                    raise HTTPException(status_code=404, detail='Workflow not found.')
            else:
                project, _ = require_project_view(db, workflow.project_id, current_user)
                owner_username = project.owner_username
        answer = await service.chat(
            message=request.message,
            db=db,
            workflow_id=request.workflow_id,
            owner_username=owner_username,
        )
        return ChatResponse(message=answer)

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

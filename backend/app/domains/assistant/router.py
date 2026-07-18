from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAIError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.users import get_current_user

from .service import AssistantService


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
    current_user: dict = Depends(get_current_user),
) -> ChatResponse:
    try:
        answer = await service.chat(
            message=request.message,
            db=db,
            workflow_id=request.workflow_id,
            owner_username=str(current_user["username"]),
        )
        return ChatResponse(message=answer)

    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not generate a response.",
        ) from exc
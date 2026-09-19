"""Assistant tool for queueing the selected workflow for execution."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import uuid4

from app.domains.runs.routes import create_run
from app.domains.runs.schemas import RunCreate
from app.domains.workflows.service import get_workflow

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app.domains.auth.models import User


WORKFLOW_EXECUTION_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "run_current_workflow",
        "description": (
            "Validate, create, and queue an execution for the complete selected workflow. "
            "This does not wait for completion; it returns the durable run ID and its "
            "initial queue status. Use only when the user explicitly asks to run or "
            "execute the selected workflow, and after validate_current_workflow reports "
            "a valid graph."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


def run_current_workflow(
    *,
    db: "Session",
    workflow_id: int,
    owner_username: str,
    current_user: "User",
) -> dict[str, Any]:
    """Queue the authoritative saved graph through the same path as the Run button."""
    workflow = get_workflow(db, workflow_id, owner_username)
    graph = workflow.graph if isinstance(workflow.graph, dict) else {}
    metadata = graph.get("meta") if isinstance(graph.get("meta"), dict) else {}

    run = create_run(
        RunCreate(
            workflow_name=workflow.name,
            workflow_graph=graph,
            workflow_id=workflow.id,
            workflow_revision=workflow.revision,
            dataset_id=metadata.get("datasetId"),
            project_id=workflow.project_id,
            target_column=metadata.get("targetColumn"),
            task_type=str(metadata.get("taskType") or "auto"),
            selected_node_id=None,
            bypass_cache=False,
            idempotency_key=str(uuid4()),
        ),
        db=db,
        current_user=current_user,
        # Direct Python calls do not resolve FastAPI Header/Depends defaults.
        idempotency_header=None,
        _=None,
    )

    return {
        "created": True,
        "runId": run.id,
        "status": run.status,
        "nodesTotal": (run.progress or {}).get("nodes_total", 0),
        "message": "Run was created and queued. Completion has not been confirmed.",
    }

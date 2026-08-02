"""Canonical workflow and node error contract.

Every failure that can be shown to a workflow author is represented by
``WorkflowProblem``.  Nodes may raise ``NodeContractError`` when they know the
precise input, setting, or column that is invalid.  The executor converts
unexpected exceptions into application-owned problems without losing the
original exception type, which makes server defects distinguishable from
user-correctable workflow errors.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


ProblemCategory = Literal["input", "setting", "data", "execution", "application"]
ProblemOwner = Literal["user", "application"]


@dataclass(frozen=True)
class WorkflowProblem:
    """Serializable description of one actionable workflow failure."""

    code: str
    message: str
    category: ProblemCategory
    responsibility: ProblemOwner
    suggested_fix: str
    node_id: str | None = None
    node_name: str | None = None
    port: str | None = None
    setting: str | None = None
    column: str | None = None
    expected: Any = None
    actual: Any = None
    error_type: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a compact JSON-safe dictionary without empty optional fields."""
        return {
            key: value
            for key, value in asdict(self).items()
            if value is not None and value != {}
        }


class NodeContractError(ValueError):
    """Expected, user-correctable violation of a node contract."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        category: Literal["input", "setting", "data", "execution", "application"],
        suggested_fix: str,
        port: str | None = None,
        setting: str | None = None,
        column: str | None = None,
        expected: Any = None,
        actual: Any = None,
        details: dict[str, Any] | None = None,
        responsibility: ProblemOwner = "user",
    ) -> None:
        super().__init__(message)
        self.problem = WorkflowProblem(
            code=code,
            message=message,
            category=category,
            responsibility=responsibility,
            suggested_fix=suggested_fix,
            port=port,
            setting=setting,
            column=column,
            expected=expected,
            actual=actual,
            error_type=self.__class__.__name__,
            details=details or {},
        )


def normalize_node_exception(
    exc: Exception,
    *,
    node_id: str,
    node_name: str,
) -> WorkflowProblem:
    """Attach node context and classify expected versus unexpected failures."""
    if isinstance(exc, NodeContractError):
        source = exc.problem
        payload = source.to_dict()
        payload.update({"node_id": node_id, "node_name": node_name})
        return WorkflowProblem(**payload)
    if isinstance(exc, (ValueError, KeyError)):
        return WorkflowProblem(
            code="NODE_DATA_CONTRACT_INVALID",
            message=str(exc) or "The node input data is invalid.",
            category="data",
            responsibility="user",
            suggested_fix=(
                "Check the node's connected inputs, selected columns, and setting "
                "values. The message above identifies the rejected contract."
            ),
            node_id=node_id,
            node_name=node_name,
            error_type=exc.__class__.__name__,
        )
    return WorkflowProblem(
        code="NODE_APPLICATION_ERROR",
        message=str(exc) or "The node failed without an error message.",
        category="application",
        responsibility="application",
        suggested_fix=(
            "This is an application error. Record the run and node identifiers "
            "and inspect the backend traceback."
        ),
        node_id=node_id,
        node_name=node_name,
        error_type=exc.__class__.__name__,
    )

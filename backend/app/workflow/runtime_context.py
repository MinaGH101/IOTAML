from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

@dataclass
class RuntimeContext:
    execution_id: int | str
    project_id: int | None = None
    dataset_id: int | None = None
    target_column: str | None = None
    task_type: str = 'auto'
    run_path: Path | None = None
    node_outputs: dict[str, Any] = field(default_factory=dict)

    def expression_context(self, json_item: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            'json': json_item or {},
            'node': self.node_outputs,
            'nodes': self.node_outputs,
            'execution': {'id': self.execution_id},
            'project': {'id': self.project_id},
        }

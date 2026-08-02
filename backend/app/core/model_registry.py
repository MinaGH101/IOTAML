"""Import all ORM models exactly once for Alembic metadata discovery."""
from app.domains.auth.models import User
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.datasets.models import Dataset
from app.domains.workflows.models import Workflow, WorkflowVersion
from app.domains.components.models import WorkflowComponent, WorkflowComponentVersion
from app.domains.runs.models import Run, RunAttempt, RunEvent
from app.domains.nodes.models import CustomNode
from app.domains.artifacts.models import Artifact, ArtifactLineage, ArtifactQuotaReservation, NodeCacheEntry, NodeExecution

__all__ = [
    'User', 'Project', 'ProjectAssignment', 'Dataset', 'Workflow', 'WorkflowVersion', 'WorkflowComponent',
    'WorkflowComponentVersion', 'Run', 'RunAttempt', 'RunEvent', 'CustomNode',
    'Artifact', 'ArtifactLineage', 'ArtifactQuotaReservation', 'NodeCacheEntry', 'NodeExecution',
]

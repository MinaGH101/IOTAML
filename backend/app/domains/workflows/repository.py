"""Database repository for workflows and workflow versions.

This module contains focused SQLAlchemy query operations for the workflow
domain. It deliberately contains little business logic; ownership rules,
validation, revision handling, and transaction decisions are handled by the
service layer.

All methods receive an existing SQLAlchemy ``Session`` and return ORM objects.
The caller controls commits except where row locking affects the surrounding
transaction.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.domains.workflows.models import Workflow, WorkflowVersion


class WorkflowRepository:
    """Provide reusable database queries for workflow-domain ORM models."""

    def get(
        self,
        db: Session,
        workflow_id: int,
        owner_username: str | None = None,
    ) -> Workflow | None:
        """Fetch one workflow by primary key, optionally scoped to an owner.

        Args:
            db:
                Active SQLAlchemy database session.
            workflow_id:
                Workflow primary key.
            owner_username:
                Optional ownership filter. When supplied, workflows owned by
                another user are treated as not found.

        Returns:
            The matching ``Workflow`` object, or ``None`` when no row matches.

        Side effects:
            None. This method performs a read-only query.
        """
        query = db.query(Workflow).filter(Workflow.id == workflow_id)

        # Ownership is optional so this repository method can support both
        # strictly user-scoped and trusted internal lookups.
        if owner_username is not None:
            query = query.filter(Workflow.owner_username == owner_username)

        return query.first()

    def get_for_update(
        self,
        db: Session,
        workflow_id: int,
        owner_username: str,
    ) -> Workflow | None:
        """Fetch and lock one owned workflow row for the current transaction.

        ``with_for_update()`` issues a row-level lock on supported databases.
        This is used when version numbers or other values must be computed
        safely under concurrent requests.

        Args:
            db:
                Active SQLAlchemy database session.
            workflow_id:
                Workflow primary key.
            owner_username:
                Required workflow owner.

        Returns:
            The locked ``Workflow`` object, or ``None`` when no owned row
            matches.

        Transaction note:
            The lock remains active until the caller commits or rolls back.
        """
        return (
            db.query(Workflow)
            .filter(
                Workflow.id == workflow_id,
                Workflow.owner_username == owner_username,
            )
            .with_for_update()
            .first()
        )

    def list(
        self,
        db: Session,
        project_id: int | None = None,
        owner_username: str | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Workflow]:
        """List workflows with optional owner/project filters and pagination.

        Args:
            db:
                Active SQLAlchemy database session.
            project_id:
                Optional project filter.
            owner_username:
                Optional owner filter.
            limit:
                Maximum number of rows to return.
            offset:
                Number of ordered rows to skip.

        Returns:
            Workflows ordered by newest ``updated_at`` first, then highest ID
            first for deterministic ordering.
        """
        query = db.query(Workflow)

        if owner_username is not None:
            query = query.filter(Workflow.owner_username == owner_username)
        if project_id is not None:
            query = query.filter(Workflow.project_id == project_id)

        return (
            query.order_by(Workflow.updated_at.desc(), Workflow.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def list_versions(
        self,
        db: Session,
        workflow_id: int,
        owner_username: str,
    ) -> list[WorkflowVersion]:
        """List all owned versions of a workflow.

        Args:
            db:
                Active SQLAlchemy database session.
            workflow_id:
                Parent workflow primary key.
            owner_username:
                Required owner of the version records.

        Returns:
            Versions ordered by descending version number, so the newest named
            version appears first.
        """
        return (
            db.query(WorkflowVersion)
            .filter(
                WorkflowVersion.workflow_id == workflow_id,
                WorkflowVersion.owner_username == owner_username,
            )
            .order_by(WorkflowVersion.version_number.desc())
            .all()
        )

    def get_version(
        self,
        db: Session,
        workflow_id: int,
        version_id: int,
        owner_username: str,
    ) -> WorkflowVersion | None:
        """Fetch one owned version under a specific workflow.

        Filtering by both ``workflow_id`` and ``version_id`` prevents a caller
        from using a valid version ID from another workflow.

        Args:
            db:
                Active SQLAlchemy database session.
            workflow_id:
                Required parent workflow ID.
            version_id:
                Workflow-version primary key.
            owner_username:
                Required owner.

        Returns:
            The matching ``WorkflowVersion`` object, or ``None`` when no row
            satisfies all three identity/ownership conditions.
        """
        return (
            db.query(WorkflowVersion)
            .filter(
                WorkflowVersion.id == version_id,
                WorkflowVersion.workflow_id == workflow_id,
                WorkflowVersion.owner_username == owner_username,
            )
            .first()
        )


# Shared stateless repository instance imported by the workflow service layer.
workflow_repository = WorkflowRepository()

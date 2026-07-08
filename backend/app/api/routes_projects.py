from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dataset, Project, Workflow
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.users import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


def project_out(project: Project, db: Session) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description or "",
        start_date=project.start_date,
        due_date=project.due_date,
        project_manager=project.project_manager or "",
        state=project.state or "open",
        priority=getattr(project, "priority", None) or "medium",
        color=project.color or "#31cde3",
        owner_username=project.owner_username,
        workflow_count=db.query(Workflow).filter(Workflow.project_id == project.id).count(),
        dataset_count=db.query(Dataset).filter(Dataset.project_id == project.id).count(),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("", response_model=ProjectOut)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> ProjectOut:
    project = Project(
        name=payload.name.strip(),
        description=payload.description or "",
        start_date=payload.start_date,
        due_date=payload.due_date,
        project_manager=payload.project_manager or f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        state=payload.state,
        priority=payload.priority,
        color=payload.color,
        owner_username=str(current_user.get("username", "admin")),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_out(project, db)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> list[ProjectOut]:
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    return [project_out(project, db) for project in projects]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> ProjectOut:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project_out(project, db)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> ProjectOut:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    project.name = payload.name.strip()
    project.description = payload.description or ""
    project.start_date = payload.start_date
    project.due_date = payload.due_date
    project.project_manager = payload.project_manager or ""
    project.state = payload.state
    project.priority = payload.priority
    project.color = payload.color
    db.commit()
    db.refresh(project)
    return project_out(project, db)


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    db.delete(project)
    db.commit()
    return {"ok": True}

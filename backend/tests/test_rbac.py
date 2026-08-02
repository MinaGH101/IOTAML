from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core import model_registry  # noqa: F401
from app.core.config import get_settings
from app.core.database import Base
from app.domains.auth.models import User
from app.domains.auth.service import bootstrap_users, hash_password, verify_password
from app.domains.projects.access import permission_for_project
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.projects.schemas import ProjectUpdate
from app.domains.projects.service import update_project


def _database() -> tuple[object, Session]:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    return engine, Session(engine)


def _user(username: str, role: str) -> User:
    return User(
        username=username,
        email=f'{username}@example.test',
        password_hash=hash_password('safe-test-password'),
        first_name=username,
        role=role,
        access_level=role.title(),
        is_active=True,
    )


def test_environment_admin_bootstrap_never_resets_existing_password(monkeypatch) -> None:
    monkeypatch.setenv('ADMIN_BOOTSTRAP_ENABLED', 'true')
    monkeypatch.setenv('ADMIN_EMAIL', 'admin@example.test')
    monkeypatch.setenv('ADMIN_PASSWORD', 'environment-password')
    get_settings.cache_clear()
    _, db = _database()
    try:
        assert bootstrap_users(db) == 1
        admin = db.query(User).filter(User.username == 'admin@example.test').one()
        assert verify_password(admin.password_hash, 'environment-password')

        admin.password_hash = hash_password('changed-inside-app')
        db.commit()
        assert bootstrap_users(db) == 0
        db.refresh(admin)
        assert verify_password(admin.password_hash, 'changed-inside-app')
        assert not verify_password(admin.password_hash, 'environment-password')
    finally:
        db.close()
        get_settings.cache_clear()


def test_role_and_assignment_matrix() -> None:
    _, db = _database()
    try:
        admin = _user('admin', 'admin')
        manager = _user('manager', 'manager')
        owner = _user('owner', 'expert')
        editor = _user('editor', 'expert')
        guest = _user('guest', 'guest')
        unrelated = _user('unrelated', 'expert')
        db.add_all([admin, manager, owner, editor, guest, unrelated])
        db.flush()
        project = Project(name='Secured project', owner_username=owner.username)
        db.add(project)
        db.flush()
        db.add_all([
            ProjectAssignment(project_id=project.id, user_id=editor.id, access_type='edit', assigned_by_user_id=admin.id),
            ProjectAssignment(project_id=project.id, user_id=guest.id, access_type='view', assigned_by_user_id=admin.id),
            # Even a legacy edit assignment cannot elevate a manager outside owned projects.
            ProjectAssignment(project_id=project.id, user_id=manager.id, access_type='edit', assigned_by_user_id=admin.id),
        ])
        db.commit()

        assert permission_for_project(db, project, owner).access == 'owner'
        assert permission_for_project(db, project, admin).access == 'admin'
        manager_permission = permission_for_project(db, project, manager)
        assert manager_permission and manager_permission.access == 'view' and not manager_permission.can_run
        editor_permission = permission_for_project(db, project, editor)
        assert editor_permission and editor_permission.access == 'edit' and editor_permission.can_run and not editor_permission.can_delete
        guest_permission = permission_for_project(db, project, guest)
        assert guest_permission and guest_permission.access == 'view' and not guest_permission.can_edit
        assert permission_for_project(db, project, unrelated) is None
    finally:
        db.close()


def test_assigned_expert_can_update_project_without_changing_assignments() -> None:
    _, db = _database()
    try:
        manager = _user('manager-owner', 'manager')
        editor = _user('assigned-editor', 'expert')
        db.add_all([manager, editor])
        db.flush()
        project = Project(name='Original', description='', owner_username=manager.username)
        db.add(project)
        db.flush()
        db.add(ProjectAssignment(project_id=project.id, user_id=editor.id, access_type='edit', assigned_by_user_id=manager.id))
        db.commit()

        result = update_project(db, project.id, ProjectUpdate(
            name='Updated by assigned expert',
            description='Allowed edit',
            start_date=None,
            due_date=None,
            project_manager='Manager',
            state='open',
            priority='medium',
            color='#2fa99a',
            assignments=[{'user_id': editor.id, 'access_type': 'edit'}],
        ), editor)
        assert result.name == 'Updated by assigned expert'
        assert result.effective_access == 'edit'
    finally:
        db.close()


def test_stale_edit_assignment_never_elevates_guest() -> None:
    _, db = _database()
    try:
        owner = _user('owner-stale', 'expert')
        guest = _user('guest-stale', 'guest')
        db.add_all([owner, guest]); db.flush()
        project = Project(name='Stale assignment', owner_username=owner.username)
        db.add(project); db.flush()
        db.add(ProjectAssignment(project_id=project.id, user_id=guest.id, access_type='edit', assigned_by_user_id=owner.id))
        db.commit()

        permission = permission_for_project(db, project, guest)
        assert permission and permission.access == 'view'
        assert not permission.can_edit and not permission.can_run
    finally:
        db.close()


def test_managed_username_is_immutable() -> None:
    from fastapi import HTTPException
    from app.domains.auth.service import update_managed_user

    _, db = _database()
    try:
        admin = _user('admin-immutable', 'admin')
        expert = _user('expert-immutable', 'expert')
        db.add_all([admin, expert]); db.commit()
        try:
            update_managed_user(db, expert, {'username': 'renamed-user'}, admin)
            raise AssertionError('Expected immutable username rejection')
        except HTTPException as exc:
            assert exc.status_code == 400
        db.refresh(expert)
        assert expert.username == 'expert-immutable'
    finally:
        db.close()


def test_project_owner_cannot_be_changed_to_guest() -> None:
    from fastapi import HTTPException
    from app.domains.admin.routes import update_user
    from app.domains.auth.schemas import AdminUserUpdate

    _, db = _database()
    try:
        admin = _user('admin-role-guard', 'admin')
        manager = _user('manager-role-guard', 'manager')
        db.add_all([admin, manager]); db.flush()
        db.add(Project(name='Owned project', owner_username=manager.username)); db.commit()
        try:
            update_user(manager.id, AdminUserUpdate(role='guest'), db, admin)
            raise AssertionError('Expected guest role ownership guard')
        except HTTPException as exc:
            assert exc.status_code == 409
        db.refresh(manager)
        assert manager.role == 'manager'
    finally:
        db.close()

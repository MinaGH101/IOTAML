"""Create/delete a temporary local browser-test account."""
import json
import secrets
import sys
from uuid import uuid4

from app.core.database import SessionLocal
from app.domains.auth.service import hash_password
from app.core import model_registry  # noqa: F401
from app.domains.auth.models import User
from app.domains.projects.models import Project

with SessionLocal() as db:
    if sys.argv[1] == 'create':
        username = f'e2e-{uuid4().hex}@example.test'
        password = secrets.token_urlsafe(32)
        db.add(User(username=username, email=username, password_hash=hash_password(password), role='manager', access_level='Manager', first_name='Browser', last_name='Test'))
        db.commit()
        print(json.dumps({'username': username, 'password': password}))
    elif sys.argv[1] == 'delete':
        account = json.load(sys.stdin)
        username = account['username']
        if not username.startswith('e2e-') or not username.endswith('@example.test'):
            raise ValueError('Only temporary browser-test accounts can be deleted.')
        if db.query(Project).filter(Project.owner_username == username).count():
            raise ValueError('Remove test projects before deleting the test account.')
        db.query(User).filter(User.username == username, User.role == 'manager').delete()
        db.commit()

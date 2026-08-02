"""Regression and contract tests for conftest."""

import os

os.environ.setdefault('DATABASE_URL', 'sqlite+pysqlite:///:memory:')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/15')
os.environ.setdefault('STORAGE_DIR', '/tmp/iota-test-storage')

# Register the complete metadata graph before any isolated create_all test.
from app.core import model_registry as _model_registry  # noqa: F401,E402

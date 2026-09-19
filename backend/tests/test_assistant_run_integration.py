"""Exercise assistant execution against the real run creation path, without live data."""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core import model_registry  # noqa: F401
from app.core.database import Base
from app.domains.assistant.service import AssistantService
from app.domains.auth.models import User
from app.domains.runs.models import Run
from app.domains.workflows.models import Workflow


class AssistantRunIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite+pysqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(username='assistant-test', password_hash='unused', role='expert')
        self.workflow = Workflow(name='Assistant test', owner_username=self.user.username, graph={
            'nodes': [{'id': 'source', 'data': {'registryId': 'DI-001', 'params': {
                'json_payload': '[{"value": 1}]',
            }}}], 'edges': [],
        })
        self.db.add_all([self.user, self.workflow])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def call_run(self):
        return AssistantService._execute_tool_call(
            tool_name='run_current_workflow', raw_arguments='{}', db=self.db,
            workflow_id=self.workflow.id, owner_username=self.user.username,
            current_user=self.user,
        )

    def test_real_run_is_persisted_and_worker_notified(self):
        with patch('app.domains.runs.routes.enqueue_run') as enqueue:
            result = self.call_run()
        self.assertTrue(result.get('created'), result)
        run = self.db.get(Run, result['runId'])
        self.assertEqual(run.status, 'queued')
        self.assertEqual(run.workflow_id, self.workflow.id)
        self.assertIn('source', run.node_statuses)
        enqueue.assert_called_once_with(run.id)

    def test_validation_details_reach_the_assistant(self):
        self.workflow.graph = {'nodes': [{'id': 'bad', 'data': {'registryId': 'NONEXISTENT'}}], 'edges': []}
        self.db.commit()
        with patch('app.domains.runs.routes.enqueue_run') as enqueue:
            result = self.call_run()
        self.assertIn('error', result)
        self.assertIn('details', result)
        self.assertEqual(self.db.query(Run).count(), 0)
        enqueue.assert_not_called()

    def test_chat_returns_created_run_without_another_model_round(self):
        response = SimpleNamespace(output=[SimpleNamespace(
            type='function_call', name='run_current_workflow', arguments='{}', call_id='run-call',
        )], output_text='')
        create = AsyncMock(return_value=response)
        service = AssistantService(client=SimpleNamespace(responses=SimpleNamespace(create=create)))
        with patch('app.domains.runs.routes.enqueue_run'):
            result = asyncio.run(service.chat(
                message='run', history=[], db=self.db, workflow_id=self.workflow.id,
                owner_username=self.user.username, current_user=self.user,
            ))
        self.assertIsNotNone(result.run_id)
        self.assertEqual(self.db.query(Run).count(), 1)
        self.assertEqual(create.await_count, 1)


if __name__ == '__main__':
    unittest.main()

from __future__ import annotations

from app.nodes.base import BaseNode, port
from app.nodes.io import json_output, node_label


class ManualTriggerNode(BaseNode):
    id = 'DI-010'
    name = 'Manual Trigger'
    category = 'Data Input'
    description = 'Starts a workflow manually without requiring upstream input.'
    inputs = []
    outputs = [port('trigger', 'Trigger', 'trigger')]

    def run(self, node, inputs, settings, context):
        value = {'triggered': True, 'execution_id': context.execution_id}
        return {'trigger': True, 'json': value, 'output': json_output(str(node['id']), node_label(node), value)}

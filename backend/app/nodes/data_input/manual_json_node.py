from __future__ import annotations

import json
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import json_output, node_label


class ManualJsonInputNode(BaseNode):
    id = 'DI-001'
    name = 'Manual JSON Input'
    category = 'Data Input'
    description = 'Create JSON items manually for debugging and automation workflows.'
    inputs = []
    outputs = [port('json_items', 'JSON Items', 'json_items')]
    settings_schema = [setting('json_payload', 'JSON Payload', 'json', '[{"json": {"example": true}}]', required=True, supports_dynamic=False)]
    execution_mode = 'instant'

    def run(self, node, inputs, settings, context):
        payload = settings.get('json_payload') or '[]'
        if isinstance(payload, str):
            payload = json.loads(payload)
        if isinstance(payload, dict):
            payload = [payload]
        return {'json_items': payload, 'json': payload, 'output': json_output(str(node['id']), node_label(node), payload)}

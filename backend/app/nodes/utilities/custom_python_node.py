from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import Any

import pandas as pd

from app.nodes.base import BaseNode, NodeDefinition, PortDefinition
from app.nodes.io import output, safe_json, table_output
from app.nodes.utilities.python_code_node import _validate_code


def _input_value(value: Any) -> Any:
    if isinstance(value, dict):
        frame = value.get('_df')
        if isinstance(frame, pd.DataFrame):
            return safe_json(frame.head(10000))
        visible = value.get('output')
        if isinstance(visible, dict):
            if 'rows' in visible:
                return safe_json(visible.get('rows'))
            if 'value' in visible:
                return safe_json(visible.get('value'))
            if 'metrics' in visible:
                return safe_json(visible.get('metrics'))
        for key in ('json', 'metrics', 'report', 'data'):
            if key in value:
                return safe_json(value[key])
    return safe_json(value)


def _collect_inputs(inputs: dict[str, Any], port_defs: list[dict]) -> dict[str, Any]:
    by_port = inputs.get('_by_port') if isinstance(inputs.get('_by_port'), dict) else {}
    result: dict[str, Any] = {}
    for port in port_defs:
        port_id = str(port.get('id') or 'input')
        values = list(by_port.get(port_id) or [])
        if not values:
            values = [value for key, value in inputs.items() if not str(key).startswith('_')]
        normalized = [_input_value(value) for value in values]
        result[port_id] = normalized if port.get('multiple') else (normalized[0] if normalized else None)
    if not port_defs:
        values = [value for key, value in inputs.items() if not str(key).startswith('_')]
        result['input'] = _input_value(values[0]) if values else None
    return result


def _run_custom_code(code: str, payload: dict[str, Any], timeout: int = 30, memory_mb: int = 4096) -> dict[str, Any]:
    _validate_code(code)
    wrapper = textwrap.dedent('''
    import json, math, statistics, socket

    def __blocked_network__(*args, **kwargs):
        raise PermissionError("Network access is disabled inside custom Python nodes.")

    socket.create_connection = __blocked_network__
    __original_socket__ = socket.socket

    class __RestrictedSocket__(__original_socket__):
        def connect(self, *args, **kwargs):
            return __blocked_network__(*args, **kwargs)
        def connect_ex(self, *args, **kwargs):
            __blocked_network__(*args, **kwargs)
            return 1

    socket.socket = __RestrictedSocket__

    __payload__ = json.loads(__INPUT_JSON__)
    inputs = __payload__.get("inputs", {})
    input_data = inputs
    template = __payload__.get("template")
    settings = __payload__.get("settings", {})

    def __jsonable__(value):
        module_name = getattr(value.__class__, "__module__", "")
        class_name = getattr(value.__class__, "__name__", "")
        if module_name.startswith("pandas") and class_name == "DataFrame":
            return {"__kind__": "dataframe", "records": json.loads(value.where(value.notna(), None).to_json(orient="records"))}
        if module_name.startswith("pandas") and class_name == "Series":
            return {"__kind__": "series", "value": value.where(value.notna(), None).tolist()}
        if module_name.startswith("numpy") and hasattr(value, "tolist"):
            return value.tolist()
        if module_name.startswith("numpy") and hasattr(value, "item"):
            return value.item()
        if isinstance(value, dict):
            return {str(k): __jsonable__(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [__jsonable__(v) for v in value]
        return value

    def __user_fn__():
    __USER_CODE__

    result = __user_fn__()
    print(json.dumps({"result": __jsonable__(result)}, default=str))
    ''')
    indented = '\n'.join('    ' + line if line.strip() else '    pass' for line in code.splitlines())
    script = wrapper.replace('__INPUT_JSON__', repr(json.dumps(payload, default=str))).replace('__USER_CODE__', indented)
    with tempfile.TemporaryDirectory(prefix='iota-custom-node-') as tmp:
        script_path = Path(tmp) / 'custom_node.py'
        script_path.write_text(script, encoding='utf-8')
        env = {'PYTHONNOUSERSITE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
        preexec = None
        if os.name == 'posix':
            def limit_resources():
                import resource
                resource.setrlimit(resource.RLIMIT_AS, (memory_mb * 1024 * 1024, memory_mb * 1024 * 1024))
                resource.setrlimit(resource.RLIMIT_CPU, (max(1, timeout), max(1, timeout + 1)))
            preexec = limit_resources
        proc = subprocess.run(
            [sys.executable, '-I', '-S', str(script_path)],
            cwd=tmp,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            preexec_fn=preexec,
        )
    if proc.returncode != 0:
        raise RuntimeError(f'Custom node failed: {proc.stderr[-3000:]}')
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    parsed = json.loads(lines[-1]) if lines else {'result': None}
    return {'stdout': '\n'.join(lines[:-1]), 'stderr': proc.stderr, 'result': parsed.get('result')}


def _as_dataframe(value: Any) -> pd.DataFrame | None:
    if isinstance(value, dict) and value.get('__kind__') == 'dataframe':
        value = value.get('records')
    if isinstance(value, list) and (not value or isinstance(value[0], dict)):
        return pd.DataFrame(value)
    if isinstance(value, dict) and value and all(isinstance(v, list) for v in value.values()):
        return pd.DataFrame(value)
    return None


class CustomPythonNode(BaseNode):
    category = 'User Nodes'
    execution_mode = 'sandboxed'
    supports_dynamic_parameters = False

    def __init__(self, record: Any):
        self.record = record
        self.id = str(record.id)
        self.type = self.id
        self.name = str(record.name)
        self.description = str(record.description or '')
        self.inputs = [PortDefinition(**port) for port in (record.inputs or [])]
        self.outputs = [PortDefinition(**port) for port in (record.outputs or [])]
        self.settings_schema = []

    def definition(self) -> NodeDefinition:
        return super().definition()

    def run(self, node, inputs, settings, context):
        input_values = _collect_inputs(inputs, list(self.record.inputs or []))
        result = _run_custom_code(
            str(self.record.code),
            {'inputs': input_values, 'template': self.record.template, 'settings': settings},
        )
        raw = result.get('result')
        output_defs = list(self.record.outputs or []) or [{'id': 'output', 'name': 'Output', 'type': 'json', 'required': False, 'multiple': False}]
        mapped = raw if isinstance(raw, dict) and any(str(item.get('id')) in raw for item in output_defs) else {str(output_defs[0].get('id') or 'output'): raw}

        runtime: dict[str, Any] = {'stdout': result.get('stdout'), 'stderr': result.get('stderr')}
        visible: list[dict[str, Any]] = []
        for index, port_def in enumerate(output_defs):
            port_id = str(port_def.get('id') or f'output_{index + 1}')
            port_name = str(port_def.get('name') or port_id)
            port_type = str(port_def.get('type') or 'json')
            value = mapped.get(port_id)
            frame = _as_dataframe(value) if port_type == 'dataframe' else None
            if frame is not None:
                runtime[port_id] = frame
                if '_df' not in runtime:
                    runtime['_df'] = frame
                visible.append(table_output(str(node['id']), f'{self.name} · {port_name}', frame, 100))
            else:
                runtime[port_id] = value
                visible.append(output(str(node['id']), f'{self.name} · {port_name}', 'json', value=safe_json(value)))
        runtime['outputs'] = visible
        runtime['output'] = visible[0] if visible else output(str(node['id']), self.name, 'json', value=None)
        return runtime

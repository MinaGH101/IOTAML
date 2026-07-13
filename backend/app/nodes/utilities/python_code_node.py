from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import Any

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import first_json_payload, first_upstream_df, json_output, node_label, safe_json, table_output


def _validate_code(code: str) -> None:
    blocked_imports = {'os', 'sys', 'subprocess', 'socket', 'requests', 'pathlib', 'shutil', 'pickle', 'ctypes', 'multiprocessing', 'threading'}
    blocked_calls = {'open', 'exec', 'eval', 'compile', '__import__', 'input'}
    tree = ast.parse(code)
    for item in ast.walk(tree):
        if isinstance(item, (ast.Import, ast.ImportFrom)):
            names = [alias.name.split('.')[0] for alias in item.names] if isinstance(item, ast.Import) else [str(item.module or '').split('.')[0]]
            banned = blocked_imports.intersection(names)
            if banned:
                raise ValueError(f'Blocked import in Python Code node: {", ".join(sorted(banned))}')
        if isinstance(item, ast.Call) and isinstance(item.func, ast.Name) and item.func.id in blocked_calls:
            raise ValueError(f'Blocked call in Python Code node: {item.func.id}')


def _run_code(code: str, input_data: Any, timeout: int, memory_mb: int) -> dict[str, Any]:
    _validate_code(code)
    wrapper = textwrap.dedent('''
    import json, math, statistics, socket

    def __blocked_network__(*args, **kwargs):
        raise PermissionError("Network access is disabled inside Python Code nodes.")

    socket.create_connection = __blocked_network__
    __original_socket__ = socket.socket

    class __RestrictedSocket__(__original_socket__):
        def connect(self, *args, **kwargs):
            return __blocked_network__(*args, **kwargs)
        def connect_ex(self, *args, **kwargs):
            __blocked_network__(*args, **kwargs)
            return 1

    socket.socket = __RestrictedSocket__
    input_data = json.loads(__INPUT_JSON__)
    def __user_fn__():
    __USER_CODE__
    result = __user_fn__()
    print(json.dumps({'result': result}, default=str))
    ''')
    indented = '\n'.join('    ' + line if line.strip() else '    pass' for line in code.splitlines())
    script = wrapper.replace('__INPUT_JSON__', repr(json.dumps(input_data, default=str))).replace('__USER_CODE__', indented)
    with tempfile.TemporaryDirectory(prefix='iota-code-') as tmp:
        script_path = Path(tmp) / 'code_node.py'
        script_path.write_text(script, encoding='utf-8')
        env = {'PYTHONNOUSERSITE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
        preexec = None
        if os.name == 'posix':
            def limit_resources():
                import resource
                resource.setrlimit(resource.RLIMIT_AS, (memory_mb * 1024 * 1024, memory_mb * 1024 * 1024))
                resource.setrlimit(resource.RLIMIT_CPU, (max(1, timeout), max(1, timeout + 1)))
            preexec = limit_resources
        proc = subprocess.run([sys.executable, '-I', '-S', str(script_path)], cwd=tmp, env=env, capture_output=True, text=True, timeout=timeout, preexec_fn=preexec)
    if proc.returncode != 0:
        raise RuntimeError(f'Python Code node failed: {proc.stderr[-2000:]}')
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    parsed = json.loads(lines[-1]) if lines else {'result': None}
    return {'stdout': '\n'.join(lines[:-1]), 'stderr': proc.stderr, 'result': parsed.get('result')}


class PythonCodeNode(BaseNode):
    id = 'UT-001'
    name = 'Python Code'
    category = 'Utilities / Advanced'
    description = 'Runs restricted Python code over input JSON/table preview data.'
    inputs = [port('input', 'Input', 'any')]
    outputs = [port('json', 'JSON Result', 'json'), port('dataframe', 'DataFrame', 'dataframe', required=False)]
    execution_mode = 'sandboxed'
    settings_schema = [
        setting('code', 'Code', 'code', 'return input_data', required=True),
        setting('timeout', 'Timeout Seconds', 'integer', 30),
        setting('memory_limit', 'Memory MB', 'integer', 256),
    ]

    def run(self, node, inputs, settings, context):
        df = first_upstream_df(inputs)
        input_data = safe_json(df.head(1000)) if df is not None else first_json_payload(inputs)
        result = _run_code(str(settings.get('code') or 'return input_data'), input_data, int(settings.get('timeout') or 30), int(settings.get('memory_limit') or 256))
        value = result.get('result')
        if isinstance(value, list) and value and isinstance(value[0], dict):
            import pandas as pd
            out_df = pd.DataFrame(value)
            return {'_df': out_df, 'json': result, 'stdout': result.get('stdout'), 'stderr': result.get('stderr'), 'output': table_output(str(node['id']), node_label(node), out_df, 100)}
        return {'json': result, 'stdout': result.get('stdout'), 'stderr': result.get('stderr'), 'output': json_output(str(node['id']), node_label(node), result)}

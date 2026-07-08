from __future__ import annotations

import re
from typing import Any

EXPR_RE = re.compile(r"{{\s*(.*?)\s*}}")

class ExpressionError(ValueError):
    pass


def _path_get(value: Any, path: str) -> Any:
    if path == '':
        return value
    token_re = re.compile(r"(?:\.([A-Za-z_][\w-]*))|(?:\[['\"]([^'\"]+)['\"]\])")
    pos = 0
    current = value
    for match in token_re.finditer(path):
        if match.start() != pos:
            raise ExpressionError(f'Invalid expression path near {path[pos:]}')
        key = match.group(1) or match.group(2)
        if isinstance(current, dict):
            if key not in current:
                raise ExpressionError(f'Cannot resolve key: {key}')
            current = current[key]
        else:
            try:
                current = getattr(current, key)
            except Exception as exc:
                raise ExpressionError(f'Cannot resolve key: {key}') from exc
        pos = match.end()
    if pos != len(path):
        raise ExpressionError(f'Invalid expression path near {path[pos:]}')
    return current


def resolve_reference(expr: str, context: dict[str, Any]) -> Any:
    expr = expr.strip()
    if '??' in expr:
        left, fallback = [x.strip() for x in expr.split('??', 1)]
        try:
            return resolve_reference(left, context)
        except ExpressionError:
            return fallback.strip('"\'')
    if expr == '$execution.id':
        return context.get('execution', {}).get('id')
    if expr.startswith('$execution'):
        return _path_get(context.get('execution', {}), expr[len('$execution'):])
    if expr == '$project.id':
        return context.get('project', {}).get('id')
    if expr.startswith('$project'):
        return _path_get(context.get('project', {}), expr[len('$project'):])
    if expr == '$json':
        return context.get('json')
    if expr.startswith('$json'):
        return _path_get(context.get('json', {}), expr[len('$json'):])
    if expr.startswith('$node.'):
        remainder = expr[len('$node.'):]
        parts = remainder.split('.', 1)
        node_key = parts[0]
        rest = '.' + parts[1] if len(parts) == 2 else ''
        node_outputs = context.get('node', {}) or context.get('nodes', {}) or {}
        if node_key not in node_outputs:
            raise ExpressionError(f'Cannot resolve node output: {node_key}')
        return _path_get(node_outputs[node_key], rest)
    raise ExpressionError(f'Unsupported expression: {expr}')


def resolve_value(value: Any, context: dict[str, Any]) -> Any:
    if isinstance(value, dict) and value.get('mode') == 'dynamic':
        return resolve_value(value.get('expression') or '', context)
    if isinstance(value, str):
        matches = list(EXPR_RE.finditer(value))
        if not matches:
            return value
        if len(matches) == 1 and matches[0].span() == (0, len(value)):
            return resolve_reference(matches[0].group(1), context)
        out = value
        for match in matches:
            replacement = resolve_reference(match.group(1), context)
            out = out.replace(match.group(0), '' if replacement is None else str(replacement))
        return out
    if isinstance(value, list):
        return [resolve_value(item, context) for item in value]
    if isinstance(value, dict):
        return {key: resolve_value(item, context) for key, item in value.items()}
    return value


def resolve_settings(settings: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    return {key: resolve_value(value, context) for key, value in (settings or {}).items()}

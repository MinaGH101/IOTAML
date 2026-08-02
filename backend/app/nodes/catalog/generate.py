"""Generate and verify the frontend-facing node catalog from live definitions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from app.nodes.registry import all_node_runners, catalog_metadata, validate_registry_integrity

OUTPUT_PATH = Path(__file__).with_name('generated_catalog.json')
ALLOWED_SETTING_TYPES = {
    'text', 'textarea', 'number', 'integer', 'boolean', 'select', 'columns',
    'column', 'dataset', 'json', 'code', 'color', 'file', 'password', 'slider',
    'multiselect', 'data_file', 'replacement_blocks', 'imputation_blocks',
    'input_dataframe', 'float', 'normalization_blocks', 'scatter_blocks',
    'row_values', 'series_colors', 'interactive_table_state',
}


def _matches_default(setting_type: str, value: Any) -> bool:
    if value is None:
        return True
    if setting_type in {'text', 'textarea', 'select', 'column', 'dataset', 'code', 'color', 'file', 'password'}:
        return isinstance(value, (str, int))
    if setting_type in {'columns', 'multiselect', 'replacement_blocks', 'imputation_blocks', 'normalization_blocks', 'scatter_blocks', 'row_values'}:
        return isinstance(value, (list, str))
    if setting_type in {'series_colors', 'interactive_table_state'}:
        return isinstance(value, dict)
    if setting_type in {'data_file', 'input_dataframe'}:
        return isinstance(value, (str, int))
    if setting_type in {'number', 'slider', 'float'}:
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if setting_type == 'integer':
        return isinstance(value, int) and not isinstance(value, bool)
    if setting_type == 'boolean':
        return isinstance(value, bool)
    if setting_type == 'json':
        return isinstance(value, (dict, list, str))
    return False


def build_catalog() -> dict[str, Any]:
    validate_registry_integrity()
    nodes = all_node_runners()
    seen_ids: set[str] = set()
    problems: list[str] = []
    for node in nodes:
        if not node.id or node.id in seen_ids:
            problems.append(f'duplicate or empty node id: {node.id!r}')
        seen_ids.add(node.id)
        if not str(node.cache_version).strip():
            problems.append(f'{node.id}: implementation/cache version is missing')
        for side, ports in (('input', node.inputs), ('output', node.outputs)):
            names = [port.id for port in ports]
            duplicates = {name for name in names if names.count(name) > 1}
            if duplicates:
                problems.append(f'{node.id}: duplicate {side} ports: {sorted(duplicates)}')
        for setting in node.settings_schema:
            if setting.type not in ALLOWED_SETTING_TYPES:
                problems.append(f'{node.id}.{setting.name}: invalid setting type {setting.type!r}')
            if not _matches_default(setting.type, setting.default):
                problems.append(f'{node.id}.{setting.name}: default does not match {setting.type}')
            if setting.type == 'select' and setting.options and setting.default not in [None, ''] and setting.default not in setting.options:
                problems.append(f'{node.id}.{setting.name}: select default is not an allowed option')
            if setting.required and not setting.label:
                problems.append(f'{node.id}.{setting.name}: required parameter is missing a label')
    if problems:
        raise RuntimeError('Invalid node catalog:\n- ' + '\n- '.join(problems))
    return {
        **catalog_metadata(),
        'nodes': [node.to_api() for node in nodes],
    }


def render_catalog() -> str:
    return json.dumps(build_catalog(), ensure_ascii=False, sort_keys=True, indent=2) + '\n'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Fail if generated output is stale.')
    args = parser.parse_args()
    expected = render_catalog()
    if args.check:
        current = OUTPUT_PATH.read_text(encoding='utf-8') if OUTPUT_PATH.exists() else ''
        if current != expected:
            raise SystemExit('Node catalog is stale. Run: python -m app.nodes.catalog.generate')
        return 0
    OUTPUT_PATH.write_text(expected, encoding='utf-8')
    print(f'Wrote {OUTPUT_PATH}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

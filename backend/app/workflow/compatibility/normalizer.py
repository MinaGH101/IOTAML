"""Normalize every persisted workflow format into the canonical runtime graph."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.nodes.registry import LEGACY_NODE_ALIASES, canonical_node_id, get_node_runner

LEGACY_PREFIXES = ('data_', 'transform_', 'analysis_', 'model_', 'feature_')
DEMO_DATASETS = {
    'data_demo': 'iris',
    'data_demo_iris': 'iris',
    'data_demo_wine': 'wine',
    'data_demo_breast_cancer': 'breast_cancer',
}
SCALER_METHODS = {
    'transform_standard_scaler': 'standard',
    'transform_minmax_scaler': 'minmax',
    'transform_robust_scaler': 'robust',
}


def _registry_id(node: dict[str, Any] | None) -> str:
    data = (node or {}).get('data') or {}
    return canonical_node_id(str(data.get('registryId') or data.get('catalogId') or (node or {}).get('type') or ''))


def upgrade_editable_graph(graph: dict[str, Any]) -> dict[str, Any]:
    """Upgrade editable graphs whose old RV-003 node still owns PDF/OCR work.

    The migration is defensive and idempotent. Historical runs remain untouched;
    only a graph being created, updated, autosaved, or restored is upgraded.
    """
    upgraded = deepcopy(graph or {})
    nodes = upgraded.get('nodes')
    edges = upgraded.get('edges')
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return upgraded
    by_id = {str(node.get('id')): node for node in nodes if isinstance(node, dict) and node.get('id') is not None}
    ocr_runner = get_node_runner('RV-011')
    extract_runner = get_node_runner('RV-003')
    if ocr_runner is None or extract_runner is None:
        return upgraded
    ocr_definition = ocr_runner.to_api()
    extract_definition = extract_runner.to_api()

    for extract in list(nodes):
        if not isinstance(extract, dict) or _registry_id(extract) != 'RV-003':
            continue
        extract_id = str(extract.get('id') or '')
        extract_data = extract.get('data') if isinstance(extract.get('data'), dict) else {}
        old_params = extract_data.get('params') if isinstance(extract_data.get('params'), dict) else {}
        extract_data.update({
            'registryId': 'RV-003',
            'catalogId': 'RV-003',
            'category': extract_definition['category'],
            'description': extract_definition['description'],
            'inputs': extract_definition['inputs'],
            'outputs': extract_definition['outputs'],
            'executionMode': extract_definition['executionMode'],
            'comingSoon': extract_definition['comingSoon'],
            'params': {
                'input_mode': old_params.get('input_mode', 'static'),
                'form_id': old_params.get('form_id', 'extraction_review'),
                'extraction_fields': old_params.get('extraction_fields', []),
                'max_document_chars': old_params.get('max_document_chars', 120000),
                'user_prompt': old_params.get('user_prompt', ''),
            },
        })
        extract['data'] = extract_data
        incoming = [edge for edge in edges if isinstance(edge, dict) and str(edge.get('target') or '') == extract_id]
        if any(_registry_id(by_id.get(str(edge.get('source') or ''))) == 'RV-011' for edge in incoming):
            for edge in incoming:
                source = by_id.get(str(edge.get('source') or ''))
                if _registry_id(source) == 'RV-011':
                    source_data = source.get('data') if isinstance(source.get('data'), dict) else {}
                    source_params = source_data.get('params') if isinstance(source_data.get('params'), dict) else {}
                    source_data['params'] = {**source_params, 'pdf_files': source_params.get('pdf_files', [])}
                    source['data'] = source_data
            continue
        legacy_edges = [edge for edge in incoming if str(edge.get('targetHandle') or 'case') == 'case']
        if not legacy_edges:
            continue

        selected_artifacts = old_params.get('artifact_id')
        selected_ids = selected_artifacts if isinstance(selected_artifacts, list) else [selected_artifacts]
        selected_ids = [value for value in selected_ids if value not in (None, '')]
        for edge in legacy_edges:
            source = by_id.get(str(edge.get('source') or ''))
            if _registry_id(source) != 'RV-001' or not selected_ids:
                continue
            source_data = source.get('data') if isinstance(source.get('data'), dict) else {}
            source_params = source_data.get('params') if isinstance(source_data.get('params'), dict) else {}
            primary = source_params.get('proposal_pdf')
            primary_ids = primary if isinstance(primary, list) else [primary]
            attachments = source_params.get('supporting_files')
            attachments = list(attachments) if isinstance(attachments, list) else []
            known = {str(value) for value in [*primary_ids, *attachments] if value not in (None, '')}
            attachments.extend(value for value in selected_ids if str(value) not in known)
            source_data['params'] = {**source_params, 'supporting_files': attachments}
            source['data'] = source_data

        base_id = f'{extract_id}-ocr'
        ocr_id = base_id
        suffix = 2
        while ocr_id in by_id:
            ocr_id = f'{base_id}-{suffix}'
            suffix += 1
        position = extract.get('position') if isinstance(extract.get('position'), dict) else {}
        max_pages = old_params.get('max_pages', 60)
        if isinstance(max_pages, bool) or not isinstance(max_pages, int):
            max_pages = 60
        ocr_node = {
            'id': ocr_id,
            'type': 'mlNode',
            'position': {'x': float(position.get('x') or 0) - 210, 'y': float(position.get('y') or 0)},
            'data': {
                'registryId': 'RV-011',
                'catalogId': 'RV-011',
                'typeLabel': ocr_definition['label'],
                'label': 'OCR Documents',
                'category': ocr_definition['category'],
                'description': ocr_definition['description'],
                'inputs': ocr_definition['inputs'],
                'outputs': ocr_definition['outputs'],
                'executionMode': ocr_definition['executionMode'],
                'comingSoon': ocr_definition['comingSoon'],
                'params': {'pdf_files': selected_ids, 'max_pages': max_pages},
            },
        }
        nodes.insert(nodes.index(extract), ocr_node)
        by_id[ocr_id] = ocr_node
        for edge in legacy_edges:
            edge['target'] = ocr_id
            edge['targetHandle'] = 'case'
        edges.append({
            'id': f'{ocr_id}-{extract_id}',
            'source': ocr_id,
            'target': extract_id,
            'sourceHandle': 'ocr_text',
            'targetHandle': 'ocr_text',
            'animated': True,
        })
    return upgraded


def is_legacy_graph(graph: dict[str, Any]) -> bool:
    """Return whether a graph contains an identifier handled by compatibility aliases."""
    for node in graph.get('nodes') or []:
        data = node.get('data') or {}
        identifier = str(data.get('registryId') or node.get('type') or '')
        if identifier in LEGACY_NODE_ALIASES or identifier.startswith(LEGACY_PREFIXES):
            return True
    return False


def normalize_graph(graph: dict[str, Any]) -> dict[str, Any]:
    """Return a defensive, idempotent canonical representation of a saved graph.

    Historical identifiers are preserved in ``data.originalRegistryId`` for
    debugging and cache lineage, while execution always uses the canonical ID.
    """
    raw = deepcopy(graph or {})
    nodes = raw.get('nodes')
    edges = raw.get('edges')
    raw['nodes'] = nodes if isinstance(nodes, list) else []
    raw['edges'] = edges if isinstance(edges, list) else []
    raw.setdefault('meta', {})
    raw['meta'] = dict(raw['meta']) if isinstance(raw['meta'], dict) else {}
    raw['meta']['runtimeGraphVersion'] = 1

    for node in raw['nodes']:
        if not isinstance(node, dict):
            continue
        data = node.get('data')
        data = dict(data) if isinstance(data, dict) else {}
        original = str(data.get('originalRegistryId') or data.get('registryId') or node.get('type') or '')
        canonical = canonical_node_id(original)
        if original and original != canonical:
            data.setdefault('originalRegistryId', original)
        data['registryId'] = canonical
        node['type'] = canonical

        params = data.get('params')
        params = dict(params) if isinstance(params, dict) else {}
        if original in DEMO_DATASETS:
            data['compatibilityDataset'] = DEMO_DATASETS[original]
        if original in SCALER_METHODS:
            params.setdefault('method', SCALER_METHODS[original])
        data['params'] = params
        node['data'] = data

    for index, edge in enumerate(raw['edges']):
        if not isinstance(edge, dict):
            continue
        edge.setdefault('id', f"compat-edge-{index}-{edge.get('source', '')}-{edge.get('target', '')}")
        source = next((node for node in raw['nodes'] if str(node.get('id') or '') == str(edge.get('source') or '')), None)
        source_id = str((source or {}).get('data', {}).get('registryId') or '')
        # MP-001 used to expose implementation details as separate graph ports.
        # Its public contract is now one model-ready split bundle, so old saved
        # workflows continue to execute without a manual reconnect.
        if source_id == 'MP-001' and str(edge.get('sourceHandle') or '') in {
            '', 'output', 'train', 'test', 'X_train', 'X_test', 'y_train', 'y_test', 'report',
        }:
            edge['sourceHandle'] = 'split'
    return raw

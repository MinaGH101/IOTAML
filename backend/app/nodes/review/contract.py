"""One compact, versioned envelope shared by review nodes."""
from __future__ import annotations

import copy
import json
import math
import re
from typing import Any

from app.nodes.io import input_by_port, node_label, output
from app.workflow.contracts.errors import NodeContractError

FIELD_ID = re.compile(r'^[a-z][a-z0-9_]{0,63}$')
FIELD_TYPES = {'text', 'long_text', 'number', 'score', 'date', 'choice', 'boolean', 'file'}
MAX_FIELDS = 60


def invalid(code: str, message: str, *, setting: str | None = None, port: str | None = None,
            expected: Any = None, actual: Any = None, fix: str = 'Correct the node configuration or connected input.') -> NodeContractError:
    return NodeContractError(code, message, category='setting' if setting else 'input', setting=setting,
                             port=port, expected=expected, actual=actual, suggested_fix=fix)


def parse_object(value: Any, *, setting: str) -> dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise invalid('REVIEW_SETTING_JSON_INVALID', f'{setting} must contain valid JSON: {exc.msg}.',
                          setting=setting, fix='Correct the JSON syntax in node settings.') from exc
    if not isinstance(value, dict):
        raise invalid('REVIEW_SETTING_OBJECT_REQUIRED', f'{setting} must be a JSON object.', setting=setting,
                      expected='object', actual=type(value).__name__)
    return value


def require_case(inputs: dict[str, Any]) -> dict[str, Any]:
    values = input_by_port(inputs, 'case')
    value = values[0] if values else None
    if not isinstance(value, dict) or value.get('schema_version') != 1 or not isinstance(value.get('case_id'), str):
        raise invalid('REVIEW_CASE_REQUIRED', 'This node needs a version 1 case from an upstream review node.',
                      port='case', expected='case schema_version=1', actual=type(value).__name__,
                      fix='Connect the Case output from Case Intake or another review node.')
    for key in ('fields', 'documents', 'forms', 'reviews', 'ai_reviews', 'decisions', 'history'):
        expected = dict if key in {'fields', 'forms'} else list
        if not isinstance(value.get(key), expected):
            raise invalid('REVIEW_CASE_SCHEMA_INVALID', f'Case property {key} has the wrong type.',
                          port='case', expected=expected.__name__, actual=type(value.get(key)).__name__,
                          fix='Use the Case output from a compatible review node.')
    return copy.deepcopy(value)


def make_case(value: dict[str, Any]) -> dict[str, Any]:
    case_id = str(value.get('case_id') or '').strip()
    if not case_id or len(case_id) > 128:
        raise invalid('REVIEW_CASE_ID_REQUIRED', 'A case ID is required (up to 128 characters).',
                      setting='case_json', fix='Add a unique case_id to the intake data.')
    fields = value.get('fields') or {}
    if not isinstance(fields, dict):
        raise invalid('REVIEW_FIELDS_INVALID', 'Case fields must be a JSON object.', setting='case_json')
    return {
        'schema_version': 1, 'case_id': case_id, 'project_id': value.get('project_id'),
        'active_form_id': value.get('active_form_id'),
        'fields': copy.deepcopy(fields), 'field_labels': copy.deepcopy(value.get('field_labels') or {}),
        'documents': copy.deepcopy(value.get('documents') or []),
        'forms': copy.deepcopy(value.get('forms') or {}), 'reviews': copy.deepcopy(value.get('reviews') or []),
        'ai_reviews': copy.deepcopy(value.get('ai_reviews') or []), 'decisions': copy.deepcopy(value.get('decisions') or []),
        'status': str(value.get('status') or 'received'), 'history': copy.deepcopy(value.get('history') or []),
    }


def validate_fields(value: Any, *, setting_name: str = 'fields') -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise invalid('REVIEW_FORM_JSON_INVALID', 'Form fields contain invalid JSON.', setting=setting_name,
                          fix='Use the form field editor or correct the JSON.') from exc
    if not isinstance(value, list) or not value or len(value) > MAX_FIELDS:
        raise invalid('REVIEW_FORM_FIELDS_INVALID', f'Provide 1 to {MAX_FIELDS} form fields.', setting=setting_name)
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for index, raw in enumerate(value):
        if not isinstance(raw, dict):
            raise invalid('REVIEW_FORM_FIELD_INVALID', f'Field {index + 1} must be an object.', setting=setting_name)
        field_id = str(raw.get('id') or '').strip()
        label = str(raw.get('label') or '').strip()
        kind = str(raw.get('type') or 'text').strip()
        if not FIELD_ID.fullmatch(field_id) or field_id in seen or not label or kind not in FIELD_TYPES:
            raise invalid('REVIEW_FORM_FIELD_INVALID', f'Field {index + 1} needs a unique snake_case ID, label, and supported type.',
                          setting=setting_name, actual=field_id, fix='Edit the field ID, label, or type in the form builder.')
        seen.add(field_id)
        field = {'id': field_id, 'label': label, 'type': kind, 'required': bool(raw.get('required', False))}
        if kind in {'number', 'score'}:
            for bound in ('min', 'max'):
                if raw.get(bound) not in (None, ''):
                    try:
                        field[bound] = float(raw[bound])
                    except (TypeError, ValueError) as exc:
                        raise invalid('REVIEW_FORM_BOUND_INVALID', f'{label}: {bound} must be numeric.', setting=setting_name) from exc
            if 'min' in field and 'max' in field and field['min'] > field['max']:
                raise invalid('REVIEW_FORM_BOUND_INVALID', f'{label}: minimum exceeds maximum.', setting=setting_name)
            if kind == 'score' and ('max' not in field or field['max'] <= 0 or field.get('min', 0) < 0):
                raise invalid('REVIEW_SCORE_BOUNDS_INVALID', f'{label}: score needs a positive maximum and a nonnegative minimum.',
                              setting=setting_name, fix='Set score minimum to zero or higher and give it a positive maximum.')
        if kind == 'choice':
            choices = raw.get('choices') or []
            if not isinstance(choices, list) or not choices or not all(isinstance(x, str) and x.strip() for x in choices):
                raise invalid('REVIEW_FORM_CHOICES_INVALID', f'{label}: add at least one choice.', setting=setting_name)
            field['choices'] = list(dict.fromkeys(x.strip() for x in choices))
        result.append(field)
    return result


def validate_response(fields: list[dict[str, Any]], response: dict[str, Any]) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    allowed = {field['id'] for field in fields}
    for key in response:
        if key not in allowed:
            errors.append({'field': key, 'code': 'unknown_field', 'message': 'Field is not in the published form.'})
    for field in fields:
        key = field['id']
        value = response.get(key)
        if value is None or value == '':
            if field['required']:
                errors.append({'field': key, 'code': 'required', 'message': f"{field['label']} is required."})
            continue
        kind = field['type']
        if kind in {'number', 'score'} and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)):
            errors.append({'field': key, 'code': 'type', 'message': f"{field['label']} must be numeric."})
        elif kind in {'number', 'score'} and ('min' in field and value < field['min'] or 'max' in field and value > field['max']):
            errors.append({'field': key, 'code': 'range', 'message': f"{field['label']} is outside its allowed range."})
        elif kind == 'boolean' and not isinstance(value, bool):
            errors.append({'field': key, 'code': 'type', 'message': f"{field['label']} must be yes or no."})
        elif kind == 'choice' and value not in field['choices']:
            errors.append({'field': key, 'code': 'choice', 'message': f"{field['label']} has an unsupported choice."})
        elif kind in {'text', 'long_text', 'date', 'file'} and not isinstance(value, str):
            errors.append({'field': key, 'code': 'type', 'message': f"{field['label']} must be text."})
    return errors


def case_result(node: dict[str, Any], case: dict[str, Any], *, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
    preview = {'case_id': case['case_id'], 'status': case['status'], 'fields': case['fields'],
               'field_labels': case.get('field_labels') or {},
               'documents': [{'artifact_id': x.get('artifact_id'), 'filename': x.get('filename'),
                              'pages': x.get('pages'), 'primary': x.get('primary', False)} for x in case['documents']],
               'reviews': len(case['reviews']), 'ai_reviews': len(case['ai_reviews']), 'decisions': len(case['decisions'])}
    if extra:
        preview.update(extra)
    return {'case': case, 'output': output(str(node['id']), node_label(node), 'review_stage',
                                           stage=registry_id, **preview), 'visible_outputs_only': True}


def case_batch_result(node: dict[str, Any], results: list[dict[str, Any]]) -> dict[str, Any]:
    """Keep case execution independent while exposing one compact node output."""
    cases = [item['case'] for item in results if isinstance(item.get('case'), dict)]
    previews = [item['output'] for item in results if isinstance(item.get('output'), dict)]
    registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
    value: dict[str, Any] = {
        'case': {'schema_version': 1, 'kind': 'case_batch', 'cases': cases},
        'output': output(str(node['id']), node_label(node), 'review_batch',
                         stage=registry_id, case_count=len(cases), cases=previews),
        'visible_outputs_only': True,
    }
    intents = [item['_review_task_intent'] for item in results
               if isinstance(item.get('_review_task_intent'), dict)]
    if intents:
        value['_review_task_intents'] = intents
    return value


def cases_from_batch(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, dict) or value.get('kind') != 'case_batch':
        return None
    cases = value.get('cases')
    return [case for case in cases if isinstance(case, dict)] if isinstance(cases, list) else None

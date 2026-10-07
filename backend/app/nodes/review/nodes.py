"""Typed, reusable building blocks for proposal and other case reviews."""
from __future__ import annotations

import base64
import json
import math
import re
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import input_by_port, node_label, output
from app.workflow.contracts.errors import NodeContractError

from .ai import ask_json, ocr_image
from .contract import case_batch_result, case_result, invalid, make_case, parse_object, require_case, validate_fields, validate_response


def _text(value: Any, limit: int = 3000) -> str:
    return str(value or '').strip()[:limit]


def _rubric_fields(form: dict[str, Any]) -> list[dict[str, Any]]:
    fields = form['fields']
    explicit = [field for field in fields if field['type'] == 'score']
    return explicit or [field for field in fields if field['type'] == 'number']


def _requested_extraction_values(result: dict[str, Any], requested_ids: set[str]) -> dict[str, Any]:
    """Normalize common model JSON shapes and discard keys outside the requested contract."""
    values: Any = result.get('fields')
    if not isinstance(values, (dict, list)):
        values = next((result.get(key) for key in ('extracted_fields', 'extraction', 'data')
                       if isinstance(result.get(key), (dict, list))), None)
    if values is None and any(field_id in result for field_id in requested_ids):
        values = result
    if isinstance(values, list):
        normalized: dict[str, Any] = {}
        for item in values:
            if not isinstance(item, dict):
                continue
            field_id = item.get('id') or item.get('field_id') or item.get('name')
            if field_id in requested_ids:
                normalized[str(field_id)] = item.get('value')
        values = normalized
    if not isinstance(values, dict):
        return {}
    return {field_id: values[field_id] for field_id in requested_ids if field_id in values}


DEFAULT_INTAKE_FIELDS = [
    {'id': 'project_code', 'label': 'کد پروژه', 'type': 'text', 'value': ''},
    {'id': 'project_title', 'label': 'عنوان پروژه', 'type': 'text', 'value': ''},
    {'id': 'proposer', 'label': 'واحد پیشنهاددهنده', 'type': 'text', 'value': ''},
    {'id': 'project_manager', 'label': 'مدیر پروژه', 'type': 'text', 'value': ''},
    {'id': 'reviewer', 'label': 'داور', 'type': 'text', 'value': ''},
    {'id': 'project_type', 'label': 'نوع پروژه', 'type': 'text', 'value': ''},
    {'id': 'project_area', 'label': 'حوزه پروژه', 'type': 'text', 'value': ''},
    {'id': 'start_date', 'label': 'تاریخ شروع', 'type': 'text', 'value': ''},
    {'id': 'duration_months', 'label': 'مدت اجرا (ماه)', 'type': 'number', 'value': None},
    {'id': 'requested_budget', 'label': 'بودجه (میلیون ریال)', 'type': 'number', 'value': None},
    {'id': 'project_goal', 'label': 'هدف پروژه', 'type': 'text', 'value': ''},
]


def _intake_values(definitions: Any) -> tuple[dict[str, Any], dict[str, str]]:
    from .contract import FIELD_ID, MAX_FIELDS
    if not isinstance(definitions, list) or len(definitions) > MAX_FIELDS:
        raise invalid('REVIEW_INTAKE_FIELDS_INVALID', f'Intake needs at most {MAX_FIELDS} fields.',
                      setting='intake_fields', fix='Add fields with the Intake field editor.')
    fields: dict[str, Any] = {}
    labels: dict[str, str] = {}
    for index, item in enumerate(definitions):
        if not isinstance(item, dict):
            raise invalid('REVIEW_INTAKE_FIELD_INVALID', f'Intake field {index + 1} is invalid.',
                          setting='intake_fields', fix='Edit or remove this field in the Intake field editor.')
        field_id = str(item.get('id') or '').strip()
        label = str(item.get('label') or '').strip()
        kind = str(item.get('type') or '').strip()
        if not FIELD_ID.fullmatch(field_id) or field_id in labels or not label or len(label) > 120 or kind not in {'text', 'number'}:
            raise invalid('REVIEW_INTAKE_FIELD_INVALID', f'Intake field {index + 1} needs a unique ID, name, and text or number type.',
                          setting='intake_fields', actual=field_id,
                          fix='Edit this field name or type; use a unique field ID.')
        labels[field_id] = label
        value = item.get('value')
        if value is None or value == '':
            continue
        if kind == 'text':
            if not isinstance(value, str):
                raise invalid('REVIEW_INTAKE_VALUE_INVALID', f'{label} must be text.',
                              setting='intake_fields', actual=field_id,
                              fix='Enter text in this Intake field.')
            fields[field_id] = value.strip()[:10000]
        else:
            if isinstance(value, bool):
                raise invalid('REVIEW_INTAKE_VALUE_INVALID', f'{label} must be a number.',
                              setting='intake_fields', actual=field_id,
                              fix='Enter a valid number in this Intake field.')
            try:
                number = float(value)
            except (TypeError, ValueError) as exc:
                raise invalid('REVIEW_INTAKE_VALUE_INVALID', f'{label} must be a number.',
                              setting='intake_fields', actual=field_id,
                              fix='Enter a valid number in this Intake field.') from exc
            if not math.isfinite(number) or (field_id in {'requested_budget', 'duration_months'} and number < 0):
                raise invalid('REVIEW_INTAKE_VALUE_INVALID', f'{label} must be finite and nonnegative.',
                              setting='intake_fields', actual=field_id,
                              fix='Enter a valid nonnegative number in this Intake field.')
            fields[field_id] = number
    return fields, labels


def _input_mode(settings: dict[str, Any], *, default: str = 'static') -> str:
    mode = settings.get('input_mode', default)
    if mode not in {'static', 'dynamic'}:
        raise invalid('REVIEW_INPUT_MODE_INVALID', 'Choose static or dynamic input mode.',
                      setting='input_mode', fix='Select a mode from the node settings.')
    return mode


def _field_form_result(node: dict[str, Any], case: dict[str, Any], form: dict[str, Any], context: Any) -> dict[str, Any]:
    result = case_result(node, case)
    result['output']['kind'] = 'review_form'
    result['output'].update({'form_id': form['form_id'], 'form_title': form['title'],
                             'form_fields': form['fields'], 'field_count': len(form['fields']),
                             'project_id': case.get('project_id'), 'run_id': getattr(context, 'execution_id', None),
                             'input_mode': 'dynamic'})
    return result


def _form_id(value: Any, *, setting_name: str = 'form_id') -> str:
    from .contract import FIELD_ID
    result = _text(value, 64)
    if not FIELD_ID.fullmatch(result):
        raise invalid('REVIEW_FORM_ID_INVALID', 'Form ID must use lowercase letters, digits and underscores.',
                      setting=setting_name, fix='Choose a stable snake_case form ID.')
    return result


def _publish_form(case: dict[str, Any], form: dict[str, Any], *, setting_name: str) -> None:
    previous = case['forms'].get(form['form_id'])
    if previous and previous != form:
        raise invalid('REVIEW_PUBLISHED_FORM_CHANGED', f"Form {form['form_id']} already has a different definition in this case.",
                      setting=setting_name, fix='Create a new form ID for changed fields; keep submitted answers tied to the old version.')
    case['forms'][form['form_id']] = form
    # Keep the form produced most recently on this branch. An assignment node
    # can then follow its connected form node without asking users to repeat a
    # technical ID when the case already contains other forms.
    case['active_form_id'] = form['form_id']


def _static_form_values(raw_fields: Any, fields: list[dict[str, Any]], *, setting_name: str,
                        require_complete: bool = False) -> dict[str, Any]:
    if not isinstance(raw_fields, list):
        raise invalid('REVIEW_STATIC_FORM_FIELDS_INVALID', 'Static form fields must be a list.', setting=setting_name)
    values = {field['id']: raw.get('value') for raw, field in zip(raw_fields, fields)
              if isinstance(raw, dict) and raw.get('value') not in (None, '')}
    errors = validate_response(fields if require_complete else [{**field, 'required': False} for field in fields], values)
    if errors:
        raise invalid('REVIEW_STATIC_FORM_VALUES_INVALID', 'Some static field values are invalid.',
                      setting=setting_name, actual=errors[:10], fix='Correct the values, types, or allowed ranges in the field editor.')
    return values


class CaseIntakeNode(BaseNode):
    id = 'RV-001'
    name = 'Case Intake'
    category = 'Review Workflows'
    description = 'Start a case with proposal details and uploaded documents; JSON input remains optional for integrations.'
    inputs = [port('submission', 'Submission', 'json', required=False)]
    outputs = [port('case', 'Case', 'case')]
    cacheable = False
    settings_schema = [
        setting('proposal_pdf', 'فایل اصلی طرح (PDF)', 'artifact_pdf', None, supports_dynamic=False),
        setting('supporting_files', 'فایل‌های پیوست', 'artifact_files', [], supports_dynamic=False),
        setting('input_mode', 'روش تکمیل اطلاعات', 'select', 'static', options=['static', 'dynamic'], supports_dynamic=False,
                help='ثابت: مقدارها همین‌جا وارد می‌شوند. پویا: فرم قابل ارجاع ساخته می‌شود.'),
        setting('form_id', 'شناسه فرم دریافت', 'text', 'project_intake', supports_dynamic=False),
        setting('intake_fields', 'فیلدهای ثبت پروژه', 'case_intake_fields', DEFAULT_INTAKE_FIELDS,
                supports_dynamic=False),
        setting('id_prefix', 'پیشوند کد خودکار', 'text', 'RDI', supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        selected_pdfs = settings.get('proposal_pdf')
        if isinstance(selected_pdfs, list):
            if not selected_pdfs or len(selected_pdfs) > 100:
                raise invalid('REVIEW_PDF_BATCH_INVALID', 'Select between 1 and 100 proposal PDFs.', setting='proposal_pdf')
            metadata = getattr(context, 'artifact_metadata', {}) or {}
            results = []
            seen_case_ids: set[str] = set()
            for raw_id in selected_pdfs:
                item = metadata.get(str(raw_id)) or {}
                stem = Path(str(item.get('filename') or f'case-{raw_id}')).stem
                case_id = re.sub(r'[^A-Za-z0-9_-]+', '-', stem).strip('-') or f'CASE-{raw_id}'
                if case_id.lower() in seen_case_ids:
                    case_id = f'{case_id}-{raw_id}'
                seen_case_ids.add(case_id.lower())
                child = dict(settings)
                child['proposal_pdf'] = raw_id
                definitions = child.get('intake_fields')
                batch_fields: dict[str, Any] = {}
                batch_labels: dict[str, str] = {}
                if isinstance(definitions, list):
                    definitions = [dict(field) if isinstance(field, dict) else field for field in definitions]
                    for field in definitions:
                        if isinstance(field, dict) and field.get('id') == 'project_code': field['value'] = case_id
                        if isinstance(field, dict) and field.get('id') == 'project_title' and not field.get('value'): field['value'] = stem
                        if isinstance(field, dict) and field.get('id') and field.get('label'):
                            batch_labels[str(field['id'])] = str(field['label'])
                            if field.get('value') not in (None, ''):
                                batch_fields[str(field['id'])] = field['value']
                    child['intake_fields'] = definitions
                batch_fields.update({'project_code': case_id, 'project_title': batch_fields.get('project_title') or stem})
                child['case_json'] = json.dumps({'case_id': case_id, 'fields': batch_fields,
                                                 'field_labels': batch_labels}, ensure_ascii=False)
                results.append(self.run(node, inputs, child, context))
            return case_batch_result(node, results)
        mode = _input_mode(settings)
        auto_case_id = False
        connected = input_by_port(inputs, 'submission')
        raw = connected[0] if connected else settings.get('case_json')
        if isinstance(raw, list):
            if len(raw) != 1:
                raise invalid('REVIEW_SINGLE_CASE_REQUIRED', 'Case Intake accepts exactly one submission per run.', port='submission',
                              actual=len(raw), fix='Send one JSON object or run each proposal separately.')
            raw = raw[0]
        if isinstance(raw, dict) and isinstance(raw.get('json'), dict):
            raw = raw['json']
        if raw is not None and raw != '':
            submission = parse_object(raw, setting='case_json' if not connected else 'submission')
        else:
            if 'intake_fields' in settings:
                definitions = settings['intake_fields']
                if mode == 'dynamic' and isinstance(definitions, list):
                    definitions = [{**item, 'value': None} if isinstance(item, dict) else item for item in definitions]
                fields, labels = _intake_values(definitions)
                project_code = str(fields.get('project_code') or settings.get('case_id') or '').strip()
                if len(project_code) > 128:
                    raise invalid('REVIEW_CASE_ID_INVALID', 'Project code must be at most 128 characters.',
                                  setting='intake_fields', fix='Shorten the project code field.')
                submission = {'case_id': project_code,
                              'fields': fields, 'field_labels': labels}
            else:
                fields = {}
                for setting_name, field_id in [('title', 'project_title'), ('proposer', 'proposer'), ('summary', 'summary')]:
                    value = _text(settings.get(setting_name), 10000 if setting_name == 'summary' else 500)
                    if value:
                        fields[field_id] = value
                budget = settings.get('requested_budget')
                if budget not in (None, ''):
                    try:
                        amount = float(budget)
                    except (TypeError, ValueError) as exc:
                        raise invalid('REVIEW_BUDGET_INVALID', 'Requested budget must be a number.', setting='requested_budget') from exc
                    if not math.isfinite(amount) or amount < 0:
                        raise invalid('REVIEW_BUDGET_INVALID', 'Requested budget must be a finite, nonnegative number.', setting='requested_budget')
                    fields['requested_budget'] = amount
                submission = {'case_id': _text(settings.get('case_id'), 128), 'fields': fields}
        if not str(submission.get('case_id') or '').strip() and isinstance(submission.get('fields'), dict):
            submission['case_id'] = _text(submission['fields'].get('project_code'), 128)
        if not str(submission.get('case_id') or '').strip() and getattr(context, 'execution_id', None) is not None:
            prefix = _text(settings.get('id_prefix') or 'RDI', 32)
            if not prefix or not all(char.isalnum() or char in '-_' for char in prefix):
                raise invalid('REVIEW_CASE_PREFIX_INVALID', 'Automatic case ID prefix must use letters, numbers, - or _ only.',
                              setting='id_prefix')
            submission['case_id'] = f'{prefix}-{context.execution_id}'
            auto_case_id = True
        case = make_case(submission)
        case['auto_case_id'] = auto_case_id
        if 'project_code' in case.get('field_labels', {}):
            case['fields']['project_code'] = case['case_id']
        case['project_id'] = getattr(context, 'project_id', None)
        metadata = getattr(context, 'artifact_metadata', {}) or {}
        primary = settings.get('proposal_pdf')
        attachments = settings.get('supporting_files') or []
        if not isinstance(attachments, list) or len(attachments) > 20:
            raise invalid('REVIEW_ATTACHMENTS_INVALID', 'Select no more than 20 supporting files.', setting='supporting_files')
        selected = ([primary] if primary not in (None, '') else []) + attachments
        if len({str(value) for value in selected}) != len(selected):
            raise invalid('REVIEW_DOCUMENT_DUPLICATE', 'A file was selected more than once.', setting='supporting_files')
        for index, raw_id in enumerate(selected):
            try:
                artifact_id = int(raw_id)
            except (TypeError, ValueError) as exc:
                raise invalid('REVIEW_ARTIFACT_ID_INVALID', 'Select uploaded files from the picker.',
                              setting='proposal_pdf' if index == 0 and primary else 'supporting_files') from exc
            item = metadata.get(str(artifact_id))
            if not item:
                raise invalid('REVIEW_ARTIFACT_UNAVAILABLE', f'File {artifact_id} is unavailable or outside this project.',
                              setting='proposal_pdf' if index == 0 and primary else 'supporting_files',
                              fix='Upload or select a file from this project and retry.')
            is_primary = bool(primary not in (None, '') and index == 0)
            if is_primary and not str(item.get('filename', '')).lower().endswith('.pdf'):
                raise invalid('REVIEW_PRIMARY_PDF_REQUIRED', 'The main proposal must be a PDF.', setting='proposal_pdf')
            case['documents'].append({'artifact_id': artifact_id, 'filename': item['filename'],
                                      'content_type': item['content_type'],
                                      'checksum_sha256': item.get('checksum_sha256'),
                                      'primary': is_primary})
        case['history'].append({'event': 'case_received', 'node_id': str(node['id'])})
        if mode == 'dynamic':
            definitions = settings.get('intake_fields', DEFAULT_INTAKE_FIELDS)
            _, labels = _intake_values([{**item, 'value': None} if isinstance(item, dict) else item for item in definitions])
            form_fields = validate_fields([{'id': item['id'], 'label': item['label'], 'type': item['type'],
                                            'required': item['id'] != 'project_code'} for item in definitions],
                                          setting_name='intake_fields')
            form = {'form_id': _form_id(settings.get('form_id') or 'project_intake'),
                    'title': 'ثبت اطلاعات پروژه', 'fields': form_fields, 'due_days': 7,
                    'input_mode': 'dynamic', 'prefill_from_case': True}
            _publish_form(case, form, setting_name='intake_fields')
            case['field_labels'].update(labels)
            return _field_form_result(node, case, form, context)
        return case_result(node, case, extra={'input_mode': 'static'})


class ReviewFormNode(BaseNode):
    id = 'RV-002'
    name = 'Form Definition'
    category = 'Review Workflows'
    description = 'Define typed submission or reviewer fields once; downstream nodes use the same field IDs.'
    inputs = [port('case', 'Case', 'case')]
    outputs = [port('case', 'Case', 'case')]
    settings_schema = [
        setting('input_mode', 'روش تکمیل فرم', 'select', 'dynamic', options=['static', 'dynamic'], supports_dynamic=False,
                help='ثابت: پاسخ‌ها همین‌جا ثبت می‌شوند. پویا: فرم برای ارجاع به کاربران ساخته می‌شود.'),
        setting('form_id', 'شناسه ثابت فرم', 'text', 'expert_review', required=True, supports_dynamic=False),
        setting('title', 'عنوان فرم', 'text', 'Expert review', required=True, supports_dynamic=False),
        setting('fields', 'فیلدهای فرم', 'form_fields', [
            {'id': 'score', 'label': 'Score', 'type': 'score', 'required': True, 'min': 0, 'max': 100},
            {'id': 'comment', 'label': 'Comment', 'type': 'long_text', 'required': False},
        ], required=True, supports_dynamic=False),
        setting('due_days', 'مهلت پاسخ (روز)', 'integer', 7, supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        mode = _input_mode(settings, default='dynamic')
        form_id = _form_id(settings.get('form_id'))
        fields = validate_fields(settings.get('fields'))
        due_days = settings.get('due_days', 7)
        if isinstance(due_days, bool) or not isinstance(due_days, int) or not 1 <= due_days <= 365:
            raise invalid('REVIEW_FORM_DUE_INVALID', 'Due in days must be an integer from 1 to 365.', setting='due_days')
        definition = {'form_id': form_id, 'title': _text(settings.get('title'), 120), 'fields': fields,
                      'due_days': due_days, 'input_mode': mode}
        _publish_form(case, definition, setting_name='fields')
        if mode == 'static':
            if any(field['type'] == 'file' for field in fields):
                raise invalid('REVIEW_STATIC_FILE_UNSUPPORTED', 'Static forms cannot contain file-upload fields.',
                              setting='fields', fix='Use dynamic mode for file uploads, or attach a file in Case Intake.')
            values = _static_form_values(settings.get('fields'), fields, setting_name='fields', require_complete=True)
            case['fields'].update(values)
            case['field_labels'].update({field['id']: field['label'] for field in fields})
            return case_result(node, case, extra={'form_id': form_id, 'form_title': definition['title'],
                                                  'field_count': len(fields), 'input_mode': mode})
        return _field_form_result(node, case, definition, context)


class DocumentExtractNode(BaseNode):
    id = 'RV-003'
    name = 'Document Extract'
    category = 'Review Workflows'
    description = 'Extract PDF text page by page, OCR only unreadable pages, then optionally extract named fields with AI.'
    inputs = [port('case', 'Case', 'case')]
    outputs = [port('case', 'Case', 'case')]
    cacheable = False
    settings_schema = [
        setting('artifact_id', 'فایل PDF جایگزین (اختیاری)', 'artifact_pdf', None, supports_dynamic=False),
        setting('input_mode', 'روش تکمیل فیلدها', 'select', 'static', options=['static', 'dynamic'], supports_dynamic=False,
                help='ثابت: مقدارهای واردشده استفاده می‌شوند و فیلدهای خالی از PDF استخراج می‌شوند. پویا: فرم اصلاح استخراج ساخته می‌شود.'),
        setting('form_id', 'شناسه فرم اصلاح استخراج', 'text', 'extraction_review', supports_dynamic=False),
        setting('max_pages', 'حداکثر صفحه‌های خواندنی', 'integer', 60, supports_dynamic=False),
        setting('ocr_mode', 'خواندن صفحه‌های تصویری (OCR)', 'select', 'missing_text', options=['missing_text', 'off'], supports_dynamic=False),
        setting('max_ocr_pages', 'حداکثر صفحه‌های OCR', 'integer', 4, supports_dynamic=False),
        setting('extraction_fields', 'فیلدهای استخراج و بازبینی', 'form_fields', [], supports_dynamic=False),
        setting('user_prompt', 'راهنمای استخراج برای AI (اختیاری)', 'textarea', '', supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        selected_batch = settings.get('artifact_id')
        if isinstance(selected_batch, list):
            if not selected_batch or len(selected_batch) > 100:
                raise invalid('REVIEW_PDF_BATCH_INVALID', 'Select between 1 and 100 PDFs.', setting='artifact_id')
            metadata = getattr(context, 'artifact_metadata', {}) or {}
            results = []
            for raw_id in selected_batch:
                child_case = json.loads(json.dumps(case))
                item = metadata.get(str(raw_id)) or {}
                stem = Path(str(item.get('filename') or f'case-{raw_id}')).stem
                case_id = re.sub(r'[^A-Za-z0-9_-]+', '-', stem).strip('-') or f'CASE-{raw_id}'
                child_case['case_id'] = case_id
                child_case['fields'] = {**child_case.get('fields', {}), 'project_code': case_id,
                                        'project_title': child_case.get('fields', {}).get('project_title') or stem}
                if not any(str(doc.get('artifact_id')) == str(raw_id) for doc in child_case.get('documents', [])):
                    child_case.setdefault('documents', []).append({
                        'artifact_id': int(raw_id), 'filename': item.get('filename') or f'{stem}.pdf',
                        'content_type': item.get('content_type') or 'application/pdf',
                        'checksum_sha256': item.get('checksum_sha256'), 'primary': True,
                    })
                child_settings = {**settings, 'artifact_id': raw_id}
                results.append(self.run(node, {'_by_port': {'case': [child_case]}}, child_settings, context))
            return case_batch_result(node, results)
        mode = _input_mode(settings)
        selected_id = settings.get('artifact_id')
        if selected_id in (None, ''):
            selected_id = next((item.get('artifact_id') for item in case['documents'] if item.get('primary')), None)
        try:
            artifact_id = int(selected_id)
        except (TypeError, ValueError) as exc:
            raise invalid('REVIEW_ARTIFACT_ID_INVALID', 'Choose a PDF in Case Intake or in this node.', setting='artifact_id',
                          fix='Upload/select a PDF in Case Intake, or choose a PDF override here.') from exc
        path = (getattr(context, 'artifact_paths', {}) or {}).get(str(artifact_id))
        if not path or not Path(path).is_file():
            raise invalid('REVIEW_ARTIFACT_UNAVAILABLE', f'PDF artifact {artifact_id} is not available to this run.',
                          setting='artifact_id', fix='Upload the PDF to this project and select its artifact ID.')
        pdf_path = Path(path)
        if pdf_path.suffix.lower() != '.pdf':
            raise invalid('REVIEW_DOCUMENT_TYPE_INVALID', 'Document Extract accepts PDF files only.', setting='artifact_id')
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(pdf_path), strict=False)
            page_count = len(reader.pages)
        except Exception as exc:
            raise NodeContractError('REVIEW_PDF_UNREADABLE', 'The PDF could not be opened.', category='data',
                                    suggested_fix='Upload a valid, unlocked PDF and retry.') from exc
        if not page_count or page_count > get_settings().review_max_pdf_pages:
            raise NodeContractError('REVIEW_PDF_PAGE_LIMIT', f'PDF has {page_count} pages; the limit is {get_settings().review_max_pdf_pages}.',
                                    category='data', suggested_fix='Split the PDF or ask an administrator to raise the page limit.')
        max_pages = settings.get('max_pages', 60)
        max_ocr = settings.get('max_ocr_pages', 4)
        if not isinstance(max_pages, int) or not 1 <= max_pages <= get_settings().review_max_pdf_pages:
            raise invalid('REVIEW_PAGE_SETTING_INVALID', 'Maximum pages is outside the allowed range.', setting='max_pages')
        if not isinstance(max_ocr, int) or not 0 <= max_ocr <= 20:
            raise invalid('REVIEW_OCR_SETTING_INVALID', 'Maximum OCR pages must be between 0 and 20.', setting='max_ocr_pages')
        page_text: list[dict[str, Any]] = []
        ocr_count = 0
        total_chars = 0
        for page_index in range(min(page_count, max_pages)):
            try:
                extracted = (reader.pages[page_index].extract_text() or '').strip()
            except Exception as exc:
                raise NodeContractError('REVIEW_PDF_PAGE_UNREADABLE', f'PDF page {page_index + 1} could not be read.',
                                        category='data', suggested_fix='Repair or replace the PDF page and retry.') from exc
            source = 'embedded_text'
            if len(extracted) < 30 and settings.get('ocr_mode', 'missing_text') == 'missing_text':
                if ocr_count >= max_ocr:
                    raise NodeContractError('REVIEW_OCR_PAGE_LIMIT', 'More pages need OCR than the configured maximum.',
                                            category='setting', setting='max_ocr_pages',
                                            suggested_fix='Increase Maximum OCR pages or upload a searchable PDF.')
                try:
                    import pymupdf as fitz
                    with fitz.open(str(pdf_path)) as doc:
                        pix = doc[page_index].get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False)
                        image_data = base64.b64encode(pix.tobytes('jpeg', jpg_quality=72)).decode('ascii')
                except ImportError as exc:
                    raise NodeContractError('REVIEW_OCR_DEPENDENCY_MISSING', 'PDF OCR renderer is unavailable.',
                                            category='application', responsibility='application',
                                            suggested_fix='Install PyMuPDF in the backend image.') from exc
                extracted = ocr_image(image_data, page=page_index + 1, prompt=_text(settings.get('user_prompt'), 1000))
                source = 'ocr'
                ocr_count += 1
            if not extracted:
                continue
            room = get_settings().review_max_text_chars - total_chars
            if room <= 0:
                break
            excerpt = extracted[:room]
            page_text.append({'page': page_index + 1, 'text': excerpt, 'source': source})
            total_chars += len(excerpt)
        if not page_text:
            raise NodeContractError('REVIEW_PDF_TEXT_EMPTY', 'No readable text was found in the selected PDF pages.',
                                    category='data', suggested_fix='Enable OCR or upload a searchable PDF.')
        previous = next((item for item in case['documents'] if item.get('artifact_id') == artifact_id), {})
        document = {**previous, 'artifact_id': artifact_id, 'pages': page_count, 'pages_read': len(page_text),
                    'ocr_pages': ocr_count, 'page_text': page_text}
        if settings.get('extraction_fields'):
            fields = validate_fields(settings['extraction_fields'], setting_name='extraction_fields')
            case['field_labels'].update({field['id']: field['label'] for field in fields})
            manual_values = _static_form_values(settings['extraction_fields'], fields, setting_name='extraction_fields') if mode == 'static' else {}
            missing = [field for field in fields if field['id'] not in manual_values]
            result: dict[str, Any] = {}
            extracted_fields: dict[str, Any] = {}
            if missing:
                requested = [{'id': x['id'], 'label': x['label'], 'type': x['type']} for x in missing]
                excerpts = '\n'.join(f"[page {x['page']}] {x['text']}" for x in page_text)[:42000]
                result = ask_json(model=get_settings().iota_review_model,
                                  system='Extract only facts supported by the document. Return JSON with fields (object keyed by requested IDs) and evidence (object keyed by IDs, each with page and short quote). Unknown values must be null.',
                                  user=f"Requested fields: {json.dumps(requested, ensure_ascii=False)}\nInstructions: {_text(settings.get('user_prompt'), 3000)}\nDocument:\n{excerpts}",
                                  max_tokens=1600)
                extracted_fields = _requested_extraction_values(result, {x['id'] for x in missing})
                type_errors = validate_response([{**field, 'required': False} for field in missing], extracted_fields)
                if type_errors:
                    raise NodeContractError('REVIEW_EXTRACTION_TYPE_INVALID', 'AI extracted a value with the wrong field type.',
                                            category='execution', suggested_fix='Adjust the requested field type or extraction instructions and retry.',
                                            details={'errors': type_errors[:10]})
            for field in fields:
                value = manual_values.get(field['id'], extracted_fields.get(field['id']))
                if value is not None:
                    case['fields'][field['id']] = value
            document['extraction_evidence'] = result.get('evidence') if isinstance(result.get('evidence'), dict) else {}
            document['extraction_model'] = get_settings().iota_review_model if missing else None
        case['documents'] = [item for item in case['documents'] if item.get('artifact_id') != artifact_id] + [document]
        case['history'].append({'event': 'document_extracted', 'artifact_id': artifact_id, 'node_id': str(node['id'])})
        if mode == 'dynamic':
            if not settings.get('extraction_fields'):
                raise invalid('REVIEW_DYNAMIC_EXTRACTION_FIELDS_REQUIRED', 'Dynamic extraction needs at least one field.',
                              setting='extraction_fields', fix='Add fields that a user should check or correct.')
            form = {'form_id': _form_id(settings.get('form_id') or 'extraction_review'),
                    'title': 'بازبینی و اصلاح اطلاعات سند', 'fields': fields,
                    'due_days': 7, 'input_mode': 'dynamic', 'prefill_from_case': True}
            _publish_form(case, form, setting_name='extraction_fields')
            return _field_form_result(node, case, form, context)
        return case_result(node, case, extra={'pages': page_count, 'pages_read': len(page_text),
                                              'ocr_pages': ocr_count, 'input_mode': 'static'})


class CaseValidationNode(BaseNode):
    id = 'RV-004'
    name = 'Case Validation'
    category = 'Review Workflows'
    description = 'Check required fields deterministically and optionally ask AI for advisory concerns.'
    inputs = [port('case', 'Case', 'case')]
    outputs = [port('case', 'Case', 'case')]
    cacheable = False
    settings_schema = [
        setting('required_field_ids', 'Required field IDs (comma separated)', 'textarea', 'project_title', supports_dynamic=False),
        setting('user_prompt', 'Additional validation instructions for AI (optional)', 'textarea', '', supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        ids = [x.strip() for x in str(settings.get('required_field_ids') or '').replace('\n', ',').split(',') if x.strip()]
        from .contract import FIELD_ID
        if any(not FIELD_ID.fullmatch(x) for x in ids) or len(ids) != len(set(ids)):
            raise invalid('REVIEW_REQUIRED_FIELDS_INVALID', 'Required field IDs must be unique snake_case names.',
                          setting='required_field_ids', fix='Use the stable field IDs from Case Intake or Document Extract.')
        findings = [{'field': key, 'code': 'missing_required', 'message': f'{key} is missing.'}
                    for key in ids if case['fields'].get(key) in (None, '', [])]
        prompt = _text(settings.get('user_prompt'), 3000)
        advisory: list[dict[str, Any]] = []
        if prompt:
            excerpts = '\n'.join(f"[page {page['page']}] {page['text']}" for doc in case['documents'] for page in doc.get('page_text', []))[:28000]
            response = ask_json(model=get_settings().iota_review_model,
                                system='Review possible completeness and consistency concerns. Return JSON {"findings":[{"field":"...","message":"...","evidence":"..."}]}. These findings are advisory, not approval decisions.',
                                user=f"Instructions: {prompt}\nFields: {json.dumps(case['fields'], ensure_ascii=False)[:8000]}\nDocument: {excerpts}", max_tokens=1200)
            raw = response.get('findings')
            if not isinstance(raw, list):
                raise NodeContractError('REVIEW_VALIDATION_OUTPUT_INVALID', 'AI validation output needs a findings array.',
                                        category='execution', suggested_fix='Simplify the validation prompt and retry.')
            advisory = [{'field': _text(x.get('field'), 64), 'message': _text(x.get('message'), 500),
                         'evidence': _text(x.get('evidence'), 500)} for x in raw[:20] if isinstance(x, dict)]
        case['validation'] = {'valid': not findings, 'errors': findings, 'advisory': advisory,
                              'model': get_settings().iota_review_model if prompt else None}
        case['history'].append({'event': 'case_validated', 'node_id': str(node['id']), 'valid': not findings})
        return case_result(node, case, extra={'validation': {'valid': not findings, 'errors': findings[:10],
                                                          'advisory': advisory[:10]}})


class AIReviewNode(BaseNode):
    id = 'RV-005'
    name = 'AI Review'
    category = 'Review Workflows'
    description = 'Suggest rubric scores with evidence; human scores remain separate.'
    inputs = [port('case', 'Case', 'case')]
    outputs = [port('case', 'Case', 'case')]
    cacheable = False
    settings_schema = [
        setting('form_id', 'Scoring form ID', 'text', 'expert_review', required=True, supports_dynamic=False),
        setting('user_prompt', 'Review instructions for AI', 'textarea', '', required=True, supports_dynamic=False),
        setting('max_document_chars', 'Maximum document characters', 'integer', 30000, supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        form_id = _text(settings.get('form_id'), 64)
        form = case['forms'].get(form_id)
        if not form:
            raise invalid('REVIEW_FORM_NOT_FOUND', f'Scoring form {form_id} was not found in this case.',
                          setting='form_id', fix='Connect a Form Definition node with the same Form ID before AI Review.')
        rubric = _rubric_fields(form)
        if not rubric:
            raise invalid('REVIEW_RUBRIC_EMPTY', 'The scoring form has no number fields.', setting='form_id',
                          fix='Add numeric score fields with minimum and maximum values.')
        limit = settings.get('max_document_chars', 30000)
        if not isinstance(limit, int) or not 1000 <= limit <= 60000:
            raise invalid('REVIEW_DOCUMENT_LIMIT_INVALID', 'Maximum document characters must be 1,000–60,000.',
                          setting='max_document_chars')
        excerpts = '\n'.join(f"[page {page['page']}] {page['text']}" for doc in case['documents'] for page in doc.get('page_text', []))[:limit]
        if not excerpts:
            raise invalid('REVIEW_DOCUMENT_MISSING', 'AI Review needs extracted document text.', port='case',
                          fix='Connect Document Extract before AI Review.')
        result = ask_json(model=get_settings().iota_review_model,
                          system='You assist a human reviewer. Return JSON {"scores": {field_id: number}, "evidence": {field_id: {"page": number, "quote": string}}, "summary": string, "concerns": [string]}. Score only requested IDs and stay inside each range. Evidence must refer to the provided document. Do not decide approval. Write every human-readable string in Persian (Farsi).',
                          user=f"Criteria: {json.dumps(rubric, ensure_ascii=False)}\nInstructions: {_text(settings.get('user_prompt'), 3500)}\nCase fields: {json.dumps(case['fields'], ensure_ascii=False)[:8000]}\nDocument:\n{excerpts}",
                          max_tokens=2200)
        scores = result.get('scores')
        if not isinstance(scores, dict) or set(scores) != {x['id'] for x in rubric}:
            raise NodeContractError('REVIEW_AI_SCORES_INVALID', 'AI scores do not match the published scoring form.',
                                    category='execution', suggested_fix='Retry with a clearer prompt; check the scoring form IDs.')
        errors = validate_response([{**x, 'required': True} for x in rubric], scores)
        if errors:
            raise NodeContractError('REVIEW_AI_SCORE_RANGE_INVALID', 'AI returned a score outside the form limits.',
                                    category='execution', suggested_fix='Retry or adjust the review prompt.', details={'errors': errors[:10]})
        evidence = result.get('evidence') if isinstance(result.get('evidence'), dict) else {}
        maxima = {field['id']: field.get('max') for field in rubric}
        case['ai_reviews'].append({'form_id': form_id, 'scores': scores, 'maxima': maxima, 'evidence': evidence,
                                   'summary': _text(result.get('summary'), 1500),
                                   'concerns': [_text(x, 500) for x in result.get('concerns', [])[:20] if isinstance(x, str)]
                                   if isinstance(result.get('concerns'), list) else [],
                                   'model': get_settings().iota_review_model, 'node_id': str(node['id'])})
        case['history'].append({'event': 'ai_reviewed', 'node_id': str(node['id']), 'form_id': form_id})
        return case_result(node, case, extra={'ai_review': {'form_id': form_id, 'scores': scores, 'maxima': maxima,
                                                          'labels': {field['id']: field['label'] for field in rubric},
                                                          'evidence': evidence,
                                                          'summary': _text(result.get('summary'), 800),
                                                          'concerns': [_text(x, 500) for x in result.get('concerns', [])[:20] if isinstance(x, str)]
                                                          if isinstance(result.get('concerns'), list) else []}})


class RecordReviewNode(BaseNode):
    id = 'RV-006'
    name = 'Record Human Review'
    category = 'Review Workflows'
    description = 'Validate a named reviewer response against the published form and add it to the case.'
    inputs = [port('case', 'Case', 'case'), port('response', 'Reviewer response', 'json')]
    outputs = [port('case', 'Case', 'case')]
    settings_schema = [setting('form_id', 'Form ID', 'text', 'expert_review', required=True, supports_dynamic=False)]
    cacheable = False

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        form_id = _text(settings.get('form_id'), 64)
        form = case['forms'].get(form_id)
        if not form:
            raise invalid('REVIEW_FORM_NOT_FOUND', f'Form {form_id} was not found.', setting='form_id')
        values = input_by_port(inputs, 'response')
        raw = values[0] if values else None
        if isinstance(raw, list) and len(raw) == 1:
            raw = raw[0]
        if isinstance(raw, dict) and isinstance(raw.get('json'), dict):
            raw = raw['json']
        if not isinstance(raw, dict):
            raise invalid('REVIEW_RESPONSE_REQUIRED', 'Reviewer response must be a JSON object.', port='response')
        reviewer_id = _text(raw.get('reviewer_id'), 128)
        response = raw.get('answers')
        if not reviewer_id or not isinstance(response, dict):
            raise invalid('REVIEW_RESPONSE_INVALID', 'Response needs reviewer_id and answers object.', port='response')
        errors = validate_response(form['fields'], response)
        if errors:
            raise NodeContractError('REVIEW_RESPONSE_FIELDS_INVALID', 'Reviewer response does not match its form.',
                                    category='data', port='response', suggested_fix='Correct the listed fields and resubmit.',
                                    details={'errors': errors[:20]})
        if any(x['form_id'] == form_id and x['reviewer_id'] == reviewer_id for x in case['reviews']):
            raise NodeContractError('REVIEW_DUPLICATE_RESPONSE', f'{reviewer_id} has already submitted this form.',
                                    category='data', port='response', suggested_fix='Create a new review round or revise the existing response through the task interface.')
        case['reviews'].append({'form_id': form_id, 'reviewer_id': reviewer_id, 'answers': response})
        case['history'].append({'event': 'human_review_recorded', 'node_id': str(node['id']),
                                'form_id': form_id, 'reviewer_id': reviewer_id})
        return case_result(node, case, extra={'reviewer_id': reviewer_id, 'form_id': form_id})


class ScoreAggregationNode(BaseNode):
    id = 'RV-007'
    name = 'Score Aggregation'
    category = 'Review Workflows'
    description = 'Average human reviewers per criterion, then sum the criterion averages.'
    inputs = [port('case', 'Case', 'case')]
    outputs = [port('case', 'Case', 'case'), port('metrics', 'Scores', 'metrics')]
    settings_schema = [
        setting('form_id', 'Scoring form ID', 'text', 'expert_review', required=True, supports_dynamic=False),
        setting('minimum_reviewers', 'Minimum reviewers', 'integer', 1, supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        form_id = _text(settings.get('form_id'), 64)
        form = case['forms'].get(form_id)
        if not form:
            raise invalid('REVIEW_FORM_NOT_FOUND', f'Form {form_id} was not found.', setting='form_id')
        rubric = _rubric_fields(form)
        if not rubric:
            raise invalid('REVIEW_RUBRIC_EMPTY', 'Scoring form has no numeric criteria.', setting='form_id')
        minimum = settings.get('minimum_reviewers', 1)
        if not isinstance(minimum, int) or not 1 <= minimum <= 100:
            raise invalid('REVIEW_MINIMUM_INVALID', 'Minimum reviewers must be 1–100.', setting='minimum_reviewers')
        reviews = [x for x in case['reviews'] if x.get('form_id') == form_id]
        if len(reviews) < minimum:
            raise NodeContractError('REVIEW_INCOMPLETE', f'Only {len(reviews)} of {minimum} required human reviews are available.',
                                    category='data', port='case', expected=minimum, actual=len(reviews),
                                    suggested_fix='Wait for the remaining reviewers or lower the minimum in node settings.')
        criterion_scores: dict[str, float] = {}
        for field in rubric:
            values = [x.get('answers', {}).get(field['id']) for x in reviews]
            if any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in values):
                raise NodeContractError('REVIEW_SCORE_MISSING', f"A human review is missing {field['id']}.",
                                        category='data', port='case', column=field['id'],
                                        suggested_fix='Require this score in the form and complete all reviews.')
            criterion_scores[field['id']] = round(sum(values) / len(values), 2)
        maximum = round(sum(float(x.get('max', 0)) for x in rubric), 2)
        if maximum <= 0:
            raise invalid('REVIEW_SCORE_MAX_MISSING', 'Every score criterion needs a positive maximum.',
                          setting='form_id', fix='Set Maximum score on each numeric form field.')
        scores = {'form_id': form_id, 'reviewer_count': len(reviews), 'criteria': criterion_scores,
                  'labels': {field['id']: field['label'] for field in rubric},
                  'maxima': {field['id']: field.get('max') for field in rubric},
                  'total': round(sum(criterion_scores.values()), 2), 'maximum': maximum}
        case['scores'] = scores
        case['status'] = 'scored'
        case['history'].append({'event': 'scores_aggregated', 'node_id': str(node['id']), 'reviewer_count': len(reviews)})
        result = case_result(node, case, extra={'scores': scores})
        result['metrics'] = scores
        result['output'] = output(str(node['id']), node_label(node), 'review_score',
                                  case_id=case['case_id'], status=case['status'], scores=scores)
        return result


class DecisionNode(BaseNode):
    id = 'RV-008'
    name = 'Decision Record'
    category = 'Review Workflows'
    description = 'Record a human gate decision and its reason without replacing it with an AI recommendation.'
    inputs = [port('case', 'Case', 'case'), port('decision', 'Human decision', 'json')]
    outputs = [port('case', 'Case', 'case')]
    settings_schema = [setting('gate_id', 'Gate ID', 'text', 'gate_2', required=True, supports_dynamic=False)]
    cacheable = False

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        values = input_by_port(inputs, 'decision')
        raw = values[0] if values else None
        if isinstance(raw, list) and len(raw) == 1:
            raw = raw[0]
        if isinstance(raw, dict) and isinstance(raw.get('json'), dict):
            raw = raw['json']
        allowed = {'approved', 'rejected', 'revision_requested', 'continue', 'stopped'}
        if not isinstance(raw, dict) or raw.get('outcome') not in allowed or not _text(raw.get('actor_id')):
            raise invalid('REVIEW_DECISION_INVALID', 'Decision needs an outcome and actor_id.', port='decision',
                          expected=sorted(allowed), fix='Submit an authorized human decision with outcome, actor_id and reason.')
        reason = _text(raw.get('reason'), 2000)
        if raw['outcome'] in {'rejected', 'revision_requested', 'stopped'} and not reason:
            raise invalid('REVIEW_DECISION_REASON_REQUIRED', 'This decision needs a reason.', port='decision')
        decision = {'gate_id': _text(settings.get('gate_id'), 64), 'outcome': raw['outcome'],
                    'actor_id': _text(raw['actor_id'], 128), 'reason': reason}
        case['decisions'].append(decision)
        case['status'] = raw['outcome']
        case['history'].append({'event': 'decision_recorded', 'node_id': str(node['id']), **decision})
        return case_result(node, case, extra={'decision': decision})


class AssignReviewNode(BaseNode):
    id = 'RV-009'
    name = 'Assign Form Tasks'
    category = 'Review Workflows'
    description = 'Create a form task for each named user when the run completes.'
    inputs = [port('case', 'Case', 'case')]
    outputs = [port('case', 'Case', 'case')]
    cacheable = False
    settings_schema = [
        setting('form_id', 'شناسه فرم (در صورت وجود چند فرم)', 'text', '', supports_dynamic=False,
                help='اختیاری؛ فرم ساخته‌شده در همین مسیر به‌صورت خودکار انتخاب می‌شود.'),
        setting('assignees', 'کاربران مسئول تکمیل فرم', 'assignee_users', '', required=True, supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        case = require_case(inputs)
        form_id = _text(settings.get('form_id'), 64)
        if not form_id:
            active_form_id = _text(case.get('active_form_id'), 64)
            if active_form_id in case['forms']:
                form_id = active_form_id
            elif len(case['forms']) == 1:
                form_id = next(iter(case['forms']))
            else:
                raise invalid('REVIEW_FORM_SELECTION_REQUIRED', 'Choose a form ID when the case has zero or multiple forms.',
                              setting='form_id', actual=sorted(case['forms']),
                              fix='Connect a form-producing node or enter one of the available form IDs.')
        form = case['forms'].get(form_id)
        if not form:
            raise invalid('REVIEW_FORM_NOT_FOUND', f'Form {form_id} was not found.', setting='form_id')
        if form.get('input_mode') == 'static':
            raise invalid('REVIEW_STATIC_FORM_NOT_ASSIGNABLE', 'This form already has values entered in node settings.',
                          setting='form_id', fix='Switch its source node to dynamic mode before assigning it.')
        assignees = [x.strip().lower() for x in str(settings.get('assignees') or '').replace('\n', ',').split(',') if x.strip()]
        if not assignees or len(assignees) > 20 or len(set(assignees)) != len(assignees):
            raise invalid('REVIEW_ASSIGNEES_INVALID', 'Provide 1–20 distinct assignee usernames.', setting='assignees')
        intent = {'node_id': str(node['id']), 'case_id': case['case_id'], 'form_id': form_id,
                  'form': form, 'assignees': assignees,
                  'case_summary': {'case_id': case['case_id'], 'fields': case['fields'],
                                   'auto_case_id': bool(case.get('auto_case_id')),
                                   'field_labels': case.get('field_labels') or {},
                                   'documents': [{'artifact_id': x.get('artifact_id'), 'filename': x.get('filename'),
                                                  'checksum_sha256': x.get('checksum_sha256'),
                                                  'pages': x.get('pages'), 'primary': x.get('primary', False)}
                                                 for x in case['documents']]}}
        case['status'] = 'awaiting_review'
        case['history'].append({'event': 'review_assigned', 'node_id': str(node['id']), 'form_id': form_id,
                                'assignee_count': len(assignees)})
        result = case_result(node, case, extra={'assigned_reviewers': len(assignees), 'form_id': form_id})
        result['_review_task_intent'] = intent
        return result


class LoadReviewResponsesNode(BaseNode):
    id = 'RV-010'
    name = 'Load Review Responses'
    category = 'Review Workflows'
    description = 'Load submitted forms for one case so scoring can continue in a later run.'
    inputs = []
    outputs = [port('case', 'Case', 'case')]
    cacheable = False
    settings_schema = [
        setting('case_id', 'شناسه پرونده', 'text', '', required=True, supports_dynamic=False,
                help='پرونده‌ای را انتخاب کنید که فرم آن ارجاع شده است. تعداد پاسخ‌های ثبت‌شده در فهرست نمایش داده می‌شود.'),
        setting('form_id', 'شناسه فرم', 'text', 'expert_review', required=True, supports_dynamic=False),
        setting('response_target', 'محل ثبت پاسخ‌ها', 'select', 'reviews', options=['reviews', 'fields'],
                supports_dynamic=False,
                help='داوری: پاسخ هر کاربر جدا ثبت می‌شود. اطلاعات پرونده: پاسخ یک کاربر به فیلدهای پرونده افزوده می‌شود.'),
    ]

    def run(self, node, inputs, settings, context):
        case_id = _text(settings.get('case_id'), 128)
        form_id = _text(settings.get('form_id'), 64)
        key = f'{case_id}:{form_id}'
        task_data = (getattr(context, 'review_task_data', {}) or {}).get(key)
        if not isinstance(task_data, dict):
            raise invalid('REVIEW_TASKS_NOT_FOUND', f'No assigned form tasks were found for {key}.',
                          setting='case_id', fix='Run Assign Form Tasks first, then select its case and form IDs.')
        case = make_case({'case_id': case_id, 'project_id': getattr(context, 'project_id', None),
                          'fields': task_data.get('fields') or {}, 'documents': task_data.get('documents') or [],
                          'field_labels': task_data.get('field_labels') or {},
                          'forms': {form_id: task_data['form']}, 'status': 'awaiting_review'})
        target = settings.get('response_target', 'reviews')
        if target not in {'reviews', 'fields'}:
            raise invalid('REVIEW_RESPONSE_TARGET_INVALID', 'Choose reviews or case fields.', setting='response_target')
        tasks = task_data.get('tasks') or []
        if target == 'fields' and len(tasks) != 1:
            raise invalid('REVIEW_FIELDS_SINGLE_ASSIGNEE_REQUIRED', 'Updating case fields requires exactly one assigned user.',
                          setting='response_target', actual=len(tasks),
                          fix='Assign this intake or correction form to one owner. Keep multiple reviewer responses separate.')
        for task in task_data.get('tasks') or []:
            if task.get('status') == 'completed' and isinstance(task.get('answers'), dict):
                if target == 'fields':
                    errors = validate_response(task_data['form']['fields'], task['answers'])
                    if errors:
                        raise invalid('REVIEW_RESPONSE_FIELDS_INVALID', 'Submitted form answers are invalid.',
                                      setting='response_target', actual=errors[:10],
                                      fix='Ask the process owner to inspect the saved task and form version.')
                    case['fields'].update(task['answers'])
                    case['field_labels'].update({field['id']: field['label'] for field in task_data['form']['fields']})
                    case['status'] = 'received'
                    case['history'].append({'event': 'case_fields_submitted', 'task_id': task['task_id'],
                                            'actor_id': task['reviewer_id'], 'form_id': form_id})
                else:
                    case['reviews'].append({'form_id': form_id, 'reviewer_id': task['reviewer_id'],
                                            'answers': task['answers'], 'task_id': task['task_id']})
        assigned = len(tasks)
        completed = sum(task.get('status') == 'completed' for task in tasks)
        if target == 'fields' and completed != 1:
            raise invalid('REVIEW_FORM_AWAITING_RESPONSE', 'The assigned form has not been submitted yet.',
                          setting='case_id', fix='Ask the assigned user to submit the form, then run this continuation again.')
        if target == 'reviews' and assigned and len(case['reviews']) == assigned:
            case['status'] = 'reviews_complete'
        case['history'].append({'event': 'reviews_loaded', 'node_id': str(node['id']),
                                'completed': completed, 'assigned': assigned, 'response_target': target})
        form = task_data['form']
        rubric_fields = _rubric_fields(form)
        review_responses = []
        for task in tasks:
            answers = task.get('answers')
            if task.get('status') != 'completed' or not isinstance(answers, dict):
                continue
            score_values = [answers.get(field['id']) for field in rubric_fields]
            numeric_scores = [float(value) for value in score_values
                              if isinstance(value, (int, float)) and not isinstance(value, bool)]
            maximum = sum(float(field.get('max') or 0) for field in rubric_fields)
            review_responses.append({
                'task_id': task['task_id'], 'reviewer_id': task['reviewer_id'],
                'answers': answers,
                'score_total': sum(numeric_scores) if rubric_fields else None,
                'score_maximum': maximum if maximum > 0 else None,
            })
        return case_result(node, case, extra={'completed_reviews': completed,
                                              'assigned_reviews': assigned, 'response_target': target,
                                              'form_id': form_id, 'form_title': form.get('title') or form_id,
                                              'form_fields': form.get('fields') or [],
                                              'review_responses': review_responses})

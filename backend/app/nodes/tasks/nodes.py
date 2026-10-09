"""Reusable human work assignment; the connected result becomes task context."""
from __future__ import annotations

from typing import Any

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, input_by_port, node_label, output, safe_json, table_output
from app.nodes.review.contract import invalid, validate_fields


def _bounded_context_value(value: Any) -> Any:
    value = safe_json(value)
    if isinstance(value, dict):
        return {str(key)[:80]: _bounded_context_value(item) for key, item in list(value.items())[:30]}
    if isinstance(value, list):
        return [_bounded_context_value(item) for item in value[:20]]
    if isinstance(value, str):
        return value[:2000]
    return value


def _dynamic_form_from(value: Any) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Return a case and its active dynamic form when a value publishes one."""
    if not isinstance(value, dict):
        return None
    case = value.get('case') if isinstance(value.get('case'), dict) else value
    form_map = case.get('forms') if isinstance(case.get('forms'), dict) else {}
    active_id = str(case.get('active_form_id') or '')
    form = form_map.get(active_id) if active_id else next(iter(form_map.values()), None)
    if not isinstance(form, dict) or str(form.get('input_mode') or '') != 'dynamic':
        return None
    return case, form


def _dynamic_forms_from(value: Any) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Return dynamic forms from either one case or a review case batch."""
    if not isinstance(value, dict):
        return []
    case = value.get('case') if isinstance(value.get('case'), dict) else value
    if case.get('kind') != 'case_batch':
        published = _dynamic_form_from(case)
        return [published] if published else []
    cases = case.get('cases')
    if not isinstance(cases, list):
        return []
    return [published for item in cases if (published := _dynamic_form_from(item)) is not None]


def _contexts_for_case(contexts: list[Any], case: dict[str, Any]) -> list[Any]:
    """Match batch context to its case while retaining non-batch context."""
    case_id = str(case.get('case_id') or '')
    result: list[Any] = []
    for value in contexts:
        candidate = value.get('case') if isinstance(value, dict) and isinstance(value.get('case'), dict) else value
        if isinstance(candidate, dict) and candidate.get('kind') == 'case_batch':
            batch_cases = candidate.get('cases')
            match = next((item for item in batch_cases if isinstance(item, dict)
                          and str(item.get('case_id') or '') == case_id), None) if isinstance(batch_cases, list) else None
            if match is not None:
                result.append(match)
        else:
            result.append(value)
    return result


class AssignWorkTaskNode(BaseNode):
    id = 'WK-001'
    name = 'Legacy Assignment'
    category = 'Utilities / Advanced'
    description = 'Compatibility node for existing workflows. Use the specialized Human Tasks nodes for new workflows.'
    inputs = [port('source', 'Context (optional)', 'any', required=False)]
    outputs = [port('task', 'Task', 'any')]
    cacheable = False
    settings_schema = [
        setting('task_kind', 'نوع وظیفه', 'select', 'analysis', options=['analysis', 'approval', 'form'], supports_dynamic=False),
        setting('title', 'عنوان وظیفه', 'text', '', required=True, supports_dynamic=False),
        setting('instructions', 'راهنمای انجام کار', 'textarea', '', supports_dynamic=False),
        setting('assignees', 'مسئولان انجام کار', 'assignee_users', '', required=True, supports_dynamic=False),
        setting('due_days', 'مهلت (روز)', 'integer', 7, supports_dynamic=False),
        setting('list_mode', 'فهرست ورودی', 'select', 'each_item', options=['each_item', 'one_task'],
                supports_dynamic=False, help='برای هر آیتم یک وظیفه بسازید، یا کل فهرست را یکجا ارجاع دهید.'),
        setting('response_fields', 'فیلدهای پاسخ', 'form_fields', [], supports_dynamic=False,
                help='برای فرم سفارشی فیلدها را تعریف کنید. تحلیل و تأیید فرم آماده دارند.'),
    ]

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        sources = input_by_port(inputs, 'source')
        if len(sources) > 1:
            raise invalid('TASK_SOURCE_INVALID', 'Connect at most one context source.', port='source')
        kind = str(settings.get('task_kind') or 'analysis')
        if kind not in {'general', 'analysis', 'approval', 'form'}:
            raise invalid('TASK_KIND_INVALID', 'Choose analysis, approval, or custom form.', setting='task_kind')
        title = str(settings.get('title') or '').strip()
        instructions = str(settings.get('instructions') or '').strip()
        if not title or len(title) > 160 or len(instructions) > 4000:
            raise invalid('TASK_TEXT_INVALID', 'Add a title (up to 160 characters) and instructions (up to 4000).', setting='title')
        assignees = [name.strip().lower() for name in str(settings.get('assignees') or '').replace('\n', ',').split(',') if name.strip()]
        if not 1 <= len(assignees) <= 20 or len(set(assignees)) != len(assignees):
            raise invalid('TASK_ASSIGNEES_INVALID', 'Choose 1–20 different users.', setting='assignees')
        due_mode = str(settings.get('due_mode') or 'relative')
        due_at = str(settings.get('due_at') or '').strip()
        try:
            due_days = int(settings.get('due_days') or 7)
        except (TypeError, ValueError) as exc:
            raise invalid('TASK_DUE_INVALID', 'Due days must be a whole number.', setting='due_days') from exc
        if due_mode not in {'relative', 'exact', 'none'}:
            raise invalid('TASK_DUE_INVALID', 'Choose a relative, exact, or no deadline.', setting='due_mode')
        if due_mode == 'relative' and not 1 <= due_days <= 365:
            raise invalid('TASK_DUE_INVALID', 'Choose a deadline between 1 and 365 days.', setting='due_days')
        if due_mode == 'exact' and not due_at:
            raise invalid('TASK_DUE_INVALID', 'Choose an exact due date and time.', setting='due_at')

        if kind == 'analysis':
            fields = [
                {'id': 'summary', 'label': 'نتیجه تحلیل', 'type': 'long_text', 'required': True},
                {'id': 'recommendation', 'label': 'پیشنهاد / اقدام بعدی', 'type': 'long_text', 'required': False},
                {'id': 'attachment', 'label': 'فایل پیوست', 'type': 'file', 'required': False},
            ]
        elif kind == 'approval':
            fields = [
                {'id': 'decision', 'label': 'تصمیم', 'type': 'choice', 'choices': ['approve', 'reject', 'revise'], 'required': True},
                {'id': 'reason', 'label': 'دلیل / توضیح', 'type': 'long_text', 'required': False},
            ]
        else:
            fields = validate_fields(settings.get('response_fields'), setting_name='response_fields')

        source = sources[0] if sources else {}
        list_mode = str(settings.get('list_mode') or 'each_item')
        if list_mode not in {'each_item', 'one_task'}:
            raise invalid('TASK_LIST_MODE_INVALID', 'Choose one task per item or one task for the whole list.', setting='list_mode')
        if isinstance(source, list) and list_mode == 'each_item':
            if not source or len(source) * len(assignees) > 100:
                raise invalid('TASK_BATCH_SIZE_INVALID', 'The list must create between 1 and 100 tasks.', port='source',
                              fix='Split the input into smaller batches or choose one task for the whole list.')
            intents = []
            for index, raw_item in enumerate(source):
                item = raw_item.get('json', raw_item) if isinstance(raw_item, dict) else {'value': raw_item}
                child = self.run(node, {'_by_port': {'source': [item]}}, {**settings, 'list_mode': 'one_task'}, context)
                intent = child['_work_task_intent']
                if intent['subject_type'] != 'case':
                    candidate = item.get('case_id') or item.get('proposal_id') or item.get('id') if isinstance(item, dict) else None
                    intent['subject_type'] = 'item'
                    intent['subject_id'] = str(candidate or f'{context.execution_id}-{index + 1}')[:128]
                if any(previous['subject_id'] == intent['subject_id'] for previous in intents):
                    raise invalid('TASK_ITEM_ID_DUPLICATE', f'Duplicate item ID {intent["subject_id"]}.', port='source',
                                  fix='Give each item a unique id or case_id before assigning tasks.')
                intents.append(intent)
            visible_output = output(str(node['id']), node_label(node), 'work_task', task_kind=kind,
                                    task_title=title, subject_type='items', subject_id=f'{len(intents)} items',
                                    item_count=len(intents), assignee_count=len(intents) * len(assignees), status='assigned')
            return {'task': {'kind': 'work_task_batch', 'subjects': [item['subject_id'] for item in intents]},
                    'output': visible_output, 'visible_outputs_only': True, '_work_task_intents': intents}
        case = (source.get('case') if isinstance(source.get('case'), dict) else source
                if source.get('schema_version') == 1 and isinstance(source.get('case_id'), str) else None) if isinstance(source, dict) else None
        if case and isinstance(case.get('case_id'), str):
            subject_type, subject_id = 'case', case['case_id']
            raw_fields = case.get('fields') if isinstance(case.get('fields'), dict) else {}
            labels = case.get('field_labels') if isinstance(case.get('field_labels'), dict) else {}
            documents = case.get('documents') if isinstance(case.get('documents'), list) else []
        else:
            subject_type, subject_id = 'run', str(context.execution_id)
            visible = source.get('output') if isinstance(source, dict) and isinstance(source.get('output'), dict) else safe_json(source)
            visible = visible if isinstance(visible, dict) else {'value': visible}
            raw_fields = {'result': visible.get('title') or node_label(node)}
            raw_fields.update({str(key): value for key, value in list(visible.items())[:30]
                               if isinstance(value, (str, int, float, bool)) and key not in {'title'}})
            for key in ('metrics', 'value', 'status', 'summary'):
                value = visible.get(key)
                if isinstance(value, (str, int, float, bool)):
                    raw_fields[key] = value
                elif isinstance(value, dict):
                    raw_fields.update({str(k): v for k, v in list(value.items())[:20] if isinstance(v, (str, int, float, bool))})
            labels, documents = {}, []
        preview_rows: list[dict[str, Any]] = []
        preview_columns: list[str] = []
        frame = dataframe_payload({'value': source})
        if frame is not None:
            columns = list(frame.df.columns)[:12]
            preview_columns = [str(column) for column in columns]
            preview_rows = safe_json(frame.df.loc[:, columns].head(10).rename(columns=str))
        elif not case and isinstance(visible.get('rows'), list):
            preview_columns = [str(column) for column in list(visible.get('columns') or [])[:12]]
            preview_rows = [{str(key): str(value)[:200] for key, value in row.items() if str(key) in preview_columns}
                            for row in visible['rows'][:10] if isinstance(row, dict)]
        elif isinstance(source, list):
            records = [item.get('json', item) if isinstance(item, dict) else {'value': item} for item in source[:10]]
            preview_columns = list(dict.fromkeys(str(key) for item in records if isinstance(item, dict) for key in item))[:12]
            preview_rows = [{str(key): str(value)[:200] for key, value in item.items() if str(key) in preview_columns}
                            for item in records if isinstance(item, dict)]
        fields_preview = {str(key)[:64]: str(value)[:500] for key, value in list(raw_fields.items())[:30]}
        context_summary = {'fields': fields_preview, 'field_labels': labels,
                           'preview_columns': preview_columns, 'preview_rows': preview_rows,
                           'documents': [{'artifact_id': item.get('artifact_id'), 'filename': item.get('filename'),
                                          'pages': item.get('pages')} for item in documents[:20]
                                         if isinstance(item, dict) and isinstance(item.get('artifact_id'), int)]}
        form = {'id': f'task_{node["id"]}'[:64], 'title': title, 'fields': fields,
                'due_days': due_days if due_mode == 'relative' else None,
                'due_at': due_at if due_mode == 'exact' else None}
        intent = {'node_id': str(node['id']), 'task_kind': kind, 'subject_type': subject_type,
                  'subject_id': subject_id, 'form_id': form['id'], 'form': form,
                  'instructions': instructions, 'assignees': assignees, 'case_summary': safe_json(context_summary)}
        visible_output = output(str(node['id']), node_label(node), 'work_task', task_kind=kind,
                                task_title=title, subject_type=subject_type, subject_id=subject_id,
                                assignee_count=len(assignees), status='assigned')
        return {'task': {'kind': 'work_task', 'title': title, 'subject_id': subject_id, 'task_kind': kind,
                         'assignment_node_id': str(node['id'])},
                'output': visible_output, 'visible_outputs_only': True, '_work_task_intent': intent}


def _assignment_settings(*, fields: list[dict[str, Any]] | None = None) -> list:
    schema = [
        setting('title', 'عنوان وظیفه', 'text', '', required=True, supports_dynamic=False),
        setting('instructions', 'توضیحات و راهنمای انجام کار', 'textarea', '', supports_dynamic=False),
        setting('assignees', 'مسئولان انجام کار', 'assignee_users', '', required=True, supports_dynamic=False),
        setting('due_mode', 'نوع مهلت', 'select', 'relative', options=['relative', 'exact', 'none'], supports_dynamic=False),
        setting('due_days', 'مهلت نسبی (روز)', 'integer', 7, supports_dynamic=False),
        setting('due_at', 'تاریخ و ساعت دقیق', 'datetime', '', supports_dynamic=False),
        setting('list_mode', 'فهرست ورودی', 'select', 'each_item', options=['each_item', 'one_task'], supports_dynamic=False),
    ]
    if fields is not None:
        schema.append(setting('response_fields', 'فیلدهای پاسخ', 'form_fields', fields, required=True, supports_dynamic=False))
    return schema


class GeneralAssignmentNode(AssignWorkTaskNode):
    id = 'WK-003'
    name = 'General Assignment'
    description = 'Assign a task with a title, description, deadline, and typed response fields.'
    settings_schema = _assignment_settings(fields=[
        {'id': 'response', 'label': 'پاسخ', 'type': 'long_text', 'required': True},
    ])

    def run(self, node, inputs, settings, context):
        return super().run(node, inputs, {**settings, 'task_kind': 'general'}, context)


class ApprovalAssignmentNode(AssignWorkTaskNode):
    id = 'WK-004'
    name = 'Approval Assignment'
    description = 'Send connected results to an assignee for a Yes/No decision and description.'
    settings_schema = _assignment_settings()

    def run(self, node, inputs, settings, context):
        result = super().run(node, inputs, {**settings, 'task_kind': 'approval'}, context)
        intents = result.get('_work_task_intents') or [result.get('_work_task_intent')]
        fields = [
            {'id': 'approved', 'label': 'تأیید می‌کنید؟', 'type': 'boolean', 'required': True},
            {'id': 'description', 'label': 'توضیحات', 'type': 'long_text', 'required': False},
        ]
        for intent in intents:
            if isinstance(intent, dict):
                intent['form']['fields'] = fields
        return result


class FormAssignmentNode(AssignWorkTaskNode):
    id = 'WK-005'
    name = 'Form Assignment'
    description = 'Assign a connected Form Definition together with context from other nodes.'
    inputs = [port('form', 'Form', 'case'), port('context', 'Context', 'any', required=False, multiple=True)]
    settings_schema = _assignment_settings()

    def run(self, node, inputs, settings, context):
        forms = input_by_port(inputs, 'form')
        if len(forms) != 1 or not isinstance(forms[0], dict):
            raise invalid('TASK_FORM_REQUIRED', 'Connect exactly one Form Definition.', port='form')
        contexts = input_by_port(inputs, 'context')
        published_forms = _dynamic_forms_from(forms[0])

        # Existing graphs can have the two case-shaped connections reversed:
        # Extract Info on Form and Form Definition on Context.  Both edges are
        # type-compatible, but only the latter actually publishes a form.  Use
        # the unique dynamic form and retain the former Form input as context so
        # these saved workflows do not fail at runtime.
        if not published_forms:
            candidates = [(index, candidate) for index, value in enumerate(contexts)
                          if (candidate := _dynamic_forms_from(value))]
            if len(candidates) == 1:
                form_index, published_forms = candidates[0]
                contexts = [forms[0], *[value for index, value in enumerate(contexts) if index != form_index]]
        if not published_forms:
            raise invalid('TASK_FORM_REQUIRED', 'The Form input needs a dynamic form from Form Definition.', port='form',
                          fix='Connect Form Definition to Form and Extract Proposal Information to Context; set Form Definition to dynamic mode.')

        results = []
        for case, form in published_forms:
            case_contexts = _contexts_for_case(contexts, case)
            source = (case_contexts[0] if len(case_contexts) == 1
                      else {'connected_results': safe_json(case_contexts)} if case_contexts else case)
            result = super().run(node, {'_by_port': {'source': [source]}}, {
                **settings, 'task_kind': 'form', 'response_fields': form.get('fields') or [],
                'title': str(settings.get('title') or form.get('title') or 'Form task'),
                **({'list_mode': 'one_task'} if len(case_contexts) > 1 else {}),
            }, context)
            intents = result.get('_work_task_intents') or [result.get('_work_task_intent')]
            for intent in intents:
                if not isinstance(intent, dict):
                    continue
                intent['form_id'] = str(form.get('form_id') or form.get('id') or intent['form_id'])
                intent['form'] = {**form, 'title': str(settings.get('title') or form.get('title') or 'Form task'),
                                  'due_days': intent['form'].get('due_days'), 'due_at': intent['form'].get('due_at')}
                if case_contexts:
                    intent['case_summary']['context_items'] = [
                        {'label': f'Connected result {index + 1}', 'value': _bounded_context_value(value)}
                        for index, value in enumerate(case_contexts[:10])
                    ]
            results.append(result)

        if len(results) == 1:
            return results[0]
        intents = [intent for result in results for intent in (result.get('_work_task_intents')
                   or [result.get('_work_task_intent')]) if isinstance(intent, dict)]
        title = str(settings.get('title') or published_forms[0][1].get('title') or 'Form task')
        return {
            'task': {'kind': 'work_task_batch', 'subjects': [intent['subject_id'] for intent in intents],
                     'assignment_node_id': str(node['id'])},
            'output': output(str(node['id']), node_label(node), 'work_task', task_kind='form', task_title=title,
                             subject_type='cases', subject_id=f'{len(intents)} cases', item_count=len(intents),
                             assignee_count=sum(len(intent.get('assignees') or []) for intent in intents), status='assigned'),
            'visible_outputs_only': True,
            '_work_task_intents': intents,
        }


class LoadWorkResponsesNode(BaseNode):
    id = 'WK-002'
    name = 'Get Submissions'
    category = 'Human Tasks'
    description = 'Emit new typed submissions immediately, with a scheduled refresh as a reliability fallback.'
    inputs = [port('assignment', 'Assignment', 'any', required=False)]
    outputs = [port('responses', 'Responses', 'json'), port('table', 'Submission Table', 'dataframe')]
    cacheable = False
    settings_schema = [
        setting('task_id', 'شناسه یکی از وظایف ارجاع‌شده', 'integer', None, required=False, supports_dynamic=False,
                help='شناسه را از کارتابل وظایف کپی کنید. پاسخ همه مسئولان همان ارجاع خوانده می‌شود.'),
        setting('refresh_hours', 'فاصله بررسی پشتیبان (ساعت)', 'number', 5, supports_dynamic=False,
                help='ارسال رویداد فوری است؛ این زمان‌بندی فقط پاسخ‌های ازدست‌رفته را دوباره بررسی می‌کند.'),
    ]

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        connected = input_by_port(inputs, 'assignment')
        reference = connected[0] if len(connected) == 1 and isinstance(connected[0], dict) else {}
        subjects = [str(subject) for subject in reference.get('subjects') or [] if str(subject)]
        is_batch = reference.get('kind') == 'work_task_batch' or bool(subjects)
        raw_task_id = settings.get('task_id')
        task_id: int | None = None
        if raw_task_id not in (None, ''):
            try:
                task_id = int(raw_task_id)
            except (TypeError, ValueError) as exc:
                raise invalid('TASK_ID_INVALID', 'Enter a valid task ID.', setting='task_id') from exc
        key = (str(task_id) if task_id is not None else
               f"node:{reference.get('assignment_node_id')}:{'batch' if is_batch else reference.get('subject_id')}")
        data = (getattr(context, 'work_task_data', {}) or {}).get(key)
        if not isinstance(data, dict):
            if not reference:
                raise invalid('TASK_RESPONSES_NOT_FOUND', 'Connect an assignment or enter a task ID.', setting='task_id')
            try:
                refresh_minutes = max(5, min(10080, round(float(settings.get('refresh_hours') or 5) * 60)))
            except (TypeError, ValueError) as exc:
                raise invalid('TASK_REFRESH_INVALID', 'Refresh hours must be a number.', setting='refresh_hours') from exc
            empty = {'task_id': None, 'task_kind': reference.get('task_kind'), 'task_title': reference.get('title'),
                     'subject_id': reference.get('subject_id'), 'subject_ids': subjects, 'assigned': 0, 'completed': 0,
                     'responses': [], 'fields': [], 'new_count': 0, 'status': 'waiting'}
            watch_intents = [{'node_id': str(node['id']),
                              'assignment_node_id': str(reference.get('assignment_node_id') or ''),
                              'subject_id': subject_id,
                              'refresh_interval_minutes': refresh_minutes}
                             for subject_id in (subjects if is_batch else [str(reference.get('subject_id') or '')])
                             if subject_id]
            table = dataframe_result(pd.DataFrame())
            visible = output(str(node['id']), node_label(node), 'work_task_result', **empty)
            visible_table = table_output(str(node['id']), f'{node_label(node)} · Submission Table', table['_df'])
            visible_table.update(source_handle='table', source_port_name='Submission Table')
            return {'responses': empty, 'table': table, 'outputs_by_port': {'responses': empty, 'table': table},
                    'output': visible, 'outputs': [visible, visible_table],
                    'visible_outputs_only': True,
                    '_defer_downstream': True,
                    '_task_watch_intents': watch_intents}
        responses = data.get('responses') or []
        result = {'task_id': task_id or data.get('task_id'), 'assignment_group_id': data.get('assignment_group_id'),
                  'task_kind': data['task_kind'], 'task_title': data['title'],
                  'subject_id': data.get('subject_id'), 'subject_ids': data.get('subject_ids') or [],
                  'assigned': len(responses),
                  'completed': sum(item['status'] == 'completed' for item in responses),
                  'responses': responses, 'fields': data.get('fields') or [],
                  'new_count': sum(item['status'] == 'completed' for item in responses)}
        rows = [{'task_id': item.get('task_id'), 'assignee': item.get('assignee'),
                 'subject_id': item.get('subject_id'),
                 'status': item.get('status'), 'submitted_at': item.get('submitted_at'),
                 **(item.get('answers') or {})} for item in responses]
        field_columns = [str(field.get('id')) for field in result['fields'] if isinstance(field, dict) and field.get('id')]
        metadata_columns = ['task_id', 'assignee', 'subject_id', 'status', 'submitted_at']
        table = dataframe_result(pd.DataFrame(rows, columns=list(dict.fromkeys([*field_columns, *metadata_columns]))))
        visible = output(str(node['id']), node_label(node), 'work_task_result', **result)
        visible_table = table_output(str(node['id']), f'{node_label(node)} · Submission Table', table['_df'])
        visible_table.update(source_handle='table', source_port_name='Submission Table')
        return {'responses': result, 'table': table, 'outputs_by_port': {'responses': result, 'table': table},
                'output': visible, 'outputs': [visible, visible_table],
                'visible_outputs_only': True}

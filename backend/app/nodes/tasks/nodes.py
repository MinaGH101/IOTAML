"""Reusable human work assignment; the connected result becomes task context."""
from __future__ import annotations

from typing import Any

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, input_by_port, node_label, output, safe_json
from app.nodes.review.contract import invalid, validate_fields


class AssignWorkTaskNode(BaseNode):
    id = 'WK-001'
    name = 'Assign Work Task'
    category = 'Human Tasks'
    description = 'Assign analysis, approval, or a custom form to project users. Each assignee gets a private task.'
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
        if kind not in {'analysis', 'approval', 'form'}:
            raise invalid('TASK_KIND_INVALID', 'Choose analysis, approval, or custom form.', setting='task_kind')
        title = str(settings.get('title') or '').strip()
        instructions = str(settings.get('instructions') or '').strip()
        if not title or len(title) > 160 or len(instructions) > 4000:
            raise invalid('TASK_TEXT_INVALID', 'Add a title (up to 160 characters) and instructions (up to 4000).', setting='title')
        assignees = [name.strip().lower() for name in str(settings.get('assignees') or '').replace('\n', ',').split(',') if name.strip()]
        if not 1 <= len(assignees) <= 20 or len(set(assignees)) != len(assignees):
            raise invalid('TASK_ASSIGNEES_INVALID', 'Choose 1–20 different users.', setting='assignees')
        try:
            due_days = int(settings.get('due_days') or 7)
        except (TypeError, ValueError) as exc:
            raise invalid('TASK_DUE_INVALID', 'Due days must be a whole number.', setting='due_days') from exc
        if not 1 <= due_days <= 365:
            raise invalid('TASK_DUE_INVALID', 'Choose a deadline between 1 and 365 days.', setting='due_days')

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
        form = {'id': f'task_{node["id"]}'[:64], 'title': title, 'fields': fields, 'due_days': due_days}
        intent = {'node_id': str(node['id']), 'task_kind': kind, 'subject_type': subject_type,
                  'subject_id': subject_id, 'form_id': form['id'], 'form': form,
                  'instructions': instructions, 'assignees': assignees, 'case_summary': safe_json(context_summary)}
        visible_output = output(str(node['id']), node_label(node), 'work_task', task_kind=kind,
                                task_title=title, subject_type=subject_type, subject_id=subject_id,
                                assignee_count=len(assignees), status='assigned')
        return {'task': {'kind': 'work_task', 'title': title, 'subject_id': subject_id, 'task_kind': kind},
                'output': visible_output, 'visible_outputs_only': True, '_work_task_intent': intent}


class LoadWorkResponsesNode(BaseNode):
    id = 'WK-002'
    name = 'Load Task Responses'
    category = 'Human Tasks'
    description = 'Load the latest responses for one assignment group in a later workflow run.'
    inputs = []
    outputs = [port('responses', 'Responses', 'json')]
    cacheable = False
    settings_schema = [
        setting('task_id', 'شناسه یکی از وظایف ارجاع‌شده', 'integer', None, required=True, supports_dynamic=False,
                help='شناسه را از کارتابل وظایف کپی کنید. پاسخ همه مسئولان همان ارجاع خوانده می‌شود.'),
    ]

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        try:
            task_id = int(settings.get('task_id'))
        except (TypeError, ValueError) as exc:
            raise invalid('TASK_ID_INVALID', 'Enter a valid task ID.', setting='task_id') from exc
        data = (getattr(context, 'work_task_data', {}) or {}).get(str(task_id))
        if not isinstance(data, dict):
            raise invalid('TASK_RESPONSES_NOT_FOUND', f'Task {task_id} was not found in this project.', setting='task_id',
                          fix='Copy an assigned task ID from this project. Run the assignment first.')
        responses = data.get('responses') or []
        result = {'task_id': task_id, 'task_kind': data['task_kind'], 'task_title': data['title'],
                  'subject_id': data['subject_id'], 'assigned': len(responses),
                  'completed': sum(item['status'] == 'completed' for item in responses),
                  'responses': responses, 'fields': data.get('fields') or []}
        return {'responses': result, 'output': output(str(node['id']), node_label(node), 'work_task_result', **result),
                'visible_outputs_only': True}

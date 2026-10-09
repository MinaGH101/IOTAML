"""Exercise PDF OCR, field extraction, form assignment, submission and score resumption.

Usage: python3 scripts/review_smoke.py --pdf ../SOHA_prposal.pdf
Reads the local .env admin credentials; never prints credentials or tokens.
Creates a visible SOHA-DEMO task in the admin inbox for inspection.
"""
from __future__ import annotations

import argparse
import json
import time
import uuid
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
DIRECT_OPENER = build_opener(ProxyHandler({}))


def local_env() -> dict[str, str]:
    values = {}
    for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"\'')
    return values


def api(base: str, path: str, *, token: str = '', method: str = 'GET', payload=None, multipart=None):
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    body = None
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    if multipart is not None:
        boundary = uuid.uuid4().hex
        name, content = multipart
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
                'Content-Type: application/pdf\r\n\r\n').encode() + content + f'\r\n--{boundary}--\r\n'.encode()
        headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
    with DIRECT_OPENER.open(Request(base + path, data=body, method=method, headers=headers), timeout=90) as response:
        result = json.load(response)
    return result['data'] if isinstance(result, dict) and result.get('success') is True else result


def graph_node(instance_id: str, registry_id: str, params: dict) -> dict:
    return {'id': instance_id, 'type': 'mlNode', 'position': {'x': 0, 'y': 0},
            'data': {'registryId': registry_id, 'label': registry_id, 'params': params}}


def edge(source: str, target: str, source_handle: str = 'case', target_handle: str = 'case') -> dict:
    return {'id': f'{source}-{target}', 'source': source, 'target': target,
            'sourceHandle': source_handle, 'targetHandle': target_handle}


def run_and_wait(base: str, token: str, graph: dict, name: str) -> dict:
    run = api(base, '/api/runs', token=token, method='POST', payload={
        'workflow_name': name, 'workflow_graph': graph, 'project_id': None,
    })
    for _ in range(90):
        run = api(base, f"/api/runs/{run['id']}", token=token)
        if run['status'] in {'succeeded', 'failed', 'cancelled', 'timed_out'}:
            return run
        time.sleep(1)
    raise RuntimeError('Timed out waiting for the workflow run.')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', type=Path, required=True)
    parser.add_argument('--base', default='http://localhost:8001')
    parser.add_argument('--with-ai', action='store_true', help='Also run the live AI Review node.')
    args = parser.parse_args()
    config = local_env()
    username = config['ADMIN_EMAIL']
    logged_in = api(args.base, '/api/auth/login', method='POST', payload={
        'username': username, 'password': config['ADMIN_PASSWORD'],
    })
    token = logged_in['access_token']
    artifact = api(args.base, '/api/artifacts/upload?artifact_type=artifact', token=token,
                   method='POST', multipart=(args.pdf.name, args.pdf.read_bytes()))
    artifact_id = artifact['id']
    fields = [
        {'id': name, 'label': label, 'type': 'score', 'required': True, 'min': 0, 'max': weight}
        for name, label, weight in [
            ('innovation', 'نوآوری', 15), ('scientific', 'توجیه علمی و فنی', 15),
            ('economic', 'توجیه اقتصادی', 15), ('strategy', 'هم‌راستایی راهبردی', 15),
            ('team', 'تیم اجرایی', 15), ('schedule', 'زمان‌بندی', 5),
            ('ip', 'ثبت اختراع / دانش فنی', 5), ('impact', 'بهره‌وری، محیط زیست و ایمنی', 15),
        ]
    ]
    case_id = f'SOHA-DEMO-{int(time.time())}'
    catalog = api(args.base, '/api/nodes/catalog', token=token)
    intake_node = next(item for item in catalog['nodes'] if item['id'] == 'RV-001')
    intake_fields = [dict(field) for field in next(item for item in intake_node['settingsSchema']
                                                   if item['name'] == 'intake_fields')['default']]
    for field in intake_fields:
        if field['id'] == 'project_code':
            field['value'] = case_id
        elif field['id'] == 'project_title':
            field['value'] = 'داشبورد هوشمند تحلیل داده‌های ژئوشیمی'
    nodes = [
        graph_node('intake', 'RV-001', {'intake_fields': intake_fields,
                                       'proposal_pdf': artifact_id, 'supporting_files': []}),
        graph_node('ocr', 'RV-011', {'max_pages': 60}),
        graph_node('extract', 'RV-003', {
            'input_mode': 'static',
            'extraction_fields': [
                {'id': 'project_title', 'label': 'عنوان طرح', 'type': 'text', 'required': False},
                {'id': 'proposer', 'label': 'مجری یا پیشنهاددهنده', 'type': 'text', 'required': False},
            ],
            'max_document_chars': 120000,
            'user_prompt': 'عنوان رسمی طرح و نام مجری را عیناً از سند استخراج کن.',
        }),
        graph_node('form', 'RV-002', {'form_id': 'expert_review', 'title': 'ارزیابی تخصصی طرح', 'fields': fields, 'assignee_role': 'admin', 'due_days': 7}),
        graph_node('assign', 'RV-009', {'form_id': 'expert_review', 'assignees': username}),
    ]
    edges = [edge('intake', 'ocr'), edge('ocr', 'extract', 'ocr_text', 'ocr_text'), edge('extract', 'form')]
    if args.with_ai:
        nodes.append(graph_node('ai', 'RV-005', {'form_id': 'expert_review',
                                                'user_prompt': 'Assess only document evidence. Explain missing evidence briefly.',
                                                'max_document_chars': 12000}))
        edges.extend([edge('form', 'ai'), edge('ai', 'assign')])
    else:
        edges.append(edge('form', 'assign'))
    first = {'nodes': nodes, 'edges': edges}
    first_run = run_and_wait(args.base, token, first, 'SOHA review intake smoke')
    print('intake run', first_run['id'], first_run['status'], first_run.get('error') or '')
    if first_run['status'] != 'succeeded':
        return
    tasks = api(args.base, '/api/review-tasks?mine=true', token=token)
    task = next(item for item in tasks if item['case_id'] == case_id)
    scores = dict(zip((field['id'] for field in fields), (12, 13, 14, 15, 11, 4, 3, 13)))
    api(args.base, f"/api/review-tasks/{task['id']}/submit", token=token, method='POST', payload={'answers': scores})
    second = {'nodes': [
        graph_node('responses', 'RV-010', {'case_id': case_id, 'form_id': 'expert_review'}),
        graph_node('scores', 'RV-007', {'form_id': 'expert_review', 'minimum_reviewers': 1}),
    ], 'edges': [edge('responses', 'scores')]}
    second_run = run_and_wait(args.base, token, second, 'SOHA review scoring smoke')
    print('scoring run', second_run['id'], second_run['status'], second_run.get('error') or '')
    if second_run['status'] == 'succeeded':
        output = (second_run.get('artifacts') or {}).get('node_outputs', {}).get('scores') or {}
        print('score preview', json.dumps(output, ensure_ascii=False)[:500])
    print('case', case_id, 'task', task['id'], 'artifact', artifact_id)


if __name__ == '__main__':
    main()

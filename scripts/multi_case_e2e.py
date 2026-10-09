"""Create and exercise the complete persisted multi-case proposal workflow."""
from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

from review_smoke import api, local_env


BASE = 'http://localhost:8001'
PROJECT_NAME = 'Proposal Multi-Case Review'
WORKFLOW_NAME = 'Full Proposal Review — Multi Case'
REVIEWERS = [
    {'username': 'proposal_reviewer_1', 'email': 'proposal-reviewer-1@example.test',
     'first_name': 'Proposal', 'last_name': 'Reviewer 1'},
    {'username': 'proposal_reviewer_2', 'email': 'proposal-reviewer-2@example.test',
     'first_name': 'Proposal', 'last_name': 'Reviewer 2'},
]
PASSWORD = 'ReviewBoard!2026'
DIRECT_OPENER = build_opener(ProxyHandler({}))


def call(path: str, *, token: str = '', method: str = 'GET', payload=None):
    try:
        return api(BASE, path, token=token, method=method, payload=payload)
    except HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'{method} {path} failed ({exc.code}): {body[:1200]}') from exc


def multipart_cases(path: str, token: str, project_id: int, metadata: list[dict], files: list[Path]):
    boundary = uuid.uuid4().hex
    chunks: list[bytes] = []

    def field(name: str, value: str) -> None:
        chunks.extend([
            f'--{boundary}\r\n'.encode(),
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
            value.encode('utf-8'), b'\r\n',
        ])

    field('project_id', str(project_id))
    field('metadata', json.dumps(metadata, ensure_ascii=False))
    for pdf in files:
        chunks.extend([
            f'--{boundary}\r\n'.encode(),
            f'Content-Disposition: form-data; name="files"; filename="{pdf.name}"\r\n'.encode(),
            b'Content-Type: application/pdf\r\n\r\n', pdf.read_bytes(), b'\r\n',
        ])
    chunks.append(f'--{boundary}--\r\n'.encode())
    request = Request(BASE + path, data=b''.join(chunks), method='POST', headers={
        'Authorization': f'Bearer {token}', 'Content-Type': f'multipart/form-data; boundary={boundary}',
    })
    try:
        with DIRECT_OPENER.open(request, timeout=300) as response:
            result = json.load(response)
    except HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'case import failed ({exc.code}): {body[:1200]}') from exc
    return result['data'] if result.get('success') is True else result


def node(node_id: str, registry_id: str, label: str, x: int, y: int, params: dict) -> dict:
    return {'id': node_id, 'type': 'mlNode', 'position': {'x': x, 'y': y},
            'data': {'registryId': registry_id, 'label': label, 'params': params}}


def edge(source: str, target: str, source_handle: str = 'case', target_handle: str = 'case') -> dict:
    return {'id': f'{source}-{target}', 'source': source, 'target': target,
            'sourceHandle': source_handle, 'targetHandle': target_handle}


def workflow_graph() -> dict:
    rubric = [
        ('innovation', 'نوآوری', 15), ('scientific', 'توجیه علمی و فنی', 15),
        ('economic', 'توجیه اقتصادی', 15), ('strategy', 'هم‌راستایی راهبردی', 15),
        ('team', 'تیم اجرایی', 15), ('schedule', 'زمان‌بندی', 5),
        ('ip', 'ثبت اختراع / دانش فنی', 5), ('impact', 'بهره‌وری، محیط زیست و ایمنی', 15),
    ]
    score_fields = [{'id': field_id, 'label': label, 'type': 'score', 'required': True,
                     'min': 0, 'max': maximum} for field_id, label, maximum in rubric]
    score_fields.append({'id': 'review_comment', 'label': 'نظر تخصصی', 'type': 'long_text', 'required': True})
    intake_fields = [
        {'id': 'project_code', 'label': 'کد پرونده', 'type': 'text', 'value': ''},
        {'id': 'project_title', 'label': 'عنوان طرح', 'type': 'text', 'value': ''},
        {'id': 'proposer', 'label': 'پیشنهاددهنده', 'type': 'text', 'value': ''},
        {'id': 'project_manager', 'label': 'مدیر پروژه', 'type': 'text', 'value': ''},
        {'id': 'requested_budget', 'label': 'بودجه درخواستی', 'type': 'number', 'value': None},
    ]
    extraction_fields = [
        {'id': 'extracted_title', 'label': 'عنوان استخراج‌شده', 'type': 'text', 'required': False},
        {'id': 'executive_summary', 'label': 'خلاصه اجرایی', 'type': 'long_text', 'required': False},
        {'id': 'document_proposer', 'label': 'مجری در سند', 'type': 'text', 'required': False},
    ]
    nodes = [
        node('case-intake', 'RV-001', 'Case Intake', 80, 120, {
            'input_mode': 'static', 'proposal_pdf': None, 'supporting_files': [],
            'intake_fields': intake_fields, 'id_prefix': 'PROPOSAL',
        }),
        node('ocr-documents', 'RV-011', 'OCR Documents', 400, 120, {
            'max_pages': 60,
        }),
        node('extract-info', 'RV-003', 'Extract Proposal Information', 720, 120, {
            'input_mode': 'static', 'max_document_chars': 120000,
            'extraction_fields': extraction_fields,
            'user_prompt': 'Extract the official proposal title, proposer, and a concise executive summary. Use only evidence in the document.',
        }),
        node('scoring-form', 'RV-002', 'Scoring Form', 1040, 120, {
            'input_mode': 'dynamic', 'form_id': 'expert_review',
            'title': 'فرم امتیازدهی تخصصی طرح', 'fields': score_fields, 'due_days': 7,
        }),
        node('validate-case', 'RV-004', 'Validate Case', 1360, 120, {
            'required_field_ids': 'project_title',
            'user_prompt': 'Identify material inconsistencies, unsupported claims, or missing implementation details. Do not make the final decision.',
        }),
        node('ai-review', 'RV-005', 'AI Review', 1680, 120, {
            'form_id': 'expert_review', 'max_document_chars': 30000,
            'user_prompt': 'Score every rubric criterion from document evidence. Cite pages, explain weak evidence, and leave the final decision to human reviewers.',
        }),
        node('assign-reviewers', 'RV-009', 'Assign Scoring Form', 2000, 120, {
            'form_id': 'expert_review', 'assignees': ','.join(item['username'] for item in REVIEWERS),
        }),
        node('get-responses', 'RV-010', 'Get Submitted Scores', 720, 520, {
            'case_id': 'CASE-BOUND-AT-RUN', 'form_id': 'expert_review', 'response_target': 'reviews',
        }),
        node('aggregate-scores', 'RV-007', 'Aggregate Human Scores', 1040, 520, {
            'form_id': 'expert_review', 'minimum_reviewers': len(REVIEWERS),
        }),
    ]
    first_branch = ['case-intake', 'ocr-documents', 'extract-info', 'scoring-form', 'validate-case', 'ai-review', 'assign-reviewers']
    edges = [edge(left, right) for left, right in zip(first_branch, first_branch[1:])]
    edges[1] = edge('ocr-documents', 'extract-info', 'ocr_text', 'ocr_text')
    edges.append(edge('get-responses', 'aggregate-scores'))
    return {'nodes': nodes, 'edges': edges, 'meta': {'analysisBoards': [], 'activeAnalysisBoardId': 'main'}}


def ensure_users(admin_token: str) -> list[dict]:
    current = call('/api/admin/users?limit=200', token=admin_token)
    by_name = {item['username']: item for item in current}
    result = []
    for spec in REVIEWERS:
        payload = {**spec, 'password': PASSWORD, 'role': 'expert', 'is_active': True,
                   'phone_number': '', 'title': 'Proposal reviewer', 'department': 'R&D'}
        existing = by_name.get(spec['username'])
        if existing:
            user = call(f"/api/admin/users/{existing['id']}", token=admin_token, method='PUT', payload=payload)
        else:
            user = call('/api/admin/users', token=admin_token, method='POST', payload=payload)
        result.append(user)
    return result


def ensure_project(admin_token: str, users: list[dict]) -> dict:
    projects = call('/api/projects?limit=200', token=admin_token)
    existing = next((item for item in projects if item['name'] == PROJECT_NAME), None)
    assignments = [{'user_id': user['id'], 'access_type': 'view'} for user in users]
    payload = {'name': PROJECT_NAME, 'description': 'End-to-end multi-case PDF extraction, AI review, human scoring, and results board.',
               'start_date': None, 'due_date': None, 'project_manager': 'IOTA Admin', 'state': 'open',
               'priority': 'high', 'color': '#258f83', 'project_type': 'team', 'assignments': assignments}
    if existing:
        return call(f"/api/projects/{existing['id']}", token=admin_token, method='PUT', payload=payload)
    return call('/api/projects', token=admin_token, method='POST', payload=payload)


def ensure_workflow(admin_token: str, project_id: int) -> dict:
    graph = workflow_graph()
    validation = call('/api/workflows/validate', token=admin_token, method='POST', payload={'graph': graph})
    if validation.get('errors'):
        raise RuntimeError(f'workflow validation failed: {validation["errors"]}')
    workflows = call(f'/api/workflows?project_id={project_id}&limit=200', token=admin_token)
    existing = next((item for item in workflows if item['name'] == WORKFLOW_NAME), None)
    payload = {'name': WORKFLOW_NAME, 'graph': graph, 'project_id': project_id, 'last_run_id': None}
    if existing:
        return call(f"/api/workflows/{existing['id']}", token=admin_token, method='PUT', payload=payload)
    return call('/api/workflows', token=admin_token, method='POST', payload=payload)


def wait_for_cases(admin_token: str, project_id: int, ids: set[int], wanted: set[str], timeout: int) -> list[dict]:
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        cases = call(f'/api/cases?project_id={project_id}&limit=200', token=admin_token)
        selected = [item for item in cases if item['id'] in ids]
        state = tuple(sorted((item['case_id'], item['status']) for item in selected))
        if state != last:
            print('case status:', ', '.join(f'{case_id}={status}' for case_id, status in state), flush=True)
            last = state
        if len(selected) == len(ids) and all(item['status'] in wanted for item in selected):
            return selected
        failed = [item for item in selected if item['status'] == 'failed']
        if failed:
            details = [call(f"/api/cases/{item['id']}", token=admin_token) for item in failed]
            raise RuntimeError('case failed: ' + json.dumps(details, ensure_ascii=False, default=str)[:5000])
        time.sleep(2)
    raise RuntimeError(f'timed out waiting for case states {wanted}')


def submit_reviews(project_id: int, case_ids: set[str]) -> None:
    values = [
        (13, 12, 11, 13, 12, 4, 4, 13),
        (12, 13, 12, 11, 13, 4, 3, 12),
    ]
    keys = ('innovation', 'scientific', 'economic', 'strategy', 'team', 'schedule', 'ip', 'impact')
    for reviewer_index, reviewer in enumerate(REVIEWERS):
        login = call('/api/auth/login', method='POST', payload={'username': reviewer['username'], 'password': PASSWORD})
        token = login['access_token']
        tasks = call(f'/api/tasks?mine=true&project_id={project_id}&status=open&limit=200', token=token)
        matching = [task for task in tasks if task.get('subject_id') in case_ids and task.get('form_id') == 'expert_review']
        if len(matching) != len(case_ids):
            raise RuntimeError(f'{reviewer["username"]} received {len(matching)} of {len(case_ids)} expected scoring tasks')
        for task in matching:
            answers = dict(zip(keys, values[reviewer_index]))
            answers['review_comment'] = f'End-to-end test review by {reviewer["username"]} for {task["subject_id"]}.'
            call(f"/api/tasks/{task['id']}/submit", token=token, method='POST', payload={'answers': answers})
            print('submitted:', reviewer['username'], task['subject_id'], flush=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    files = [root.parent / 'propsal1.pdf', root.parent / 'proposal2.pdf']
    missing = [str(path) for path in files if not path.is_file()]
    if missing:
        raise RuntimeError(f'missing PDFs: {missing}')
    config = local_env()
    admin = call('/api/auth/login', method='POST', payload={
        'username': config['ADMIN_EMAIL'], 'password': config['ADMIN_PASSWORD'],
    })
    token = admin['access_token']
    users = ensure_users(token)
    project = ensure_project(token, users)
    workflow = ensure_workflow(token, project['id'])
    suffix = time.strftime('%Y%m%d-%H%M%S')
    metadata = [
        {'case_id': f'PROPOSAL-1-{suffix}', 'title': 'Proposal 1 end-to-end test',
         'fields': {'proposer': 'Test proposer 1', 'project_manager': 'Test manager 1', 'requested_budget': 1000}},
        {'case_id': f'PROPOSAL-2-{suffix}', 'title': 'Proposal 2 end-to-end test',
         'fields': {'proposer': 'Test proposer 2', 'project_manager': 'Test manager 2', 'requested_budget': 2000}},
    ]
    imported = multipart_cases('/api/cases/import', token, project['id'], metadata, files)
    case_rows = imported['cases']
    case_db_ids = {item['id'] for item in case_rows}
    case_ids = {item['case_id'] for item in case_rows}
    print('created project/workflow:', project['id'], workflow['id'], flush=True)
    print('imported cases:', ', '.join(sorted(case_ids)), flush=True)
    launched = call('/api/cases/run', token=token, method='POST', payload={
        'project_id': project['id'], 'workflow_id': workflow['id'], 'case_record_ids': sorted(case_db_ids),
        'assignees': [item['username'] for item in REVIEWERS], 'new_only': False,
    })
    if launched['count'] != 2:
        raise RuntimeError(f'expected two independent runs, got {launched}')
    wait_for_cases(token, project['id'], case_db_ids, {'awaiting_review'}, 900)
    submit_reviews(project['id'], case_ids)
    completed = wait_for_cases(token, project['id'], case_db_ids, {'completed'}, 300)
    for item in completed:
        detail = call(f"/api/cases/{item['id']}", token=token)
        results = detail.get('results') or {}
        if not results.get('ai_review') or not results.get('scores') or len(detail.get('reviews') or []) != 2:
            raise RuntimeError(f'incomplete result for {item["case_id"]}: {json.dumps(detail, ensure_ascii=False, default=str)[:5000]}')
        print('verified:', item['case_id'], 'score=', item['score'], '/', item['score_max'],
              'runs=', len(detail['runs']), 'reviews=', len(detail['reviews']), flush=True)
    print(json.dumps({
        'project_id': project['id'], 'workflow_id': workflow['id'],
        'case_ids': sorted(case_ids), 'reviewers': [item['username'] for item in REVIEWERS],
        'password': PASSWORD,
    }, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'E2E FAILED: {exc}', file=sys.stderr, flush=True)
        raise

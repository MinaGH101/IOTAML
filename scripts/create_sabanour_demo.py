"""Save a presentation-ready Sabanour review graph in the admin workspace.

Usage: python3 scripts/create_sabanour_demo.py --pdf ../SOHA_prposal.pdf
The script uses local .env credentials and does not print them.
"""
from __future__ import annotations

import argparse
import copy
from pathlib import Path

from review_smoke import api, local_env


RUBRIC = [
    ('innovation', 'نوآوری', 15),
    ('scientific', 'توجیه علمی و فنی', 15),
    ('economic', 'توجیه اقتصادی', 15),
    ('strategy', 'هم‌راستایی راهبردی', 15),
    ('team', 'تیم اجرایی', 15),
    ('schedule', 'زمان‌بندی', 5),
    ('ip', 'ثبت اختراع / دانش فنی', 5),
    ('impact', 'بهره‌وری، محیط زیست و ایمنی', 15),
]


def node(instance_id: str, registry_id: str, label: str, x: int, params: dict) -> dict:
    index = x // 320
    return {'id': instance_id, 'type': 'mlNode',
            'position': {'x': 380 + (index % 2) * 360, 'y': 140 + (index // 2) * 250},
            'data': {'registryId': registry_id, 'label': label, 'params': params}}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', type=Path, required=True)
    parser.add_argument('--base', default='http://localhost:8001')
    parser.add_argument('--scoring-case-id', help='Optional existing case ID for a saved scoring continuation.')
    args = parser.parse_args()
    env = local_env()
    login = api(args.base, '/api/auth/login', method='POST', payload={
        'username': env['ADMIN_EMAIL'], 'password': env['ADMIN_PASSWORD'],
    })
    token = login['access_token']
    project_name = 'Sabanour R&D proposal demo'
    projects = api(args.base, '/api/projects?limit=200', token=token)
    project = next((item for item in projects if item['name'] == project_name), None)
    if project is None:
        project = api(args.base, '/api/projects', token=token, method='POST', payload={
            'name': project_name,
            'description': 'SOHA proposal: reusable extraction, validation, expert form, AI advice and human scoring.',
        })
    project_id = project['id']
    name = 'Sabanour R&D proposal — SOHA demo'
    existing = api(args.base, f'/api/workflows?project_id={project_id}&limit=200', token=token)
    catalog = api(args.base, f'/api/nodes/catalog?project_id={project_id}', token=token)
    intake_definition = next(item for item in catalog['nodes'] if item['id'] == 'RV-001')
    intake_fields = copy.deepcopy(next(item for item in intake_definition['settingsSchema']
                                   if item['name'] == 'intake_fields')['default'])
    if any(item['name'] == name for item in existing):
        workflow = next(item for item in existing if item['name'] == name)
        print('Existing workflow:', workflow['id'])
    else:
        artifact = api(args.base, f'/api/artifacts/upload?artifact_type=artifact&project_id={project_id}', token=token,
                       method='POST', multipart=(args.pdf.name, args.pdf.read_bytes()))
        fields = [{'id': field_id, 'label': label, 'type': 'score', 'required': True, 'min': 0, 'max': maximum}
                  for field_id, label, maximum in RUBRIC]
        fields.append({'id': 'review_comment', 'label': 'نظر تخصصی', 'type': 'long_text', 'required': True})
        nodes = [
        node('intake', 'RV-001', 'دریافت طرح', 0, {
            'proposal_pdf': artifact['id'], 'supporting_files': [],
            'intake_fields': intake_fields, 'id_prefix': 'SNR',
        }),
        node('ocr', 'RV-011', 'OCR کامل اسناد', 320, {
            'max_pages': 60,
        }),
        node('extract', 'RV-003', 'استخراج اطلاعات طرح', 640, {
            'input_mode': 'static', 'max_document_chars': 120000,
            'extraction_fields': [
                {'id': 'project_title', 'label': 'عنوان طرح', 'type': 'text', 'required': False},
                {'id': 'proposer', 'label': 'مجری یا پیشنهاددهنده', 'type': 'text', 'required': False},
            ],
            'user_prompt': 'عنوان رسمی طرح و نام مجری را فقط از شواهد موجود در سند استخراج کن. اگر نامشخص است مقدار null بده.',
        }),
        node('form', 'RV-002', 'فرم داوری هشت‌معیاره', 960, {
            'form_id': 'expert_review', 'title': 'ارزیابی تخصصی طرح پژوهشی', 'fields': fields, 'due_days': 7,
        }),
        node('validate', 'RV-004', 'کنترل کامل بودن', 1280, {
            'required_field_ids': 'project_title',
            'user_prompt': 'ناهماهنگی‌های مهم، ابهام در بودجه یا برنامه اجرا و ادعاهای بدون شواهد را کوتاه و مستند گزارش کن. تصمیم نهایی نگیر.',
        }),
        node('ai', 'RV-005', 'نظر کمکی هوش مصنوعی', 1600, {
            'form_id': 'expert_review', 'max_document_chars': 30000,
            'user_prompt': 'بر اساس هشت معیار فرم و فقط شواهد همین پیشنهاد، امتیاز پیشنهادی و شواهد صفحه‌دار بده. نبود شواهد را صریح بگو. تصمیم نهایی با انسان است.',
        }),
        node('assign', 'RV-009', 'ارجاع به داور', 1920, {
            'form_id': 'expert_review', 'assignees': env['ADMIN_EMAIL'],
        }),
        ]
        order = ['intake', 'ocr', 'extract', 'form', 'validate', 'ai', 'assign']
        edges = [{'id': f'{left}-{right}', 'source': left, 'sourceHandle': 'case',
                  'target': right, 'targetHandle': 'case'}
                 for left, right in zip(order, order[1:])]
        edges[1].update({'sourceHandle': 'ocr_text', 'targetHandle': 'ocr_text'})
        graph = {'nodes': nodes, 'edges': edges}
        validation = api(args.base, '/api/workflows/validate', token=token, method='POST', payload={'graph': graph})
        if validation.get('errors'):
            raise RuntimeError(f'Workflow validation failed: {validation["errors"]}')
        workflow = api(args.base, '/api/workflows', token=token, method='POST', payload={
            'name': name, 'graph': graph, 'project_id': project_id,
        })
        print('Saved workflow:', workflow['id'], 'SOHA artifact:', artifact['id'])
    print('Editor: ', f'http://localhost:5174/projects/{project_id}/workspace?workflow={workflow["id"]}')
    if args.scoring_case_id:
        score_name = 'Sabanour R&D proposal — score submitted reviews'
        if any(item['name'] == score_name for item in existing):
            print('Existing scoring workflow:', next(item['id'] for item in existing if item['name'] == score_name))
        else:
            score_graph = {'nodes': [
                node('responses', 'RV-010', 'خواندن نظرات ثبت‌شده', 0,
                     {'case_id': args.scoring_case_id, 'form_id': 'expert_review'}),
                node('scores', 'RV-007', 'تجمیع امتیاز انسانی', 320,
                     {'form_id': 'expert_review', 'minimum_reviewers': 1}),
            ], 'edges': [{'id': 'responses-scores', 'source': 'responses', 'sourceHandle': 'case',
                          'target': 'scores', 'targetHandle': 'case'}]}
            validation = api(args.base, '/api/workflows/validate', token=token, method='POST', payload={'graph': score_graph})
            if validation.get('errors'):
                raise RuntimeError(f'Scoring workflow validation failed: {validation["errors"]}')
            scoring = api(args.base, '/api/workflows', token=token, method='POST',
                          payload={'name': score_name, 'graph': score_graph, 'project_id': project_id})
            print('Saved scoring workflow:', scoring['id'], 'case:', args.scoring_case_id)


if __name__ == '__main__':
    main()

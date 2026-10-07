from __future__ import annotations

import json
import copy
from types import SimpleNamespace
import pytest

import app.nodes.review.nodes as review_nodes
from app.nodes.review.nodes import (
    AIReviewNode, AssignReviewNode, CaseIntakeNode, CaseValidationNode, DecisionNode,
    DEFAULT_INTAKE_FIELDS, LoadReviewResponsesNode, RecordReviewNode, ReviewFormNode, ScoreAggregationNode,
    _requested_extraction_values,
)
from app.nodes.review.contract import validate_response
from app.workflow.contracts.errors import NodeContractError
from app.workflow.validation.service import validate_workflow_graph


def node(rid: str):
    return {'id': rid, 'type': rid, 'data': {'registryId': rid, 'label': rid}}


def connected(port: str, value):
    return {'_by_port': {port: [value]}}


def test_extraction_ignores_model_keys_outside_requested_schema():
    result = _requested_extraction_values({
        'fields': {'title': 'Supported title', 'helpful_note': 'extra'},
    }, {'title', 'summary'})
    assert result == {'title': 'Supported title'}


def test_extraction_accepts_common_model_shapes_and_unknown_output():
    assert _requested_extraction_values({'title': 'top level'}, {'title'}) == {'title': 'top level'}
    assert _requested_extraction_values({'fields': [{'id': 'title', 'value': 'list value'}]}, {'title'}) == {
        'title': 'list value',
    }
    assert _requested_extraction_values({'message': 'no supported values'}, {'title'}) == {}


def test_form_review_scoring_and_decision_use_one_case_contract():
    case = CaseIntakeNode().run(node('RV-001'), {}, {'case_json': json.dumps({
        'case_id': 'SNR-1', 'fields': {'project_title': 'Iron ore research'},
    })}, None)['case']
    fields = [
        {'id': 'innovation', 'label': 'Innovation', 'type': 'number', 'required': True, 'min': 0, 'max': 15},
        {'id': 'technical', 'label': 'Technical', 'type': 'number', 'required': True, 'min': 0, 'max': 15},
    ]
    case = ReviewFormNode().run(node('RV-002'), connected('case', case), {
        'form_id': 'expert_review', 'title': 'Expert review', 'fields': fields,
        'assignee_role': 'expert', 'due_days': 7,
    }, None)['case']
    for reviewer, values in [('a', {'innovation': 10, 'technical': 12}),
                             ('b', {'innovation': 14, 'technical': 14})]:
        case = RecordReviewNode().run(node('RV-006'), {'_by_port': {
            'case': [case], 'response': [{'reviewer_id': reviewer, 'answers': values}],
        }}, {'form_id': 'expert_review'}, None)['case']
    result = ScoreAggregationNode().run(node('RV-007'), connected('case', case),
                                         {'form_id': 'expert_review', 'minimum_reviewers': 2}, None)
    assert result['metrics']['criteria'] == {'innovation': 12, 'technical': 13}
    assert result['metrics']['total'] == 25
    assert result['metrics']['maximum'] == 30
    assert result['case']['status'] == 'scored'
    case = DecisionNode().run(node('RV-008'), {'_by_port': {
        'case': [result['case']], 'decision': [{'actor_id': 'committee', 'outcome': 'approved'}],
    }}, {'gate_id': 'gate_2'}, None)['case']
    assert case['status'] == 'approved'
    assert len(case['reviews']) == 2
    assert case['decisions'][0]['gate_id'] == 'gate_2'


def test_bad_form_score_and_missing_reviewer_are_actionable():
    case = CaseIntakeNode().run(node('RV-001'), {}, {'case_json': '{"case_id":"X"}'}, None)['case']
    with pytest.raises(NodeContractError, match='not found'):
        ScoreAggregationNode().run(node('RV-007'), connected('case', case), {'form_id': 'missing'}, None)
    case = ReviewFormNode().run(node('RV-002'), connected('case', case), {
        'form_id': 'review', 'title': 'Review', 'fields': [
            {'id': 'quality', 'label': 'Quality', 'type': 'number', 'required': True, 'min': 0, 'max': 10}],
        'due_days': 7,
    }, None)['case']
    with pytest.raises(NodeContractError) as exc:
        RecordReviewNode().run(node('RV-006'), {'_by_port': {
            'case': [case], 'response': [{'reviewer_id': 'a', 'answers': {'quality': 12}}],
        }}, {'form_id': 'review'}, None)
    assert exc.value.problem.code == 'REVIEW_RESPONSE_FIELDS_INVALID'
    assert exc.value.problem.details['errors'][0]['field'] == 'quality'
    with pytest.raises(NodeContractError) as exc:
        ScoreAggregationNode().run(node('RV-007'), connected('case', case),
                                   {'form_id': 'review', 'minimum_reviewers': 1}, None)
    assert exc.value.problem.code == 'REVIEW_INCOMPLETE'


def test_ai_review_exposes_per_criterion_maxima_for_score_visualizations(monkeypatch):
    case = CaseIntakeNode().run(node('RV-001'), {}, {'case_json': '{"case_id":"AI-1"}'}, None)['case']
    case = ReviewFormNode().run(node('RV-002'), connected('case', case), {
        'form_id': 'review', 'title': 'Review', 'due_days': 7,
        'fields': [
            {'id': 'innovation', 'label': 'Innovation', 'type': 'score', 'required': True, 'min': 0, 'max': 15},
            {'id': 'technical', 'label': 'Technical', 'type': 'score', 'required': True, 'min': 0, 'max': 25},
            {'id': 'impact', 'label': 'Impact', 'type': 'score', 'required': True, 'min': 0, 'max': 10},
        ],
    }, None)['case']
    case['documents'] = [{'page_text': [{'page': 1, 'text': 'Evidence from the proposal.'}]}]
    monkeypatch.setattr(review_nodes, 'ask_json', lambda **_: {
        'scores': {'innovation': 12, 'technical': 18, 'impact': 9},
        'evidence': {}, 'summary': 'Summary', 'concerns': [],
    })

    result = AIReviewNode().run(node('RV-005'), connected('case', case), {
        'form_id': 'review', 'user_prompt': 'Score every criterion.', 'max_document_chars': 30000,
    }, None)

    assert result['output']['ai_review']['maxima'] == {'innovation': 15, 'technical': 25, 'impact': 10}
    assert result['case']['ai_reviews'][0]['maxima'] == {'innovation': 15, 'technical': 25, 'impact': 10}


def test_validation_missing_field_is_a_finding_not_a_run_failure():
    case = CaseIntakeNode().run(node('RV-001'), {}, {'case_json': '{"case_id":"X"}'}, None)['case']
    result = CaseValidationNode().run(node('RV-004'), connected('case', case), {
        'required_field_ids': 'project_title, budget', 'user_prompt': '',
    }, None)['case']
    assert result['validation']['valid'] is False
    assert {item['field'] for item in result['validation']['errors']} == {'project_title', 'budget'}


def test_review_ports_block_dataframe_connection():
    graph = {'nodes': [node('DI-002'), node('RV-004')], 'edges': [{
        'id': 'e', 'source': 'DI-002', 'sourceHandle': 'dataframe',
        'target': 'RV-004', 'targetHandle': 'case',
    }]}
    result = validate_workflow_graph(graph, require_settings=False)
    assert any(item.type == 'incompatible_ports' for item in result.errors)


def test_intake_generates_a_distinct_case_id_from_the_run():
    result = CaseIntakeNode().run(node('RV-001'), {}, {
        'case_json': '{"fields":{}}', 'id_prefix': 'SNR',
    }, SimpleNamespace(execution_id=68))
    assert result['case']['case_id'] == 'SNR-68'


def test_intake_collects_primary_pdf_and_supporting_files_without_json():
    context = SimpleNamespace(execution_id=75, project_id=5, artifact_metadata={
        '62': {'artifact_id': 62, 'filename': 'proposal.pdf', 'content_type': 'application/pdf'},
        '63': {'artifact_id': 63, 'filename': 'budget.xlsx', 'content_type': 'application/vnd.ms-excel'},
    })
    result = CaseIntakeNode().run(node('RV-001'), {}, {
        'title': 'SOHA', 'proposer': 'Research team', 'proposal_pdf': 62,
        'supporting_files': [63], 'id_prefix': 'SNR',
    }, context)['case']
    assert result['case_id'] == 'SNR-75'
    assert result['project_id'] == 5
    assert result['fields']['project_title'] == 'SOHA'
    assert [item['filename'] for item in result['documents']] == ['proposal.pdf', 'budget.xlsx']
    assert result['documents'][0]['primary'] is True


def test_intake_fields_match_project_registration_columns_and_keep_display_names():
    fields = copy.deepcopy(DEFAULT_INTAKE_FIELDS)
    assert [item['label'] for item in fields] == [
        'کد پروژه', 'عنوان پروژه', 'واحد پیشنهاددهنده', 'مدیر پروژه', 'داور',
        'نوع پروژه', 'حوزه پروژه', 'تاریخ شروع', 'مدت اجرا (ماه)',
        'بودجه (میلیون ریال)', 'هدف پروژه',
    ]
    for item in fields:
        if item['id'] == 'project_title':
            item['label'] = 'عنوان سفارشی'
            item['value'] = 'پروژه آزمایشی'
        if item['id'] == 'duration_months':
            item['value'] = '8'
    fields.append({'id': 'custom_abc123', 'label': 'شاخص جدید', 'type': 'number', 'value': '3.5'})
    result = CaseIntakeNode().run(node('RV-001'), {}, {'intake_fields': fields, 'id_prefix': 'SNR'},
                                  SimpleNamespace(execution_id=81, project_id=5))
    case = result['case']
    assert case['case_id'] == 'SNR-81'
    assert case['fields']['project_code'] == 'SNR-81'
    assert case['fields']['project_title'] == 'پروژه آزمایشی'
    assert case['fields']['duration_months'] == 8
    assert case['fields']['custom_abc123'] == 3.5
    assert result['output']['field_labels']['project_title'] == 'عنوان سفارشی'


def test_intake_rejects_invalid_dynamic_numbers_and_duplicate_keys():
    context = SimpleNamespace(execution_id=81, project_id=5)
    with pytest.raises(NodeContractError) as exc:
        CaseIntakeNode().run(node('RV-001'), {}, {'intake_fields': [
            {'id': 'duration_months', 'label': 'مدت اجرا', 'type': 'number', 'value': 'eight'},
        ]}, context)
    assert exc.value.problem.code == 'REVIEW_INTAKE_VALUE_INVALID'
    assert exc.value.problem.setting == 'intake_fields'
    with pytest.raises(NodeContractError) as exc:
        CaseIntakeNode().run(node('RV-001'), {}, {'intake_fields': [
            {'id': 'same', 'label': 'اول', 'type': 'text', 'value': ''},
            {'id': 'same', 'label': 'دوم', 'type': 'text', 'value': ''},
        ]}, context)
    assert exc.value.problem.code == 'REVIEW_INTAKE_FIELD_INVALID'


def test_intake_rejects_file_outside_project_with_a_fix():
    with pytest.raises(NodeContractError) as exc:
        CaseIntakeNode().run(node('RV-001'), {}, {'proposal_pdf': 99},
                             SimpleNamespace(execution_id=75, project_id=5, artifact_metadata={}))
    assert exc.value.problem.code == 'REVIEW_ARTIFACT_UNAVAILABLE'
    assert exc.value.problem.setting == 'proposal_pdf'
    assert 'Upload or select' in exc.value.problem.suggested_fix


def test_dynamic_intake_emits_assignable_form_without_consuming_setting_values():
    fields = copy.deepcopy(DEFAULT_INTAKE_FIELDS)
    fields[1]['value'] = 'Should not be submitted yet'
    result = CaseIntakeNode().run(node('RV-001'), {}, {
        'input_mode': 'dynamic', 'form_id': 'project_intake', 'intake_fields': fields, 'id_prefix': 'SNR',
    }, SimpleNamespace(execution_id=93, project_id=5, artifact_metadata={}))
    assert result['output']['kind'] == 'review_form'
    assert result['output']['form_id'] == 'project_intake'
    assert result['case']['fields'] == {'project_code': 'SNR-93'}
    assert len(result['case']['forms']['project_intake']['fields']) == 11


def test_case_intake_batches_selected_pdfs_as_independent_cases():
    context = SimpleNamespace(execution_id=96, project_id=5, artifact_metadata={
        '11': {'filename': 'proposal-one.pdf', 'content_type': 'application/pdf', 'checksum_sha256': 'a' * 64},
        '12': {'filename': 'proposal-two.pdf', 'content_type': 'application/pdf', 'checksum_sha256': 'b' * 64},
    })
    result = CaseIntakeNode().run(node('RV-001'), {}, {
        'proposal_pdf': [11, 12], 'supporting_files': [], 'input_mode': 'static',
        'intake_fields': copy.deepcopy(DEFAULT_INTAKE_FIELDS),
    }, context)
    assert result['output']['kind'] == 'review_batch'
    assert result['output']['case_count'] == 2
    assert [case['case_id'] for case in result['case']['cases']] == ['proposal-one', 'proposal-two']
    assert [case['documents'][0]['artifact_id'] for case in result['case']['cases']] == [11, 12]


def test_static_form_writes_typed_values_and_requires_completed_fields():
    case = CaseIntakeNode().run(node('RV-001'), {}, {'case_json': '{"case_id":"SNR-2"}'}, None)['case']
    field = {'id': 'approved_budget', 'label': 'Approved budget', 'type': 'number',
             'required': True, 'min': 0, 'max': 100, 'value': 42}
    result = ReviewFormNode().run(node('RV-002'), connected('case', case), {
        'input_mode': 'static', 'form_id': 'budget', 'title': 'Budget', 'fields': [field],
    }, None)
    assert result['output']['kind'] == 'review_stage'
    assert result['case']['fields']['approved_budget'] == 42
    assert result['output']['field_labels']['approved_budget'] == 'Approved budget'
    with pytest.raises(NodeContractError) as exc:
        AssignReviewNode().run(node('RV-009'), connected('case', result['case']),
                               {'assignees': 'reviewer'}, None)
    assert exc.value.problem.code == 'REVIEW_STATIC_FORM_NOT_ASSIGNABLE'
    with pytest.raises(NodeContractError) as exc:
        ReviewFormNode().run(node('RV-002'), connected('case', case), {
            'input_mode': 'static', 'form_id': 'budget', 'title': 'Budget', 'fields': [{**field, 'value': None}],
        }, None)
    assert exc.value.problem.code == 'REVIEW_STATIC_FORM_VALUES_INVALID'


def test_dynamic_form_loads_one_assignee_into_case_fields_after_submission():
    form = {'form_id': 'project_intake', 'title': 'Intake', 'due_days': 7,
            'fields': [{'id': 'project_title', 'label': 'Title', 'type': 'text', 'required': True}]}
    task = {'task_id': 12, 'reviewer_id': 'owner', 'status': 'completed', 'answers': {'project_title': 'New project'}}
    context = SimpleNamespace(project_id=5, review_task_data={'SNR-2:project_intake': {
        'fields': {'project_code': 'SNR-2'}, 'documents': [], 'form': form, 'tasks': [task],
    }})
    result = LoadReviewResponsesNode().run(node('RV-010'), {}, {
        'case_id': 'SNR-2', 'form_id': 'project_intake', 'response_target': 'fields',
    }, context)
    assert result['case']['fields']['project_title'] == 'New project'
    assert result['case']['field_labels']['project_title'] == 'Title'
    assert result['case']['reviews'] == []
    assert result['case']['history'][0]['actor_id'] == 'owner'
    context.review_task_data['SNR-2:project_intake']['tasks'] = [{**task, 'status': 'open', 'answers': None}]
    with pytest.raises(NodeContractError) as exc:
        LoadReviewResponsesNode().run(node('RV-010'), {}, {
            'case_id': 'SNR-2', 'form_id': 'project_intake', 'response_target': 'fields',
        }, context)
    assert exc.value.problem.code == 'REVIEW_FORM_AWAITING_RESPONSE'
    context.review_task_data['SNR-2:project_intake']['tasks'] = [task, {**task, 'reviewer_id': 'second'}]
    with pytest.raises(NodeContractError) as exc:
        LoadReviewResponsesNode().run(node('RV-010'), {}, {
            'case_id': 'SNR-2', 'form_id': 'project_intake', 'response_target': 'fields',
        }, context)
    assert exc.value.problem.code == 'REVIEW_FIELDS_SINGLE_ASSIGNEE_REQUIRED'


def test_assignment_uses_the_only_published_form_without_matching_ids_by_hand():
    result = CaseIntakeNode().run(node('RV-001'), {}, {
        'input_mode': 'dynamic', 'intake_fields': [{'id': 'project_title', 'label': 'Title', 'type': 'text'}],
    }, SimpleNamespace(execution_id=94, project_id=5, artifact_metadata={}))
    assigned = AssignReviewNode().run(node('RV-009'), connected('case', result['case']),
                                      {'form_id': '', 'assignees': 'reviewer'}, None)
    assert assigned['_review_task_intent']['form_id'] == 'project_intake'
    assert assigned['_review_task_intent']['assignees'] == ['reviewer']


def test_assignment_follows_the_latest_form_on_its_connected_branch():
    intake = CaseIntakeNode().run(node('RV-001'), {}, {
        'input_mode': 'dynamic', 'intake_fields': [{'id': 'project_title', 'label': 'Title', 'type': 'text'}],
    }, SimpleNamespace(execution_id=95, project_id=5, artifact_metadata={}))
    review = ReviewFormNode().run(node('RV-002'), connected('case', intake['case']), {
        'input_mode': 'dynamic', 'form_id': 'expert_review', 'title': 'Expert review',
        'fields': [{'id': 'score', 'label': 'Score', 'type': 'score', 'required': True, 'min': 0, 'max': 10}],
        'due_days': 7,
    }, SimpleNamespace(execution_id=95, project_id=5))
    assert sorted(review['case']['forms']) == ['expert_review', 'project_intake']
    assigned = AssignReviewNode().run(node('RV-009'), connected('case', review['case']),
                                      {'form_id': '', 'assignees': 'reviewer'}, None)
    assert assigned['_review_task_intent']['form_id'] == 'expert_review'


def test_completed_review_tasks_advance_status_before_scoring():
    form = {'form_id': 'expert_review', 'title': 'Review', 'due_days': 7,
            'fields': [{'id': 'quality', 'label': 'Quality', 'type': 'score',
                        'required': True, 'min': 0, 'max': 10}]}
    context = SimpleNamespace(project_id=5, review_task_data={'SNR-1:expert_review': {
        'fields': {'project_title': 'Proposal'}, 'documents': [], 'form': form,
        'tasks': [{'task_id': 8, 'reviewer_id': 'expert', 'status': 'completed',
                   'answers': {'quality': 8}}],
    }})
    loaded = LoadReviewResponsesNode().run(node('RV-010'), {},
        {'case_id': 'SNR-1', 'form_id': 'expert_review'}, context)
    assert loaded['case']['status'] == 'reviews_complete'
    assert loaded['output']['review_responses'] == [{
        'task_id': 8,
        'reviewer_id': 'expert',
        'answers': {'quality': 8},
        'score_total': 8.0,
        'score_maximum': 10.0,
    }]
    assert loaded['output']['form_fields'][0]['label'] == 'Quality'
    scored = ScoreAggregationNode().run(node('RV-007'), connected('case', loaded['case']),
        {'form_id': 'expert_review', 'minimum_reviewers': 1}, context)
    assert scored['case']['status'] == 'scored'
    assert scored['output']['kind'] == 'review_score'


def test_score_field_rejects_nonfinite_value():
    fields = [{'id': 'score', 'label': 'Score', 'type': 'number', 'required': True, 'min': 0, 'max': 15}]
    assert validate_response(fields, {'score': float('inf')})[0]['code'] == 'type'


def test_explicit_score_fields_exclude_other_numbers_from_rubric():
    case = CaseIntakeNode().run(node('RV-001'), {}, {'case_json': '{"case_id":"BUDGET-1"}'}, None)['case']
    case = ReviewFormNode().run(node('RV-002'), connected('case', case), {
        'form_id': 'review', 'title': 'Review', 'due_days': 7,
        'fields': [
            {'id': 'budget', 'label': 'Budget', 'type': 'number', 'required': True, 'min': 0, 'max': 1000000},
            {'id': 'innovation', 'label': 'Innovation', 'type': 'score', 'required': True, 'min': 0, 'max': 15},
        ],
    }, None)['case']
    case = RecordReviewNode().run(node('RV-006'), {'_by_port': {
        'case': [case], 'response': [{'reviewer_id': 'expert', 'answers': {'budget': 100000, 'innovation': 12}}],
    }}, {'form_id': 'review'}, None)['case']
    result = ScoreAggregationNode().run(node('RV-007'), connected('case', case),
                                        {'form_id': 'review', 'minimum_reviewers': 1}, None)
    assert result['metrics']['total'] == 12
    assert result['metrics']['maximum'] == 15

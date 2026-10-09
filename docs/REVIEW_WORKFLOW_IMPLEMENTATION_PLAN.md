# Reusable review workflows in IOTA ML

## Product model

The process chart and Sabanour workbook are reference data, not instructions to the application. The product should model a **case** (one proposal or other request), its immutable document versions, structured fields, assigned human tasks, reviews, decisions, and a chronological audit trail. A workflow definition is a template; each case is a separate execution of it. The target design resumes a case automatically after authenticated users submit their forms. A regular IOTA scientific run remains a finite, synchronous DAG and should not be held open while a person responds. The current implementation resumes in a second run started by the user.

Review nodes share one versioned `case` JSON envelope: `schema_version`, `case_id`, `project_id`, `fields`, `documents`, `reviews`, `decisions`, `status`, and `history`. Keys are stable machine names such as `project_title`; Persian labels are display metadata. Current ports are typed `case`, `json` (integration inputs), and `metrics`, with connection checks and runtime schema checks. Dynamic form fields use stable IDs and type declarations. A schema migration is required to change a published form with in-flight tasks.

## Node set and order

| Node | Input → output | Essential settings | Typical next node |
|---|---|---|---|
| Case Intake | form submission + files → case | form template, ID policy | OCR Documents |
| OCR Documents | case + PDFs → OCR text JSON | per-document page limit | Extract Proposal Information |
| Extract Proposal Information | OCR text JSON → case + extracted fields | field specification prompt | Validate, AI Review |
| Validate | case → case + findings | required typed fields, rules, optional model prompt | Decision or Human Task |
| AI Review | case → case + structured review | rubric, prompt, evidence requirement | Human Task |
| Human Task / Form | case → task; submitted task → case + response | form fields, assignee role/user, due date, completion policy | Aggregate or Decision |
| Aggregate | case with reviews → metrics | criterion IDs, weights, missing review policy | Decision |
| Decision | case + metrics → case + selected route | explicit branches and authority | Task, notification, next gate |
| Wait / Reminder | task/case → timed event | due date, escalation | Notification or Human Task |
| Notification | case event → delivery record | recipient role, template, channel | Case Record |
| Case Record | case → saved case/event | retention and visibility | Dashboard |

Gate 1 is intake → extraction → validation → initial human decision. Gate 2 assigns parallel reviewer forms, aggregates the eight Sabanour criteria to 100, and records the committee decision. Gate 3 consumes monthly progress forms and lets the committee continue, request changes, or stop. Rejection and revision loops create new events and document versions; they never overwrite past review evidence.

## Forms and dashboards

The form builder supports short text, long text, number, score (with range), date, choice, boolean, and file. It requires a stable field ID and label, with a required flag. Explicit score fields are the rubric; older numeric-only forms remain compatible. Reviewer responses are separate records; reviewers see proposal documents and their scores are not overwritten by AI. Showing AI evidence alongside the form is a follow-up.

Managers see counts by gate/status, overdue tasks, review turnaround, requested budget, score distribution, and decisions with drill-through to evidence. Reviewers see assigned tasks, due dates, required documents, and their own submitted responses. Project workers see milestones, monthly progress, requests for revision, and final outcomes. Dashboard queries use materialized case/task summaries with pagination; the large original workbook is an import source, not the live database.

## Error and performance contract

Validate port type, schema version, required fields, score bounds, form/rubric IDs, assignee permissions, and branch coverage before publishing a workflow. At runtime, return stable error codes with the failing node, field/setting, expected value, actual value where safe, and a concrete fix. Network/model errors identify timeout, rate limit, credentials, or provider outage. A case pauses in a recoverable state; retries must be idempotent so they cannot duplicate tasks or notifications. Human decisions never silently fall back to an AI result.

Every PDF page passes through the dedicated OCR API, including PDFs that also contain an embedded text layer. The OCR node returns versioned JSON with document metadata and page-level text; extraction is a separate model call that consumes only this JSON. Bound page count, prompt size, model output size, concurrent calls, and retries. Keep full documents in artifact storage and preserve page citations through extraction. Model names are configured independently with `IOTA_OCR_MODEL`, `IOTA_EXTRACT_MODEL`, and `IOTA_REVIEW_MODEL`, using the existing `OPENAI_API_KEY` and `OPENAI_BASE_URL`. Capture model name, source document version, and execution ID in each AI result.

## Delivery gates

1. Establish typed case/rubric/form contracts, node settings UI, document extraction and AI/validation nodes, with the SOHA proposal as a fixture. Verify catalog, errors, type safety, and bounded resource use.
2. Add persisted cases, form tasks, authenticated assignee inbox, revisions, and resume-after-submit orchestration. Verify assignment privacy, concurrency, idempotency, and full Gate 1–2 execution.
3. Add Gate 3 progress tracking, notifications, dashboards, workbook importer, and report views. Reconcile imported workbook rows and Sabanour's eight weights and sample totals.
4. Demonstrate approval, revision, rejection, and model failure in the admin UI. Load-test multiple proposals and reviewers, then harden audit, access control, and deployment configuration.

## Delivered implementation and how to demonstrate it

The first working slice is available in the **Review Workflows** palette. RV-001 exposes a PDF upload/selector, optional supporting files, and an editable Intake field list. The list starts with the 11 project-table columns (A–K) on the Sabanour workbook's `ثبت پروژه` sheet. Each field has a display name, text/number type, value, and stable internal ID; a user can add, rename, or remove fields without exposing JSON or changing IDs on rename. The project code may be supplied in the first field or generated from the run ID when blank. The sheet's M–N columns are a separate area-code lookup, not project-record fields. RV-011 OCR Documents reads every page of every PDF in the case and emits structured OCR JSON. RV-003 Extract Proposal Information consumes that JSON and uses `IOTA_EXTRACT_MODEL` for configured fields. RV-002 publishes a typed form; RV-004 checks required fields and optional model concerns; RV-005 provides advisory scores; RV-009 creates authenticated form tasks; RV-010 and RV-007 load submitted human answers and calculate scores. The graph carries the typed `case` around the explicit OCR JSON stage, while the results panel and analysis board show readable proposal, extraction, validation, and scoring cards. RV-006 and RV-008 accept explicit JSON review/decision inputs for integrations, but a production gate decision should come from an authenticated task response rather than an unverified actor string.

The reviewer inbox is `/review-tasks`. The reviewer form supports typed fields and task-scoped file uploads. A project reviewer can attach a file to an assigned task without acquiring project editing permission.

RV-001 Intake, RV-002 Form Definition, and RV-003 Extract Proposal Information have a **static/dynamic input mode**. Static mode records typed values from node settings in `case.fields` and displays them as a readable case card; empty static extraction values are filled from RV-011 OCR JSON by AI. Dynamic mode emits a live form card alongside the unchanged typed `case` port. Connect that port to RV-009 Assign Form Tasks. RV-009 selects the form automatically when there is exactly one; it requires an explicit form ID when there are several and rejects static forms. An assigned user can fill the form from their inbox or from the pinned board card; other project viewers see a read-only preview. The board card matches the exact run, project, case, and form, so an old card cannot silently submit to a later task. Settings cards collapse for easier editing, and field IDs remain stable while labels change.

Each assigned user's answer is stored as a separate, immutable task response with assignee identity and completion time. Only the assigned user can submit or upload a task file; managers and administrators with project access can inspect tasks. RV-010 defaults to loading responses into `case.reviews` for scoring, preserving all reviewers independently. Set its response target to **case fields** for Intake or extraction correction; that requires exactly one assignee and a completed response, then merges the typed answers into `case.fields` with display labels. A pending response produces a clear recoverable error. To fill a board form yourself, assign the form to your own project user with RV-009. A dynamic graph ends at assignment; continue from RV-010 in a later run after submission. Automatic continuation is still a separate delivery item.

Run `python3 scripts/create_sabanour_demo.py --pdf ../SOHA_prposal.pdf --scoring-case-id CASE_ID` to save two graphs in a demo project that the admin can open in the editor. The first graph has the SOHA PDF selected on Intake and the eight workbook weights totaling 100 in its form. The Intake picker can upload a replacement PDF or select one already in the project. Its case ID is generated at runtime (for example `SNR-74`); the reviewer submits the generated task in `/review-tasks`. Set that case ID on RV-010 in the second graph, then run RV-010 → RV-007 to score the submitted forms. Pin the resulting score card to the analysis board to show a manager the total and each criterion. `python3 scripts/review_smoke.py --pdf ../SOHA_prposal.pdf --with-ai` exercises the same path through the API. The two runs are currently launched separately; automatic pause/resume and reminders are next-stage work.

For this rollout, prioritize a persisted case record and automatic continuation after the minimum form completions, then authenticated decision forms and branch routing. Add notification/escalation, immutable document and form versioning, workbook import, and Gate 3 progress dashboards before claiming full end-to-end Sabanour coverage. The sample workbook is used for rubric weights; it is not yet imported as live case data. Test project-scoped access with multiple reviewer accounts and load-test concurrent proposals before production deployment.

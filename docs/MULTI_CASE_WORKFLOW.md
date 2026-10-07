# Multi-case review workflow

## Operating model

Each imported PDF is stored as one durable case. Starting several cases creates one queued workflow run per case, so a failure, retry, new import, or human form submission cannot rerun unrelated cases.

The selected workflow must contain `Case Intake` and `Assign Form Tasks`. The case launcher binds the case PDF and fields to Intake, applies the reviewer usernames to the assignment node, and runs through assignment. It also adds a disconnected `Load Review Responses` → `Score Aggregation` branch to the execution snapshot when that branch is absent.

When every scoring task created for a case and form has been submitted, the task service creates one idempotent continuation run targeting the scoring branch. The continuation loads each user's immutable response separately and aggregates the configured score criteria. Extraction and AI review do not run again.

## User flow

1. Open a project and choose **Cases and results**.
2. Select several PDF files. Review the generated case ID and title, then enter the case-specific proposer, project manager, and requested budget where available.
3. Select the intake/review workflow and enter one or more reviewer usernames separated by commas.
4. Use **Run new cases** or select table rows and use **Run selected**.
5. Reviewers submit their own scoring forms from the task inbox.
6. The scoring continuation starts automatically after the last assigned response for that case arrives.
7. Select a case on the results board to inspect extracted fields, AI advice, each user's score, and the aggregated result. Search by case or title, filter by status, or enter a minimum score.

## Persistence and retry rules

- Import never starts a run and never changes another case.
- **Run new cases** only selects records with status `new`.
- Active cases are skipped by bulk launch.
- Explicitly selecting a completed or failed case creates a new intake attempt while retaining older run history.
- Automatic scoring uses an idempotency key scoped to the case, source run, and form, preventing duplicate continuation runs.
- Board filters query persisted score columns; they do not scan historical run JSON in the browser.

# Workflow execution and error contract

## Execution scope

The frontend builds the submitted graph in `executionGraph.ts`.

- With no selected node, the complete workflow graph is submitted.
- With one selected node, only that node and every transitive upstream
  dependency are submitted. Downstream and unrelated nodes are excluded.
- The backend validates and topologically executes the submitted graph; it does
  not infer a second, conflicting scope.

The Run control is a toggle. During an active run, the same control requests
cancellation. The reliable worker writes the cancellation marker and terminates
the child process, so cancellation also interrupts a long-running node rather
than waiting for the next node boundary.

## Error ownership

`app.workflow.errors.WorkflowProblem` is the canonical runtime error schema.

| Field | Purpose |
| --- | --- |
| `code` | Stable machine-readable identifier |
| `category` | `input`, `setting`, `data`, `execution`, or `application` |
| `responsibility` | `user` for fixable workflow contracts; `application` for defects |
| `node_id`, `node_name` | Exact failing node |
| `port`, `setting`, `column` | Exact contract location when known |
| `expected`, `actual` | Rejected contract comparison |
| `suggested_fix` | Direct corrective action |
| `error_type` | Original Python exception type |

Nodes should raise `NodeContractError` for known user-correctable failures.
Unannotated `ValueError` and `KeyError` exceptions are normalized as data
contract errors for legacy nodes. Unexpected exceptions such as `TypeError`
remain application-owned so implementation defects are not disguised as user
configuration problems.

Graph validation uses the parallel `ValidationMessage` contract and the Run API
returns it in the standard application error envelope:

```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_VALIDATION_FAILED",
    "message": "Workflow validation failed.",
    "details": { "errors": [] }
  },
  "request_id": "..."
}
```

## Adding a node

1. Declare typed, required, and repeatable ports accurately.
2. Use `ensure_df` for a required non-empty dataframe.
3. Raise `NodeContractError` with a stable code for setting-, port-, column-, or
   shape-specific validation.
4. Return explicit `outputs_by_port` when several declared ports have values.
5. Use `visible_outputs_only` only when the node owns an intentional composite
   display contract, such as anomaly results or the interactive editor.
6. Add regression tests for disconnected input, missing columns, empty data,
   invalid settings, and repeated execution.

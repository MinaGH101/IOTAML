import assert from 'node:assert/strict';
import test from 'node:test';
import { applyInteractiveTableState, initializeTableSelection, normalizeInteractiveTableState, toggleSelection, withCellEdit, } from './interactiveTableState.ts';
test('interactive cell edits preserve other persisted operations', () => {
    const next = withCellEdit({
        selected_rows: ['source:0'],
        cell_edits: { 'source:1': { A: 2 } },
    }, 'source:0', 'A', 99);
    assert.deepEqual(next.selected_rows, ['source:0']);
    assert.deepEqual(next.cell_edits, {
        'source:1': { A: 2 },
        'source:0': { A: 99 },
    });
});
test('row and column multi-selection toggles independently', () => {
    assert.deepEqual(toggleSelection(['A'], 'B'), ['A', 'B']);
    assert.deepEqual(toggleSelection(['A', 'B'], 'A'), ['B']);
});
test('malformed persisted interactive table state is normalized safely', () => {
    const normalized = normalizeInteractiveTableState({
        cell_edits: 'invalid',
        added_rows: [{ key: 'added:1', values: null }, null],
        added_columns: [{ name: 'B', default: 0 }, { name: '' }],
        selected_rows: 'invalid',
        selected_columns: ['A', 'A', null],
    });
    assert.deepEqual(normalized.cell_edits, {});
    assert.deepEqual(normalized.added_rows, [{ key: 'added:1', values: {} }]);
    assert.deepEqual(normalized.added_columns, [{ name: 'B', default: 0 }]);
    assert.deepEqual(normalized.selected_rows, []);
    assert.deepEqual(normalized.selected_columns, ['A']);
});
test('interactive table selects every source row and column by default', () => {
    const initialized = initializeTableSelection({}, ['source:0', 'source:1'], ['id', 'A']);
    assert.equal(initialized.selection_initialized, true);
    assert.deepEqual(initialized.selected_rows, ['source:0', 'source:1']);
    assert.deepEqual(initialized.selected_columns, ['id', 'A']);
});
test('linked result applies edits and explicit row and column deselection', () => {
    const linked = applyInteractiveTableState([{ id: 1, A: 10 }, { id: 2, A: 20 }], ['id', 'A'], {
        selection_initialized: true,
        selected_rows: ['source:0'],
        selected_columns: ['A'],
        cell_edits: { 'source:0': { A: 99 } },
    });
    assert.deepEqual(linked.resultColumns, ['A']);
    assert.deepEqual(linked.resultRows, [{ A: 99 }]);
});

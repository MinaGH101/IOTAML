import assert from 'node:assert/strict';
import test from 'node:test';
import { isIdColumnParameter, resolveParameterColumns } from './parameterModel.ts';

test('parameter model separates calculation and original ID options', () => {
  const result = resolveParameterColumns({
    isCsvNode: false,
    csvColumns: [],
    availableColumns: ['sample_id', 'Au', 'Cu'],
    availableIdColumns: ['sample_id', 'batch_id', 'Au', 'Cu'],
    inheritedIdColumn: 'sample_id',
    params: {},
  });
  assert.deepEqual(result.calculationColumns, ['Au', 'Cu']);
  assert.deepEqual(result.idColumns, ['sample_id', 'batch_id', 'Au', 'Cu']);
  assert.equal(result.configuredIdColumn, 'sample_id');
  assert.equal(isIdColumnParameter('dataframe_id_column'), true);
});

test('a newly selected ID is removed from calculation selectors', () => {
  const result = resolveParameterColumns({
    isCsvNode: false,
    csvColumns: [],
    availableColumns: ['batch_id', 'Au'],
    availableIdColumns: ['sample_id', 'batch_id', 'Au'],
    inheritedIdColumn: 'sample_id',
    params: { id_column: 'batch_id' },
  });
  assert.deepEqual(result.calculationColumns, ['Au']);
});

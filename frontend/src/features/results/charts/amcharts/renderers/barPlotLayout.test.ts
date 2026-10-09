import assert from 'node:assert/strict';
import test from 'node:test';
import { getHorizontalBarLabelLayout } from './barPlotLayout.ts';

test('reserves a separate lane left of category names for horizontal group labels', () => {
  const layout = getHorizontalBarLabelLayout(
    ['innovation', 'scientific', 'economic'],
    ['proposal1', 'proposal2'],
    false,
  );

  assert.deepEqual(layout, {
    categoryLabelWidth: 75,
    groupLabelWidth: 62,
    groupLabelGap: 14,
  });
  const outerGroupLaneWidth = layout.groupLabelWidth + layout.groupLabelGap;
  const plotLeft = outerGroupLaneWidth + layout.categoryLabelWidth;
  const categoryLabelLeft = plotLeft - layout.categoryLabelWidth;
  const groupLabelRight = plotLeft - layout.categoryLabelWidth - layout.groupLabelGap;
  const groupLabelLeft = groupLabelRight - layout.groupLabelWidth;

  assert.equal(groupLabelLeft, 0);
  assert.equal(groupLabelRight, 62);
  assert.equal(categoryLabelLeft, 76);
  assert.ok(groupLabelRight < categoryLabelLeft);
});

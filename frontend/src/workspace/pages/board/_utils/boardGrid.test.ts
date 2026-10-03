import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnalysisBoardItem } from '../../../_model/board';
import { arrangeBoardRows, boardDisplayWidth, boardLayoutWidth, boardOuterWidthLimit, boardUnitWidth, clampBoardHeight, clampBoardWidth, insertBoardItem, moveBoardItem, resizeBoardPair } from './boardGrid.ts';

const item = (id: string, w: number, h = 320): AnalysisBoardItem => ({ id, nodeId: null, outputIndex: 0, outputTitle: id, outputKind: 'table', x: 0, y: 0, w, h, createdAt: '' });

test('four default cards fit across the board; a fifth wraps', () => {
    const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, 440));
    assert.deepEqual(arrangeBoardRows(cards, 1200).map((row) => row.items.map((entry) => entry.id)), [['a', 'b', 'c', 'd'], ['e']]);
    assert.deepEqual(arrangeBoardRows(cards, 700, 2).map((row) => row.items.map((entry) => entry.id)), [['a', 'b'], ['c', 'd'], ['e']]);
});

test('width and height resize continuously and cards keep independent heights', () => {
    const unit = boardUnitWidth(1200, 4);
    assert.equal(boardDisplayWidth(440, unit, 1200), 292.5);
    assert.equal(boardDisplayWidth(515, unit, 1200), 342.35795454545456);
    assert.equal(clampBoardWidth(515.4), 515);
    assert.equal(clampBoardWidth(100, unit, 4), 271);
    assert.equal(clampBoardWidth(2000, unit, 4), 1760);
    assert.equal(clampBoardHeight(337.8), 338);
    const rows = arrangeBoardRows([item('a', 440, 337), item('b', 440, 515)], 1200);
    assert.equal(rows[0].height, 515);
    assert.deepEqual(rows[0].items.map((entry) => entry.h), [337, 515]);
});

test('drop insertion works before and after a card', () => {
    const cards = [item('a', 440), item('b', 440), item('c', 440)];
    assert.deepEqual(moveBoardItem(cards, 'a', 'c').map((entry) => entry.id), ['b', 'a', 'c']);
    assert.deepEqual(moveBoardItem(cards, 'a', 'c', true).map((entry) => entry.id), ['b', 'c', 'a']);
    assert.deepEqual(insertBoardItem(cards, item('d', 440), 'b').map((entry) => entry.id), ['a', 'd', 'b', 'c']);
    assert.deepEqual(insertBoardItem(cards, item('d', 440), 'b', true).map((entry) => entry.id), ['a', 'b', 'd', 'c']);
});

test('dropping between rows creates and preserves an intentional row break', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => item(id, 440));
    const moved = moveBoardItem(cards, 'd', { targetId: 'b', after: true, newRow: true });
    assert.deepEqual(moved.map((entry) => entry.id), ['a', 'b', 'd', 'c']);
    assert.equal(moved[2].startsRow, true);
    assert.deepEqual(arrangeBoardRows(moved, 1200).map((row) => row.items.map((entry) => entry.id)), [['a', 'b'], ['d', 'c']]);
});

test('a moved row leader leaves its previous row boundary intact', () => {
    const cards = [item('a', 440), { ...item('b', 440), startsRow: true }, item('c', 440), item('d', 440)];
    const moved = moveBoardItem(cards, 'b', { targetId: 'd', after: true });
    assert.deepEqual(moved.map((entry) => entry.id), ['a', 'c', 'd', 'b']);
    assert.equal(moved[1].startsRow, true);
    assert.deepEqual(arrangeBoardRows(moved, 1200).map((row) => row.items.map((entry) => entry.id)), [['a'], ['c', 'd', 'b']]);
});

test('shared-edge resizing transfers width to the adjacent card without wrapping the row', () => {
    const unit = boardUnitWidth(1200, 4);
    const grown = resizeBoardPair(440, 440, 523, unit, 4);
    assert.deepEqual(grown, { width: 523, neighborWidth: 357 });
    assert.deepEqual(arrangeBoardRows([item('a', grown.width), item('b', grown.neighborWidth), item('c', 440), item('d', 440)], 1200).map((row) => row.items.length), [4]);
    assert.deepEqual(resizeBoardPair(440, 440, 800, unit, 4), { width: 609, neighborWidth: 271 });
    assert.deepEqual(resizeBoardPair(440, 440, 100, unit, 4), { width: 271, neighborWidth: 609 });
});

test('zoomed-out cards use the full visible board width', () => {
    const viewportWidth = 1200;
    const layoutWidth = boardLayoutWidth(viewportWidth, 0.5);
    const unit = boardUnitWidth(layoutWidth, 4);
    const cards = ['a', 'b', 'c', 'd'].map((id) => item(id, 440));
    const row = arrangeBoardRows(cards, layoutWidth, 4, unit)[0];
    assert.equal(layoutWidth, 2400);
    assert.equal(boardLayoutWidth(viewportWidth, 1.25), viewportWidth);
    assert.equal(row.items.length, 4);
    const occupied = cards.reduce((sum, card) => sum + boardDisplayWidth(card.w, unit, layoutWidth), 30);
    assert.equal(occupied, layoutWidth);
    assert.equal(occupied * 0.5, viewportWidth);
    assert.equal(boardOuterWidthLimit(row, 'd', layoutWidth, unit), 440);
});

import type { Output } from './output';

export const BOARD_OUTPUT_DRAG_TYPE = 'application/x-iotaml-board-output';
let draggedOutput: { output: Output; index: number } | null = null;

export function startBoardOutputDrag(dataTransfer: DataTransfer, output: Output, index: number) {
    draggedOutput = { output, index };
    dataTransfer.setData(BOARD_OUTPUT_DRAG_TYPE, 'output');
    dataTransfer.effectAllowed = 'copy';
}

export function getBoardOutputDrag() { return draggedOutput; }
export function clearBoardOutputDrag() { draggedOutput = null; }

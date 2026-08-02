import type { OutputReference } from '../../features/results/model/outputReference';
import type { Output } from './output';

export type AnalysisBoardItem = {
  id: string;
  nodeId: string | null;
  outputKey?: string;
  outputIndex: number;
  outputTitle: string;
  outputKind: string;
  sourceLabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  runId?: number | null;
  outputRef?: OutputReference;
  /** Legacy compatibility only. New Board items persist outputRef instead. */
  snapshot?: Output;
  createdAt: string;
};

export type BoardViewport = {
  x: number;
  y: number;
  scale: number;
};

export type AnalysisBoardTab = {
  id: string;
  name: string;
  items: AnalysisBoardItem[];
  viewport: BoardViewport;
  createdAt: string;
};

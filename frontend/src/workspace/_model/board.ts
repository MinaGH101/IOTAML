import type { Output } from './output';

export type AnalysisBoardItem = {
  id: string;
  nodeId: string | null;
  outputIndex: number;
  outputTitle: string;
  outputKind: string;
  sourceLabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  runId?: number | null;
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

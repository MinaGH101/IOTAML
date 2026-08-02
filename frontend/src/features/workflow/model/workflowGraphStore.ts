import type { SetStateAction } from 'react';
import { applyEdgeChanges, applyNodeChanges, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react';
import { createAtomicStore } from '../../../shared/state/atomicStore';
import { hasDocumentNodeChange, mergeCommittedPositions } from '../../../workspace/pages/workflow/_model/interactiveGraph';

export type WorkflowGraphState = {
  liveNodes: Node[];
  documentNodes: Node[];
  edges: Edge[];
  selectedId: string | null;
  selectedIds: string[];
  selectedEdgeId: string | null;
  selectedEdgeIds: string[];
  modalNodeId: string | null;
  ctrlSelectionActive: boolean;
};

type WorkflowGraphActions = {
  setNodes(value: SetStateAction<Node[]>): void;
  applyNodeChanges(changes: NodeChange[]): void;
  commitNodePositions(): void;
  setEdges(value: SetStateAction<Edge[]>): void;
  applyEdgeChanges(changes: EdgeChange[]): void;
  setSelectedId(value: SetStateAction<string | null>): void;
  setSelectedIds(value: SetStateAction<string[]>): void;
  setSelectedEdgeId(value: SetStateAction<string | null>): void;
  setSelectedEdgeIds(value: SetStateAction<string[]>): void;
  setModalNodeId(value: SetStateAction<string | null>): void;
  setCtrlSelectionActive(value: SetStateAction<boolean>): void;
  resetSelection(): void;
};

export type WorkflowGraphStore = WorkflowGraphState & WorkflowGraphActions;

function resolve<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === 'function' ? (value as (previous: T) => T)(current) : value;
}

const initialState: WorkflowGraphState = {
  liveNodes: [],
  documentNodes: [],
  edges: [],
  selectedId: null,
  selectedIds: [],
  selectedEdgeId: null,
  selectedEdgeIds: [],
  modalNodeId: null,
  ctrlSelectionActive: false,
};

export function createWorkflowGraphStore() {
  return createAtomicStore<WorkflowGraphStore>((set) => ({
    ...initialState,
    setNodes: (value) => set((state) => {
      const next = resolve(value, state.liveNodes);
      return next === state.liveNodes ? state : { liveNodes: next, documentNodes: next };
    }),
    applyNodeChanges: (changes) => set((state) => {
      const liveNodes = applyNodeChanges(changes, state.liveNodes);
      return { liveNodes, documentNodes: hasDocumentNodeChange(changes) ? liveNodes : state.documentNodes };
    }),
    commitNodePositions: () => set((state) => {
      const documentNodes = mergeCommittedPositions(state.documentNodes, state.liveNodes);
      return documentNodes === state.documentNodes ? state : { documentNodes };
    }),
    setEdges: (value) => set((state) => ({ edges: resolve(value, state.edges) })),
    applyEdgeChanges: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
    setSelectedId: (value) => set((state) => ({ selectedId: resolve(value, state.selectedId) })),
    setSelectedIds: (value) => set((state) => ({ selectedIds: resolve(value, state.selectedIds) })),
    setSelectedEdgeId: (value) => set((state) => ({ selectedEdgeId: resolve(value, state.selectedEdgeId) })),
    setSelectedEdgeIds: (value) => set((state) => ({ selectedEdgeIds: resolve(value, state.selectedEdgeIds) })),
    setModalNodeId: (value) => set((state) => ({ modalNodeId: resolve(value, state.modalNodeId) })),
    setCtrlSelectionActive: (value) => set((state) => ({ ctrlSelectionActive: resolve(value, state.ctrlSelectionActive) })),
    resetSelection: () => set({ selectedId: null, selectedIds: [], selectedEdgeId: null, selectedEdgeIds: [], modalNodeId: null }),
  }));
}

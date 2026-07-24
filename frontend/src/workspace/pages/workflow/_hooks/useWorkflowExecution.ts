import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { Run, RunSummary, Workflow } from '../../../../shared/_types';
import { connectedGraph, normalizeEdgeHandles } from '../../../_model/graph';
import { workspaceApi } from '../../../_service/workspaceApi';

export function useWorkflowExecution({
  nodes,
  edges,
  selectedId,
  setSelectedId,
  setSelectedIds,
  setSelectedEdgeId,
  setSelectedEdgeIds,
  versionPreviewActive,
  componentEditorActive,
  workflowName,
  datasetId,
  projectId,
  targetColumn,
  taskType,
  autosaveSnapshot,
  autosaveSignature,
  currentOutputSignature,
  persistSnapshot,
  setBusy,
  setLastRunSignature,
  recordRun,
  retryRunWithSignature,
  setMessage,
}: {
  nodes: Node[];
  edges: Edge[];
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
  setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
  versionPreviewActive: boolean;
  componentEditorActive: boolean;
  workflowName: string;
  datasetId: number | null;
  projectId: number;
  targetColumn: string;
  taskType: string;
  autosaveSnapshot: {
    name: string;
    graph: Record<string, unknown>;
    project_id: number;
    last_run_id: number | null;
  };
  autosaveSignature: string;
  currentOutputSignature: string;
  persistSnapshot: (
    snapshot: {
      name: string;
      graph: Record<string, unknown>;
      project_id: number;
      last_run_id: number | null;
    },
    signature: string,
  ) => Promise<Workflow>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setLastRunSignature: Dispatch<SetStateAction<string>>;
  recordRun: (run: Run) => void;
  retryRunWithSignature: (run: Run | RunSummary, signature: string) => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const runGraphFromNode = useCallback(async (nodeId: string | null) => {
    if (versionPreviewActive) {
      setMessage('برای اجرا، نسخه ذخیره‌شده را بازیابی کنید یا به آخرین نسخه خودکار برگردید.');
      return;
    }
    if (componentEditorActive) {
      setMessage('ابتدا نسخه کامپوننت را ذخیره کنید و به جریان اصلی برگردید.');
      return;
    }
    const normalizedEdges = normalizeEdgeHandles(nodes, edges);
    const graphToRun = connectedGraph(nodes, normalizedEdges, nodeId);
    if (nodeId) {
      setSelectedId(nodeId);
      setSelectedIds([nodeId]);
      setSelectedEdgeId(null);
      setSelectedEdgeIds([]);
    }
    setMessage('در حال تثبیت آخرین تغییرات جریان…');
    try {
      const savedWorkflow = await persistSnapshot(autosaveSnapshot, autosaveSignature);
      setBusy(true);
      setMessage(
        graphToRun.mode === 'selected'
          ? 'جریان متصل به نود انتخاب‌شده اجرا می‌شود'
          : 'کل برد اجرا می‌شود',
      );
      const graph = {
        nodes: graphToRun.nodes,
        edges: graphToRun.edges,
        meta: { datasetId, targetColumn, taskType },
      };
      const run = await workspaceApi.createRun({
        workflow_name: workflowName,
        workflow_graph: graph,
        workflow_id: savedWorkflow.id,
        workflow_revision: savedWorkflow.revision,
        bypass_cache: false,
        dataset_id: datasetId,
        project_id: projectId,
        target_column: targetColumn,
        task_type: taskType || 'auto',
        idempotency_key: crypto.randomUUID(),
      });
      recordRun(run);
      setLastRunSignature(currentOutputSignature);
      setMessage('جریان در صف اجرا قرار گرفت');
    } catch (error) {
      if (!(error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED')) {
        setMessage(error instanceof Error ? error.message : 'اجرا ناموفق بود');
      }
      setBusy(false);
    }
  }, [autosaveSignature, autosaveSnapshot, componentEditorActive, currentOutputSignature, datasetId, edges, nodes, persistSnapshot, projectId, recordRun, setBusy, setLastRunSignature, setMessage, setSelectedEdgeId, setSelectedEdgeIds, setSelectedId, setSelectedIds, targetColumn, taskType, versionPreviewActive, workflowName]);

  const runWorkflow = useCallback(
    () => runGraphFromNode(selectedId),
    [runGraphFromNode, selectedId],
  );
  const retryRun = useCallback(
    (run: Run | RunSummary) => retryRunWithSignature(run, currentOutputSignature),
    [currentOutputSignature, retryRunWithSignature],
  );

  return {
    runGraphFromNode,
    runWorkflow,
    retryRun,
  };
}

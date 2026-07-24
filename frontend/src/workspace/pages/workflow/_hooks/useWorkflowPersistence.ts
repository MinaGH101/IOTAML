import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { Workflow, WorkflowVersion } from '../../../../shared/_types';
import { ApiError } from '../../../../shared/_service/httpClient';
import { exportWorkflowJson } from '../../../../shared/_utils/workflowJson';
import type { AnalysisBoardTab } from '../../../_model/board';
import {
  createAutosaveSignature,
  createAutosaveSnapshot,
} from '../../../_model/workflowPersistence';
import {
  MAIN_ANALYSIS_BOARD_ID,
  normalizeEdgeHandles,
  workflowOutputSignature,
  type FlowGraph,
} from '../../../_model/graph';
import { workspaceApi } from '../../../_service/workspaceApi';

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export function useWorkflowPersistence({
  projectId,
  nodes,
  edges,
  datasetId,
  targetColumn,
  taskType,
  serializedBoards,
  analysisBoardSignature,
  activeBoardId,
  workflowLastRunId,
  versionPreview,
  paused,
  refreshWorkflows,
  setMessage,
}: {
  projectId: number;
  nodes: Node[];
  edges: Edge[];
  datasetId: number | null;
  targetColumn: string;
  taskType: string;
  serializedBoards: AnalysisBoardTab[];
  analysisBoardSignature: unknown;
  activeBoardId: string;
  workflowLastRunId: number | null;
  versionPreview: WorkflowVersion | null;
  paused: boolean;
  refreshWorkflows: () => Promise<Workflow[]>;
  setMessage: (message: string) => void;
}) {
  const [currentWorkflowId, setCurrentWorkflowId] = useState<number | null>(null);
  const [workflowName, setWorkflowName] = useState('جریان IOTA ML');
  const [workflowRevision, setWorkflowRevision] = useState(1);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [autosaveUpdatedAt, setAutosaveUpdatedAt] = useState<string | null>(null);
  const workflowIdRef = useRef<number | null>(null);
  const workflowRevisionRef = useRef(1);
  const autosaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastSavedSignatureRef = useRef('');
  const skipNextAutosaveRef = useRef(true);
  const editorSessionRef = useRef(1);

  const currentGraph = useMemo<FlowGraph>(() => ({
    nodes,
    edges: normalizeEdgeHandles(nodes, edges),
    meta: {
      datasetId,
      targetColumn,
      taskType,
      analysisBoard: serializedBoards
        .find((board) => board.id === MAIN_ANALYSIS_BOARD_ID)?.items || [],
      analysisBoards: serializedBoards,
      activeAnalysisBoardId: activeBoardId,
    },
  }), [activeBoardId, datasetId, edges, nodes, serializedBoards, targetColumn, taskType]);
  const currentOutputSignature = useMemo(
    () => workflowOutputSignature(nodes, edges, datasetId, targetColumn, taskType),
    [datasetId, edges, nodes, targetColumn, taskType],
  );
  const autosaveSnapshot = useMemo(() => createAutosaveSnapshot({
    name: workflowName,
    graph: currentGraph as unknown as Record<string, unknown>,
    projectId,
    lastRunId: workflowLastRunId,
  }), [currentGraph, projectId, workflowLastRunId, workflowName]);
  const autosaveSignature = useMemo(() => createAutosaveSignature({
    name: workflowName,
    projectId,
    lastRunId: workflowLastRunId,
    nodes,
    edges,
    datasetId,
    targetColumn,
    taskType,
    activeBoardId,
    analysisBoards: analysisBoardSignature,
  }), [activeBoardId, analysisBoardSignature, datasetId, edges, nodes, projectId, targetColumn, taskType, workflowLastRunId, workflowName]);

  const getWorkflowId = useCallback(() => workflowIdRef.current, []);
  const supersedeSession = useCallback(() => {
    editorSessionRef.current += 1;
  }, []);
  const resetMetadata = useCallback(() => {
    workflowIdRef.current = null;
    workflowRevisionRef.current = 1;
    setCurrentWorkflowId(null);
    setWorkflowRevision(1);
    setWorkflowName('جریان IOTA ML');
    setAutosaveState('idle');
    setAutosaveUpdatedAt(null);
    lastSavedSignatureRef.current = '';
    skipNextAutosaveRef.current = true;
  }, []);
  const adoptWorkflow = useCallback((workflow: Workflow) => {
    workflowIdRef.current = workflow.id;
    workflowRevisionRef.current = workflow.revision;
    setCurrentWorkflowId(workflow.id);
    setWorkflowRevision(workflow.revision);
    setWorkflowName(workflow.name);
    setAutosaveUpdatedAt(workflow.last_autosaved_at || workflow.updated_at);
    setAutosaveState('saved');
    lastSavedSignatureRef.current = '';
    skipNextAutosaveRef.current = true;
  }, []);

  const persistSnapshot = useCallback((
    snapshot: {
      name: string;
      graph: Record<string, unknown>;
      project_id: number;
      last_run_id: number | null;
    },
    signature: string,
    sessionId = editorSessionRef.current,
  ): Promise<Workflow> => {
    const execute = async (): Promise<Workflow> => {
      if (sessionId !== editorSessionRef.current) throw new Error('AUTOSAVE_SUPERSEDED');
      if (!snapshot.name) throw new Error('نام جریان را وارد کنید');
      setAutosaveState('saving');
      try {
        const workflowId = workflowIdRef.current;
        const saved = workflowId
          ? await workspaceApi.autosaveWorkflow(workflowId, {
            ...snapshot,
            base_revision: workflowRevisionRef.current,
          })
          : await workspaceApi.createWorkflow(snapshot);
        if (sessionId !== editorSessionRef.current) return saved;
        adoptWorkflow(saved);
        lastSavedSignatureRef.current = signature;
        skipNextAutosaveRef.current = false;
        void refreshWorkflows().catch(() => undefined);
        return saved;
      } catch (error) {
        if (
          sessionId !== editorSessionRef.current
          || (error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED')
        ) throw error;
        if (error instanceof ApiError && error.code === 'WORKFLOW_REVISION_CONFLICT') {
          setAutosaveState('conflict');
          setMessage('این جریان در نشست دیگری تغییر کرده است. برای جلوگیری از بازنویسی، جریان را دوباره بارگذاری کنید.');
        } else {
          setAutosaveState('error');
          setMessage(error instanceof Error ? error.message : 'ذخیره خودکار ناموفق بود');
        }
        throw error;
      }
    };
    const queued = autosaveQueueRef.current.catch(() => undefined).then(execute);
    autosaveQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, [adoptWorkflow, refreshWorkflows, setMessage]);

  useEffect(() => {
    if (versionPreview || paused || !autosaveSnapshot.name) return undefined;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      lastSavedSignatureRef.current = autosaveSignature;
      return undefined;
    }
    if (autosaveSignature === lastSavedSignatureRef.current) return undefined;
    setAutosaveState((state) => state === 'saving' ? state : 'idle');
    const sessionId = editorSessionRef.current;
    const timer = window.setTimeout(() => {
      void persistSnapshot(autosaveSnapshot, autosaveSignature, sessionId).catch((error) => {
        if (error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED') return;
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autosaveSignature, autosaveSnapshot, paused, persistSnapshot, versionPreview]);

  const exportCurrent = useCallback(() => {
    if (paused) {
      setMessage('ابتدا ویرایش کامپوننت را ذخیره کنید و به جریان اصلی برگردید.');
      return;
    }
    exportWorkflowJson(workflowName, currentGraph);
    setMessage('فایل JSON جریان دانلود شد');
  }, [currentGraph, paused, setMessage, workflowName]);

  const autosaveLabel = versionPreview
    ? `نسخه v${versionPreview.version_number}`
    : autosaveState === 'saving'
      ? 'در حال ذخیره…'
      : autosaveState === 'conflict'
        ? 'تداخل ذخیره'
        : autosaveState === 'error'
          ? 'خطای ذخیره'
          : autosaveState === 'idle'
            ? 'تغییرات ذخیره‌نشده'
            : `ذخیره خودکار · r${workflowRevision}`;

  return {
    currentWorkflowId,
    workflowName,
    setWorkflowName,
    workflowRevision,
    autosaveState,
    autosaveUpdatedAt,
    autosaveLabel,
    currentGraph,
    currentOutputSignature,
    autosaveSnapshot,
    autosaveSignature,
    persistSnapshot,
    getWorkflowId,
    supersedeSession,
    resetMetadata,
    adoptWorkflow,
    exportCurrent,
  };
}

export type WorkflowPersistenceController = ReturnType<typeof useWorkflowPersistence>;

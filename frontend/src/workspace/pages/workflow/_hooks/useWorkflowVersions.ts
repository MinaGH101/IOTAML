import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  NodeCatalogResponse,
  Run,
  WorkflowVersion,
  WorkflowVersionSummary,
} from '../../../../shared/_types';
import { workspaceApi } from '../../../_service/workspaceApi';
import type { FlowGraph } from '../../../_model/graph';
import type { WorkflowPersistenceController } from './useWorkflowPersistence';

export function useWorkflowVersions({
  catalog,
  persistence,
  workflowLastRunId,
  setWorkflowLastRunId,
  setCurrentRun,
  setLastRunSignature,
  versionPreview,
  setVersionPreview,
  applyGraph,
  refreshWorkflows,
  setMessage,
}: {
  catalog: NodeCatalogResponse;
  persistence: WorkflowPersistenceController;
  workflowLastRunId: number | null;
  setWorkflowLastRunId: Dispatch<SetStateAction<number | null>>;
  setCurrentRun: Dispatch<SetStateAction<Run | null>>;
  setLastRunSignature: Dispatch<SetStateAction<string>>;
  versionPreview: WorkflowVersion | null;
  setVersionPreview: Dispatch<SetStateAction<WorkflowVersion | null>>;
  applyGraph: (
    graph: FlowGraph,
    registry: NodeCatalogResponse['nodes'],
    aliases: Record<string, string>,
  ) => void;
  refreshWorkflows: () => Promise<unknown>;
  setMessage: (message: string) => void;
}) {
  const [items, setItems] = useState<WorkflowVersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    getWorkflowId,
    adoptWorkflow,
    workflowName,
    persistSnapshot,
    autosaveSnapshot,
    autosaveSignature,
  } = persistence;

  const initialize = useCallback((versions: WorkflowVersionSummary[]) => {
    setItems(versions);
    setSelectedId(null);
    setVersionPreview(null);
  }, [setVersionPreview]);

  const refresh = useCallback(async (workflowId = getWorkflowId()) => {
    if (!workflowId) {
      setItems([]);
      return [];
    }
    const versions = await workspaceApi.workflowVersions(workflowId);
    setItems(versions);
    return versions;
  }, [getWorkflowId]);

  const activateCurrentWorkflow = useCallback(async (
    workflow: Awaited<ReturnType<typeof workspaceApi.getWorkflow>>,
    lastRun: Run | null,
  ) => {
    adoptWorkflow(workflow);
    setVersionPreview(null);
    setSelectedId(null);
    applyGraph(workflow.graph as unknown as FlowGraph, catalog.nodes, catalog.aliases);
    setCurrentRun(lastRun);
    setWorkflowLastRunId(workflow.last_run_id ?? null);
    setLastRunSignature('');
  }, [adoptWorkflow, applyGraph, catalog.aliases, catalog.nodes, setCurrentRun, setLastRunSignature, setVersionPreview, setWorkflowLastRunId]);

  const save = useCallback(async (versionName: string, description: string) => {
    if (versionPreview) {
      setMessage('ابتدا نسخه انتخاب‌شده را بازیابی کنید یا به آخرین نسخه خودکار برگردید.');
      return;
    }
    if (!workflowName.trim()) {
      setMessage('نام جریان را وارد کنید');
      return;
    }
    setBusy(true);
    try {
      const saved = await persistSnapshot(
        autosaveSnapshot,
        autosaveSignature,
      );
      const version = await workspaceApi.createWorkflowVersion(saved.id, {
        name: versionName,
        description,
        run_id: workflowLastRunId,
      });
      setSelectedId(version.id);
      await refresh(saved.id);
      setDialogOpen(false);
      setMessage(`نسخه «${version.name}» ذخیره شد`);
    } catch (error) {
      if (!(error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED')) {
        setMessage(error instanceof Error ? error.message : 'ذخیره نسخه ناموفق بود');
      }
    } finally {
      setBusy(false);
    }
  }, [autosaveSignature, autosaveSnapshot, persistSnapshot, refresh, setMessage, versionPreview, workflowLastRunId, workflowName]);

  const view = useCallback(async (summary: WorkflowVersionSummary) => {
    const workflowId = getWorkflowId();
    if (!workflowId) return;
    setBusy(true);
    try {
      if (!versionPreview && autosaveSnapshot.name) {
        await persistSnapshot(
          autosaveSnapshot,
          autosaveSignature,
        );
      }
      const version = await workspaceApi.getWorkflowVersion(workflowId, summary.id);
      const attachedRun = version.run_id
        ? await workspaceApi.getRun(version.run_id).catch(() => null)
        : null;
      setVersionPreview(version);
      setSelectedId(version.id);
      applyGraph(version.graph as unknown as FlowGraph, catalog.nodes, catalog.aliases);
      setCurrentRun(attachedRun);
      setLastRunSignature('');
      setMessage(`نسخه «${version.name}» فقط برای مشاهده باز شد`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت نسخه ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [applyGraph, autosaveSignature, autosaveSnapshot, catalog.aliases, catalog.nodes, getWorkflowId, persistSnapshot, setCurrentRun, setLastRunSignature, setMessage, setVersionPreview, versionPreview]);

  const returnToCurrent = useCallback(async () => {
    const workflowId = getWorkflowId();
    if (!workflowId) return;
    setBusy(true);
    try {
      const workflow = await workspaceApi.getWorkflow(workflowId);
      const attachedRun = workflow.last_run_id
        ? await workspaceApi.getRun(workflow.last_run_id).catch(() => null)
        : null;
      await activateCurrentWorkflow(workflow, attachedRun);
      setMessage('آخرین نسخه خودکار نمایش داده شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بازگشت به نسخه جاری ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [activateCurrentWorkflow, getWorkflowId, setMessage]);

  const restore = useCallback(async (version: WorkflowVersionSummary) => {
    const workflowId = getWorkflowId();
    if (!workflowId || !window.confirm(`نسخه «${version.name}» جایگزین پیش‌نویس جاری شود؟`)) {
      return;
    }
    setBusy(true);
    try {
      const workflow = await workspaceApi.restoreWorkflowVersion(workflowId, version.id);
      const attachedRun = workflow.last_run_id
        ? await workspaceApi.getRun(workflow.last_run_id).catch(() => null)
        : null;
      await activateCurrentWorkflow(workflow, attachedRun);
      await Promise.all([refresh(workflowId), refreshWorkflows()]);
      setMessage(`نسخه «${version.name}» بازیابی شد`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بازیابی نسخه ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [activateCurrentWorkflow, getWorkflowId, refresh, refreshWorkflows, setMessage]);

  const remove = useCallback(async (version: WorkflowVersionSummary) => {
    const workflowId = getWorkflowId();
    if (!workflowId || !window.confirm(`نسخه «${version.name}» حذف شود؟`)) return;
    setBusy(true);
    try {
      await workspaceApi.deleteWorkflowVersion(workflowId, version.id);
      if (versionPreview?.id === version.id) {
        const workflow = await workspaceApi.getWorkflow(workflowId);
        const attachedRun = workflow.last_run_id
          ? await workspaceApi.getRun(workflow.last_run_id).catch(() => null)
          : null;
        await activateCurrentWorkflow(workflow, attachedRun);
      }
      await refresh(workflowId);
      setMessage('نسخه حذف شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حذف نسخه ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [activateCurrentWorkflow, getWorkflowId, refresh, setMessage, versionPreview?.id]);

  return {
    items,
    selectedId,
    busy,
    dialogOpen,
    setDialogOpen,
    initialize,
    refresh,
    save,
    view,
    returnToCurrent,
    restore,
    remove,
  };
}

export type WorkflowVersionsController = ReturnType<typeof useWorkflowVersions>;

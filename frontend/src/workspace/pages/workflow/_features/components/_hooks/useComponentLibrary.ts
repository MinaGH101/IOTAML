import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  ComponentVersion,
  ComponentVersionAction,
  ComponentVersionSummary,
  WorkflowComponent,
} from '../../../../../../shared/_types';
import { workspaceApi } from '../../../../../_service/workspaceApi';

function downloadComponentPayload(
  payload: Record<string, unknown>,
  filename: string,
) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function packageFilename(component: WorkflowComponent, suffix = '') {
  const name = component.name.replace(/[^a-z0-9_-]+/gi, '-') || 'component';
  return `${name}${suffix}.iotacomp.json`;
}

export function useComponentLibrary({
  projectId,
  busy,
  setBusy,
  refreshComponents,
  refreshRegistry,
  enterEditor,
  setMessage,
}: {
  projectId: number;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  refreshComponents: () => Promise<WorkflowComponent[]>;
  refreshRegistry: () => Promise<void>;
  enterEditor: (
    component: WorkflowComponent,
    version: ComponentVersion,
    sourceNodeId?: string | null,
  ) => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<WorkflowComponent | null>(null);
  const [managed, setManaged] = useState<WorkflowComponent | null>(null);
  const [managedVersions, setManagedVersions] = useState<ComponentVersionSummary[]>([]);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<ComponentVersionAction | null>(null);

  const exportPackage = useCallback(async (component: WorkflowComponent) => {
    try {
      const payload = await workspaceApi.exportComponent(component.id);
      downloadComponentPayload(payload, packageFilename(component));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خروجی کامپوننت ناموفق بود');
    }
  }, [setMessage]);

  const importPackage = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const component = await workspaceApi.importComponent(payload);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      setMessage(`کامپوننت «${component.name}» وارد شد.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import کامپوننت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [refreshComponents, refreshRegistry, setBusy, setMessage]);

  const refreshManagedVersions = useCallback(async (component = managed) => {
    if (!component) return [];
    const versions = await workspaceApi.componentVersions(component.id, projectId);
    setManagedVersions(versions);
    return versions;
  }, [managed, projectId]);

  const refreshManagedVersionsForDialog = useCallback(() => {
    void refreshManagedVersions().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌ها ناموفق بود');
    });
  }, [refreshManagedVersions, setMessage]);

  const openVersionManager = useCallback(async (component: WorkflowComponent) => {
    setManaged(component);
    setManagedVersions([]);
    setBusy(true);
    try {
      setManagedVersions(await workspaceApi.componentVersions(component.id, projectId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌های کامپوننت ناموفق بود');
      setManaged(null);
    } finally {
      setBusy(false);
    }
  }, [projectId, setBusy, setMessage]);

  const openManagedVersion = useCallback(async ({ component, version }: ComponentVersionAction) => {
    setBusy(true);
    try {
      const fullVersion = await workspaceApi.getComponentVersion(component.id, version.id, projectId);
      setManaged(null);
      await enterEditor(component, fullVersion);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'باز کردن نسخه کامپوننت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [enterEditor, projectId, setBusy, setMessage]);

  const makeManagedVersionCurrent = useCallback(async ({ component, version }: ComponentVersionAction) => {
    setBusy(true);
    try {
      const updated = await workspaceApi.makeComponentVersionCurrent(component.id, version.id);
      setManaged(updated);
      await Promise.all([
        refreshManagedVersions(updated),
        refreshComponents(),
        refreshRegistry(),
      ]);
      setMessage(`نسخه ${version.semantic_version} به‌عنوان نسخه جاری کامپوننت انتخاب شد. نمونه‌های موجود بدون تغییر باقی ماندند.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'انتخاب نسخه جاری ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [refreshComponents, refreshManagedVersions, refreshRegistry, setBusy, setMessage]);

  const exportManagedVersion = useCallback(async ({ component, version }: ComponentVersionAction) => {
    try {
      const payload = await workspaceApi.exportComponent(component.id, version.id);
      downloadComponentPayload(
        payload,
        packageFilename(component, `-v${version.semantic_version}`),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خروجی نسخه کامپوننت ناموفق بود');
    }
  }, [setMessage]);

  const archive = useCallback((component: WorkflowComponent) => {
    void workspaceApi.updateComponent(component.id, { archived: !component.archived })
      .then(() => refreshComponents())
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'آرشیو کامپوننت ناموفق بود');
      });
  }, [refreshComponents, setMessage]);

  const deleteConfirmed = useCallback(async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await workspaceApi.deleteComponent(confirmDelete.id);
      setConfirmDelete(null);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      setMessage('کامپوننت حذف شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حذف کامپوننت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [confirmDelete, refreshComponents, refreshRegistry, setBusy, setMessage]);

  const deleteVersionConfirmed = useCallback(async () => {
    if (!confirmDeleteVersion) return;
    const action = confirmDeleteVersion;
    setBusy(true);
    try {
      await workspaceApi.deleteComponentVersion(action.component.id, action.version.id);
      setConfirmDeleteVersion(null);
      await refreshManagedVersions(action.component);
      setMessage('نسخه کامپوننت حذف شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حذف نسخه کامپوننت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [confirmDeleteVersion, refreshManagedVersions, setBusy, setMessage]);

  return {
    busy,
    confirmDelete,
    setConfirmDelete,
    managed,
    setManaged,
    managedVersions,
    confirmDeleteVersion,
    setConfirmDeleteVersion,
    exportPackage,
    importPackage,
    refreshManagedVersions,
    refreshManagedVersionsForDialog,
    openVersionManager,
    openManagedVersion,
    makeManagedVersionCurrent,
    exportManagedVersion,
    archive,
    deleteConfirmed,
    deleteVersionConfirmed,
  };
}

export type ComponentLibraryController = ReturnType<typeof useComponentLibrary>;

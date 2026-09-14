import { useCallback, useState } from 'react';
import { componentsApi } from '../../../../../../../features/components/api/componentsApi';
import type { ComponentVersionAction, ComponentVersionSummary, WorkflowComponent } from '../../../../../../../shared/types';
import { downloadComponentPayload, packageFilename } from './helpers';
import type { ComponentLibraryOptions } from './types';
export function useComponentVersions(o: ComponentLibraryOptions) { const [managed, setManaged] = useState<WorkflowComponent | null>(null); const [managedVersions, setManagedVersions] = useState<ComponentVersionSummary[]>([]); const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<ComponentVersionAction | null>(null); const refreshManagedVersions = useCallback(async (c = managed) => { if (!c)
    return []; const versions = await componentsApi.versions(c.id, o.projectId); setManagedVersions(versions); return versions; }, [managed, o.projectId]); const refreshManagedVersionsForDialog = useCallback(() => { void refreshManagedVersions().catch((e) => o.setMessage(e instanceof Error ? e.message : 'دریافت نسخه‌ها ناموفق بود')); }, [o.setMessage, refreshManagedVersions]); const openVersionManager = useCallback(async (c: WorkflowComponent) => { setManaged(c); setManagedVersions([]); o.setBusy(true); try {
    setManagedVersions(await componentsApi.versions(c.id, o.projectId));
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'دریافت نسخه‌های کامپوننت ناموفق بود');
    setManaged(null);
}
finally {
    o.setBusy(false);
} }, [o.projectId, o.setBusy, o.setMessage]); const openManagedVersion = useCallback(async ({ component, version }: ComponentVersionAction) => { o.setBusy(true); try {
    const full = await componentsApi.getVersion(component.id, version.id, o.projectId);
    setManaged(null);
    await o.enterEditor(component, full);
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'باز کردن نسخه کامپوننت ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [o.enterEditor, o.projectId, o.setBusy, o.setMessage]); const makeManagedVersionCurrent = useCallback(async ({ component, version }: ComponentVersionAction) => { o.setBusy(true); try {
    const updated = await componentsApi.makeCurrent(component.id, version.id);
    setManaged(updated);
    await Promise.all([refreshManagedVersions(updated), o.refreshComponents(), o.refreshRegistry()]);
    o.setMessage(`نسخه ${version.semantic_version} به‌عنوان نسخه جاری کامپوننت انتخاب شد. نمونه‌های موجود بدون تغییر باقی ماندند.`);
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'انتخاب نسخه جاری ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [o.refreshComponents, o.refreshRegistry, o.setBusy, o.setMessage, refreshManagedVersions]); const exportManagedVersion = useCallback(async ({ component, version }: ComponentVersionAction) => { try {
    downloadComponentPayload(await componentsApi.export(component.id, version.id), packageFilename(component, `-v${version.semantic_version}`));
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'خروجی نسخه کامپوننت ناموفق بود');
} }, [o.setMessage]); const deleteVersionConfirmed = useCallback(async () => { if (!confirmDeleteVersion)
    return; const action = confirmDeleteVersion; o.setBusy(true); try {
    await componentsApi.removeVersion(action.component.id, action.version.id);
    setConfirmDeleteVersion(null);
    await refreshManagedVersions(action.component);
    o.setMessage('نسخه کامپوننت حذف شد.');
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'حذف نسخه کامپوننت ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [confirmDeleteVersion, o.setBusy, o.setMessage, refreshManagedVersions]); return { managed, setManaged, managedVersions, confirmDeleteVersion, setConfirmDeleteVersion, refreshManagedVersions, refreshManagedVersionsForDialog, openVersionManager, openManagedVersion, makeManagedVersionCurrent, exportManagedVersion, deleteVersionConfirmed }; }

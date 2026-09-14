import { useCallback, useState } from 'react';
import { componentsApi } from '../../../../../../../features/components/api/componentsApi';
import type { WorkflowComponent } from '../../../../../../../shared/types';
import type { ComponentLibraryOptions } from './types';
export function useComponentDelete(o: ComponentLibraryOptions) { const [confirmDelete, setConfirmDelete] = useState<WorkflowComponent | null>(null); const deleteConfirmed = useCallback(async () => { if (!confirmDelete)
    return; o.setBusy(true); try {
    await componentsApi.remove(confirmDelete.id);
    setConfirmDelete(null);
    await Promise.all([o.refreshComponents(), o.refreshRegistry()]);
    o.setMessage('کامپوننت حذف شد');
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'حذف کامپوننت ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [confirmDelete, o.refreshComponents, o.refreshRegistry, o.setBusy, o.setMessage]); return { confirmDelete, setConfirmDelete, deleteConfirmed }; }

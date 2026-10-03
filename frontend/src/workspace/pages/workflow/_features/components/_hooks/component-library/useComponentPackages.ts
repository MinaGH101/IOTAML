import { useCallback } from 'react';
import { componentsApi } from '../../../../../../../features/components/api/componentsApi';
import type { WorkflowComponent } from '../../../../../../../shared/types';
import { userFriendlyErrorMessage } from '../../../../../../../shared/lib/errorMessages';
import { downloadComponentPayload, packageFilename } from './helpers';
import type { ComponentLibraryOptions } from './types';
export function useComponentPackages(o: ComponentLibraryOptions) { const exportPackage = useCallback(async (c: WorkflowComponent) => { try {
    downloadComponentPayload(await componentsApi.export(c.id), packageFilename(c));
}
catch (e) {
    o.setMessage(userFriendlyErrorMessage(e, 'فایل کامپوننت ساخته نشد. دوباره تلاش کنید.'));
} }, [o.setMessage]); const importPackage = useCallback(async (payload: Record<string, unknown>) => { o.setBusy(true); try {
    const c = await componentsApi.import(payload);
    await Promise.all([o.refreshComponents(), o.refreshRegistry()]);
    o.setMessage(`کامپوننت «${c.name}» وارد شد.`);
}
catch (e) {
    o.setMessage(userFriendlyErrorMessage(e, 'کامپوننت وارد نشد. ساختار فایل را بررسی کنید.'));
}
finally {
    o.setBusy(false);
} }, [o.refreshComponents, o.refreshRegistry, o.setBusy, o.setMessage]); const archive = useCallback((c: WorkflowComponent) => { void componentsApi.update(c.id, { archived: !c.archived }).then(() => o.refreshComponents()).catch((e) => o.setMessage(userFriendlyErrorMessage(e, 'وضعیت آرشیو کامپوننت تغییر نکرد. دوباره تلاش کنید.'))); }, [o.refreshComponents, o.setMessage]); return { exportPackage, importPackage, archive }; }

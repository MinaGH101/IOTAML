import { useCallback } from 'react';
import { componentsApi } from '../../../../../../../features/components/api/componentsApi';
import type { WorkflowComponent } from '../../../../../../../shared/types';
import { downloadComponentPayload, packageFilename } from './helpers';
import type { ComponentLibraryOptions } from './types';
export function useComponentPackages(o: ComponentLibraryOptions) { const exportPackage = useCallback(async (c: WorkflowComponent) => { try {
    downloadComponentPayload(await componentsApi.export(c.id), packageFilename(c));
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'خروجی کامپوننت ناموفق بود');
} }, [o.setMessage]); const importPackage = useCallback(async (payload: Record<string, unknown>) => { o.setBusy(true); try {
    const c = await componentsApi.import(payload);
    await Promise.all([o.refreshComponents(), o.refreshRegistry()]);
    o.setMessage(`کامپوننت «${c.name}» وارد شد.`);
}
catch (e) {
    o.setMessage(e instanceof Error ? e.message : 'Import کامپوننت ناموفق بود');
}
finally {
    o.setBusy(false);
} }, [o.refreshComponents, o.refreshRegistry, o.setBusy, o.setMessage]); const archive = useCallback((c: WorkflowComponent) => { void componentsApi.update(c.id, { archived: !c.archived }).then(() => o.refreshComponents()).catch((e) => o.setMessage(e instanceof Error ? e.message : 'آرشیو کامپوننت ناموفق بود')); }, [o.refreshComponents, o.setMessage]); return { exportPackage, importPackage, archive }; }

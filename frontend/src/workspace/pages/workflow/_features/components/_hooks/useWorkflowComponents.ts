import { useState } from 'react';
import { componentsApi } from '../../../../../../features/components/api/componentsApi';
import { queryKeys } from '../../../../../../shared/state/queryKeys';
import { useServerQuery } from '../../../../../../shared/state/serverQuery';
import { useComponentEditor } from './useComponentEditor';
import { useComponentLibrary } from './useComponentLibrary';
import type { UseWorkflowComponentsOptions } from './workflowComponentsTypes';
export function useWorkflowComponents(o: UseWorkflowComponentsOptions) { const [busy, setBusy] = useState(false); const query = useServerQuery({ key: queryKeys.components(o.projectId), queryFn: (signal) => componentsApi.list(o.projectId, false, signal), staleTime: 30000 }); const items = query.data ?? []; const refresh = query.refetch; const editor = useComponentEditor({ ...o, items, busy, setBusy, refreshComponents: refresh }); const library = useComponentLibrary({ projectId: o.projectId, busy, setBusy, refreshComponents: refresh, refreshRegistry: o.refreshRegistry, enterEditor: editor.enterEditor, setMessage: o.setMessage }); return { items, busy, refresh, isFetching: query.isFetching, ...editor, ...library }; }
export type WorkflowComponentsController = ReturnType<typeof useWorkflowComponents>;

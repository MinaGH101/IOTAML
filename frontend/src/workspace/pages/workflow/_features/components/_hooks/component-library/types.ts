import type { Dispatch, SetStateAction } from 'react';
import type { ComponentVersion, WorkflowComponent } from '../../../../../../../shared/types';
export type ComponentLibraryOptions = {
    projectId: number;
    busy: boolean;
    setBusy: Dispatch<SetStateAction<boolean>>;
    refreshComponents: () => Promise<WorkflowComponent[]>;
    refreshRegistry: () => Promise<void>;
    enterEditor: (component: WorkflowComponent, version: ComponentVersion, sourceNodeId?: string | null) => Promise<void>;
    setMessage: (message: string) => void;
};

import type { Project, UserProfile } from '../../../../shared/types';
export type WorkflowPageProps = {
    project: Project;
    user: UserProfile;
    initialWorkflowId: number | null;
    onBack: () => void;
    onProfile: () => void;
    onAdmin: () => void;
    onLogout: () => void;
    onProjects: () => void;
};

import { Suspense, lazy, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { authApi } from '../auth/_service/authApi';
import { projectsApi } from '../projects/_service/projectsApi';
import { clearAuthToken } from '../shared/_service/httpClient';
import type { Project, UserProfile } from '../shared/_types';
import { LoginPage } from '../auth/pages/login/LoginPage';
import { useAppRouter } from './router';

const ProfilePage = lazy(() => import('../auth/pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const CreateProjectPage = lazy(() => import('../projects/pages/create-project/CreateProjectPage').then((module) => ({ default: module.CreateProjectPage })));
const ProjectManagementPage = lazy(() => import('../projects/pages/project-management/ProjectManagementPage').then((module) => ({ default: module.ProjectManagementPage })));
const ProjectDetailPage = lazy(() => import('../projects/pages/project-detail/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })));
const WorkflowPage = lazy(() => import('../workspace/pages/workflow/WorkflowPage').then((module) => ({ default: module.WorkflowPage })));

function LoadingPage({ message = 'در حال بارگذاری...' }: { message?: string }) {
  return <div className="app-shell loading-page"><RefreshCw className="spin" size={22} /> {message}</div>;
}

function AppRouter() {
  const { route, navigate, back } = useAppRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('iota-ml-theme') || 'light';
  }, []);

  useEffect(() => {
    authApi.me()
      .then((profile) => {
        setUser(profile);
        if (route.name === 'login' || route.name === 'not-found') {
          navigate({ name: 'projects' }, { replace: true });
        }
      })
      .catch(() => {
        clearAuthToken();
        navigate({ name: 'login' }, { replace: true });
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const routeProjectId = route.name === 'project' || route.name === 'workflow'
    ? route.projectId
    : null;

  useEffect(() => {
    if (!user || !routeProjectId || project?.id === routeProjectId) return;
    let active = true;
    setProjectLoading(true);
    setProjectError(false);
    projectsApi.get(routeProjectId)
      .then((nextProject) => { if (active) setProject(nextProject); })
      .catch(() => { if (active) setProjectError(true); })
      .finally(() => { if (active) setProjectLoading(false); });
    return () => { active = false; };
  }, [project?.id, routeProjectId, user]);

  useEffect(() => {
    if (user && (route.name === 'not-found' || projectError)) {
      navigate({ name: 'projects' }, { replace: true });
    }
  }, [navigate, projectError, route.name, user]);

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setProject(null);
    navigate({ name: 'login' }, { replace: true });
  };

  if (authLoading) return <LoadingPage />;
  if (!user || route.name === 'login') {
    return <LoginPage onLogin={(profile) => {
      setUser(profile);
      navigate({ name: 'projects' }, { replace: true });
    }} />;
  }

  if (route.name === 'not-found') {
    return <LoadingPage />;
  }

  if (routeProjectId && (projectLoading || project?.id !== routeProjectId)) {
    if (projectError) {
      return <LoadingPage message="پروژه پیدا نشد" />;
    }
    return <LoadingPage message="در حال دریافت پروژه..." />;
  }

  const content = (() => {
    if (route.name === 'profile') {
      return <ProfilePage user={user} onSaved={setUser} onBack={() => back({ name: 'projects' })} onProjects={() => navigate({ name: 'projects' })} onLogout={logout} />;
    }
    if (route.name === 'create-project') {
      return <CreateProjectPage user={user} onBack={() => navigate({ name: 'projects' })} onCreated={setProject} onOpenProject={(nextProject) => { setProject(nextProject); navigate({ name: 'project', projectId: nextProject.id }); }} onOpenEditor={(nextProject, workflowId) => { setProject(nextProject); navigate({ name: 'workflow', projectId: nextProject.id, workflowId }); }} onProfile={() => navigate({ name: 'profile' })} onLogout={logout} />;
    }
    if (route.name === 'project' && project) {
      return <ProjectDetailPage user={user} project={project} onBack={() => navigate({ name: 'projects' })} onProjectUpdated={setProject} onOpenEditor={(workflowId) => navigate({ name: 'workflow', projectId: project.id, workflowId })} onProfile={() => navigate({ name: 'profile' })} onLogout={logout} />;
    }
    if (route.name === 'workflow' && project) {
      return <WorkflowPage project={project} user={user} initialWorkflowId={route.workflowId} onBack={() => navigate({ name: 'project', projectId: project.id })} onProjects={() => navigate({ name: 'projects' })} onProfile={() => navigate({ name: 'profile' })} onLogout={logout} />;
    }
    return <ProjectManagementPage user={user} onOpenProject={(nextProject) => { setProject(nextProject); navigate({ name: 'project', projectId: nextProject.id }); }} onCreateProject={() => navigate({ name: 'create-project' })} onProfile={() => navigate({ name: 'profile' })} onLogout={logout} />;
  })();

  return <Suspense fallback={<LoadingPage />}>{content}</Suspense>;
}

export default function App() {
  return <AppRouter />;
}

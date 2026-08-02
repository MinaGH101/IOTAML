import { Suspense, lazy, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Project } from '../shared/_types';
import { LoginPage } from '../auth/pages/login/LoginPage';
import { projectsApi } from '../projects/_service/projectsApi';
import { useServerQuery } from '../shared/state/serverQuery';
import { queryKeys } from '../shared/state/queryKeys';
import { AppProviders } from './providers/AppProviders';
import { useAuth } from './providers/AuthProvider';
import { useAppRouter } from './router';

const AdminPage = lazy(() => import('../admin/pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const ProfilePage = lazy(() => import('../auth/pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const CreateProjectPage = lazy(() => import('../projects/pages/create-project/CreateProjectPage').then((module) => ({ default: module.CreateProjectPage })));
const ProjectManagementPage = lazy(() => import('../projects/pages/project-management/ProjectManagementPage').then((module) => ({ default: module.ProjectManagementPage })));
const ProjectDetailPage = lazy(() => import('../projects/pages/project-detail/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })));
const WorkflowPage = lazy(() => import('../workspace/pages/workflow/WorkflowPage').then((module) => ({ default: module.WorkflowPage })));

function LoadingPage({ message = 'در حال بارگذاری...' }: { message?: string }) {
  return <div className="app-shell loading-page" dir="rtl"><RefreshCw className="spin" size={22} /> {message}</div>;
}

function RoutedApplication() {
  const { route, navigate, back } = useAppRouter();
  const { user, loading: authLoading, setUser, logout } = useAuth();
  const [projectOverride, setProjectOverride] = useState<Project | null>(null);
  const routeProjectId = route.name === 'project' || route.name === 'workflow' ? route.projectId : null;
  const projectQuery = useServerQuery({
    key: queryKeys.project(routeProjectId),
    enabled: Boolean(user && routeProjectId),
    queryFn: () => projectsApi.get(routeProjectId as number),
    staleTime: 30_000,
  });
  const project = projectOverride?.id === routeProjectId ? projectOverride : projectQuery.data || null;

  useEffect(() => {
    if (authLoading) return;
    if (!user && route.name !== 'login') navigate({ name: 'login' }, { replace: true });
    if (user && (route.name === 'login' || route.name === 'not-found')) navigate({ name: 'projects' }, { replace: true });
  }, [authLoading, navigate, route.name, user]);

  useEffect(() => {
    if (routeProjectId !== projectOverride?.id) setProjectOverride(null);
  }, [projectOverride?.id, routeProjectId]);

  if (authLoading) return <LoadingPage />;
  if (!user || route.name === 'login') {
    return <LoginPage onLogin={(profile) => { setUser(profile); navigate({ name: 'projects' }, { replace: true }); }} />;
  }
  if (route.name === 'not-found') return <LoadingPage />;
  if (routeProjectId && projectQuery.error) return <LoadingPage message="پروژه پیدا نشد" />;
  if (routeProjectId && !project) return <LoadingPage message="در حال دریافت پروژه..." />;

  const content = (() => {
    if (route.name === 'admin') {
      if (user.role !== 'admin') return <ProjectManagementPage user={user} onOpenProject={(nextProject) => { setProjectOverride(nextProject); navigate({ name: 'project', projectId: nextProject.id }); }} onCreateProject={() => navigate({ name: 'create-project' })} onProfile={() => navigate({ name: 'profile' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
      return <AdminPage user={user} onBack={() => back({ name: 'projects' })} onProjects={() => navigate({ name: 'projects' })} onProfile={() => navigate({ name: 'profile' })} onLogout={logout} />;
    }
    if (route.name === 'profile') {
      return <ProfilePage user={user} onSaved={setUser} onBack={() => back({ name: 'projects' })} onProjects={() => navigate({ name: 'projects' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
    }
    if (route.name === 'create-project') {
      if (user.role === 'guest') return <ProjectManagementPage user={user} onOpenProject={(nextProject) => { setProjectOverride(nextProject); navigate({ name: 'project', projectId: nextProject.id }); }} onCreateProject={() => navigate({ name: 'projects' })} onProfile={() => navigate({ name: 'profile' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
      return <CreateProjectPage user={user} onBack={() => navigate({ name: 'projects' })} onCreated={setProjectOverride} onOpenProject={(nextProject) => { setProjectOverride(nextProject); navigate({ name: 'project', projectId: nextProject.id }); }} onOpenEditor={(nextProject, workflowId) => { setProjectOverride(nextProject); navigate({ name: 'workflow', projectId: nextProject.id, workflowId }); }} onProfile={() => navigate({ name: 'profile' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
    }
    if (route.name === 'project' && project) {
      return <ProjectDetailPage user={user} project={project} onBack={() => navigate({ name: 'projects' })} onProjectUpdated={setProjectOverride} onOpenEditor={(workflowId) => navigate({ name: 'workflow', projectId: project.id, workflowId })} onProfile={() => navigate({ name: 'profile' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
    }
    if (route.name === 'workflow' && project) {
      return <WorkflowPage project={project} user={user} initialWorkflowId={route.workflowId} onBack={() => navigate({ name: 'project', projectId: project.id })} onProjects={() => navigate({ name: 'projects' })} onProfile={() => navigate({ name: 'profile' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
    }
    return <ProjectManagementPage user={user} onOpenProject={(nextProject) => { setProjectOverride(nextProject); navigate({ name: 'project', projectId: nextProject.id }); }} onCreateProject={() => navigate({ name: 'create-project' })} onProfile={() => navigate({ name: 'profile' })} onAdmin={() => navigate({ name: 'admin' })} onLogout={logout} />;
  })();

  return <Suspense fallback={<LoadingPage />}>{content}</Suspense>;
}

export default function App() {
  return <AppProviders><RoutedApplication /></AppProviders>;
}

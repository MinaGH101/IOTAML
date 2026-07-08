import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { api, clearAuthToken } from './api';
import type { Project, UserProfile } from './types';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProjectDetailPanel, ProjectsPanel } from './pages/ProjectsPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { WorkflowPage } from './pages/WorkFlow';

function AppRouter() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [screen, setScreen] = useState<'loading' | 'login' | 'projects' | 'create-project' | 'project' | 'profile' | 'editor'>('loading');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editorWorkflowId, setEditorWorkflowId] = useState<number | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('iota-ml-theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  useEffect(() => {
    api.me()
      .then((profile) => { setUser(profile); setScreen('projects'); })
      .catch(() => setScreen('login'));
  }, []);

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setSelectedProject(null);
    setEditorWorkflowId(null);
    setScreen('login');
  };

  if (screen === 'loading') return <div className="app-shell loading-page"><RefreshCw className="spin" size={22} /> در حال بارگذاری...</div>;
  if (!user || screen === 'login') return <LoginPage onLogin={(profile) => { setUser(profile); setScreen('projects'); }} />;
  if (screen === 'profile') return <ProfilePage user={user} onSaved={setUser} onBack={() => setScreen(selectedProject ? 'project' : 'projects')} onProjects={() => setScreen('projects')} onLogout={logout} />;
  if (screen === 'create-project') return <CreateProjectPage user={user} onBack={() => setScreen('projects')} onCreated={setSelectedProject} onOpenProject={(project) => { setSelectedProject(project); setScreen('project'); }} onOpenEditor={(project, workflowId) => { setSelectedProject(project); setEditorWorkflowId(workflowId); setScreen('editor'); }} onProfile={() => setScreen('profile')} onLogout={logout} />;
  if (screen === 'project' && selectedProject) return <ProjectDetailPanel user={user} project={selectedProject} onBack={() => setScreen('projects')} onProjectUpdated={setSelectedProject} onOpenEditor={(workflowId) => { setEditorWorkflowId(workflowId); setScreen('editor'); }} onProfile={() => setScreen('profile')} onLogout={logout} />;
  if (screen === 'editor' && selectedProject) return <WorkflowPage project={selectedProject} user={user} initialWorkflowId={editorWorkflowId} onBack={() => setScreen('project')} onProjects={() => setScreen('projects')} onProfile={() => setScreen('profile')} onLogout={logout} />;
  return <ProjectsPanel user={user} onOpenProject={(project) => { setSelectedProject(project); setScreen('project'); }} onCreateProject={() => setScreen('create-project')} onProfile={() => setScreen('profile')} onLogout={logout} />;
}

export default function App() { return <ReactFlowProvider><AppRouter /></ReactFlowProvider>; }


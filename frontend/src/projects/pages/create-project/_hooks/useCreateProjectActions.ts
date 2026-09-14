import { useCallback, useState } from 'react';
import type { Dataset, Project, ProjectPayload, Workflow } from '../../../../shared/types';
import { messageFromError, type UiMessage } from '../../../../shared/lib/errors';
import { projectsApi } from '../../../api/projectsApi';
import { fetchProjectAssets } from '../../../lib/projectData';
import { invalidateProjectCaches } from '../../../lib/projectData';

type State = {
  draft: ProjectPayload; project: Project | null; activateProject: (project: Project) => void;
  setDatasets: (value: Dataset[]) => void; setWorkflows: (value: Workflow[]) => void;
  setMessage: (value: UiMessage) => void;
};

export function useCreateProjectActions(state: State) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const refresh = useCallback(async (projectId: number) => {
    const assets = await fetchProjectAssets(projectId);
    state.setDatasets(assets.datasets); state.setWorkflows(assets.workflows);
  }, [state.setDatasets, state.setWorkflows]);
  const ensureProject = useCallback(async () => {
    if (state.project) return state.project;
    const name = state.draft.name.trim();
    if (!name) { state.setMessage({ text: 'نام پروژه را وارد کنید', tone: 'error' }); return null; }
    const project = await projectsApi.create({ ...state.draft, name });
    state.activateProject(project); invalidateProjectCaches(project.id); return project;
  }, [state]);
  const save = async () => {
    if (!state.draft.name.trim()) { state.setMessage({ text: 'نام پروژه را وارد کنید', tone: 'error' }); return; }
    setSaving(true);
    try {
      if (state.project) {
        const saved = await projectsApi.update(state.project.id, { ...state.draft, name: state.draft.name.trim() });
        state.activateProject(saved); invalidateProjectCaches(saved.id); await refresh(saved.id); state.setMessage({ text: 'اطلاعات پروژه ذخیره شد', tone: 'success' });
      } else if (await ensureProject()) state.setMessage({ text: 'پروژه ساخته شد. حالا می‌توانید داده آپلود کنید یا جریان کاری بسازید.', tone: 'success' });
    } catch (error) { state.setMessage(messageFromError(error, state.project ? 'ذخیره ناموفق بود' : 'ساخت پروژه ناموفق بود')); }
    finally { setSaving(false); }
  };
  const upload = async (file: File) => {
    setUploading(true); state.setMessage({ text: state.project ? 'در حال آپلود دیتاست...' : 'در حال ساخت پروژه و آپلود دیتاست...', tone: 'info' });
    try { const project = await ensureProject(); if (!project) return; await projectsApi.uploadDataset(file, project.id); invalidateProjectCaches(project.id); await refresh(project.id); state.setMessage({ text: 'دیتاست آپلود شد', tone: 'success' }); }
    catch (error) { state.setMessage(messageFromError(error, 'آپلود ناموفق بود')); }
    finally { setUploading(false); }
  };
  const removeDataset = async (id: number) => {
    if (!state.project) return;
    try { await projectsApi.deleteDataset(id); invalidateProjectCaches(state.project.id); await refresh(state.project.id); state.setMessage({ text: 'دیتاست حذف شد', tone: 'success' }); }
    catch (error) { state.setMessage(messageFromError(error, 'حذف دیتاست ناموفق بود')); }
  };
  return { saving, uploading, ensureProject, refresh, save, upload, removeDataset };
}

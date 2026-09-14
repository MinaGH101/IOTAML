import { useState } from 'react';
import type { Project, ProjectPayload } from '../../../../shared/types';
import { messageFromError, type UiMessage } from '../../../../shared/lib/errors';
import { projectsApi } from '../../../api/projectsApi';
import { invalidateProjectCaches } from '../../../lib/projectData';

type Params = {
  project: Project; draft: ProjectPayload; onBack: () => void; onProjectUpdated: (project: Project) => void;
  refresh: () => Promise<unknown>; setMessage: (value: UiMessage) => void;
};

export function useProjectMutations({ project, draft, onBack, onProjectUpdated, refresh, setMessage }: Params) {
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const save = async () => {
    const name = draft.name.trim();
    if (!name) { setMessage({ text: 'نام پروژه را وارد کنید', tone: 'error' }); return; }
    setSaving(true);
    try { const saved = await projectsApi.update(project.id, { ...draft, name }); onProjectUpdated(saved); invalidateProjectCaches(project.id); await refresh(); setMessage({ text: 'اطلاعات پروژه ذخیره شد', tone: 'success' }); }
    catch (error) { setMessage(messageFromError(error, 'ذخیره ناموفق بود')); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    setSaving(true);
    try { await projectsApi.remove(project.id); invalidateProjectCaches(project.id); setDeleteOpen(false); onBack(); }
    catch (error) { setMessage(messageFromError(error, 'حذف پروژه ناموفق بود')); }
    finally { setSaving(false); }
  };
  const uploadDataset = async (file: File) => {
    setMessage({ text: 'در حال آپلود دیتاست...', tone: 'info' });
    try { await projectsApi.uploadDataset(file, project.id); invalidateProjectCaches(project.id); await refresh(); setMessage({ text: 'دیتاست آپلود شد', tone: 'success' }); }
    catch (error) { setMessage(messageFromError(error, 'آپلود ناموفق بود')); }
  };
  const deleteDataset = async (id: number) => {
    try { await projectsApi.deleteDataset(id); invalidateProjectCaches(project.id); await refresh(); setMessage({ text: 'دیتاست حذف شد', tone: 'success' }); }
    catch (error) { setMessage(messageFromError(error, 'حذف دیتاست ناموفق بود')); }
  };
  return { saving, deleteOpen, setDeleteOpen, save, remove, uploadDataset, deleteDataset };
}

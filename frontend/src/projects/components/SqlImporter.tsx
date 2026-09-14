import { useEffect, useState } from 'react';
import { projectsApi } from '../api/projectsApi';
import { invalidateProjectCaches } from '../lib/projectData';
import { ChevronDown, Database } from 'lucide-react';
import { Button, Select } from '../../shared/ui';

export function SqlImporter({ projectId, onImported }: { projectId: number; onImported: () => Promise<void> }) {
  const [sources, setSources] = useState<Array<{ name: string; tables: string[] }>>([]);
  const [source, setSource] = useState('');
  const [table, setTable] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    projectsApi.sqlSources(controller.signal).then(setSources).catch(() => {
      if (!controller.signal.aborted) setMessage('دریافت اتصال‌های SQL ناموفق بود.');
    });
    return () => controller.abort();
  }, []);
  const tables = sources.find((item) => item.name === source)?.tables || [];
  const importTable = async () => {
    setBusy(true); setMessage('در حال وارد کردن داده…');
    try {
      await projectsApi.importSql({ source, table, project_id: projectId, limit: 100000 });
      invalidateProjectCaches(projectId);
      await onImported();
      setMessage('داده‌های SQL وارد شد.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ورود داده ناموفق بود.'); }
    finally { setBusy(false); }
  };
  return <details className="sql-import" dir="rtl"><summary><Database size={17} /><span>ورود داده از SQL</span><ChevronDown size={16} className="sql-import-chevron" /></summary>
    <div className="sql-import-body">
      {!sources.length && <p className="sql-import-hint">اتصال‌های مجاز را مدیر سامانه پیکربندی می‌کند.</p>}
      <div className="sql-import-fields">
        <div className="sql-import-field"><span>اتصال SQL</span><Select ariaLabel="اتصال SQL" disabled={busy || !sources.length} value={source} placeholder="انتخاب اتصال" options={sources.map((item) => ({ value: item.name, label: item.name }))} onChange={(value) => { setSource(value); setTable(''); }} /></div>
        <div className="sql-import-field"><span>جدول SQL</span><Select ariaLabel="جدول SQL" disabled={busy || !source || !tables.length} value={table} placeholder="انتخاب جدول" options={tables.map((name) => ({ value: name, label: name }))} onChange={setTable} /></div>
      </div>
      <p className="sql-import-hint">یک نسخه از جدول وارد پروژه می‌شود؛ حداکثر ۱۰۰٬۰۰۰ ردیف.</p>
      <div className="sql-import-actions"><Button variant="primary" loading={busy} disabled={busy || !source || !table} onClick={importTable}>وارد کردن جدول</Button></div>
      {message && <p className="sql-import-message" role="status">{message}</p>}
    </div>
  </details>;
}

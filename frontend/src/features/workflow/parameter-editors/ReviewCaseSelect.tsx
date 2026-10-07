import { useEffect, useState } from 'react';
import { request } from '../../../shared/api/httpClient';
import { Select } from '../../../shared/ui';

type ReviewCaseOption = {
  case_id: string;
  title: string;
  form_id: string;
  assigned: number;
  completed: number;
};

function projectIdFromPath() {
  const match = location.pathname.match(/\/projects\/(\d+)\/workspace/);
  return match ? Number(match[1]) : null;
}

export function ReviewCaseSelect({ value, formId, onChange }: {
  value: string;
  formId: string;
  onChange: (value: string) => void;
}) {
  const [items, setItems] = useState<ReviewCaseOption[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const projectId = projectIdFromPath();
    if (!projectId) return;
    let cancelled = false;
    setFailed(false);
    void request<ReviewCaseOption[]>(`/api/cases/response-options?project_id=${projectId}&form_id=${encodeURIComponent(formId)}`)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [formId]);
  const options = [
    { value: '', label: 'انتخاب پرونده ارجاع‌شده' },
    ...items.map((item) => ({
      value: item.case_id,
      label: `${item.title} · ${item.case_id} · ${item.completed.toLocaleString('fa-IR')}/${item.assigned.toLocaleString('fa-IR')} پاسخ`,
    })),
  ];
  if (value && !items.some((item) => item.case_id === value)) options.push({ value, label: value });
  return <><Select value={value} options={options} onChange={onChange} ariaLabel="شناسه پرونده"/>
    {failed && <small>دریافت پرونده‌های ارجاع‌شده ناموفق بود.</small>}
    {!failed && items.length === 0 && <small>ابتدا نود ارجاع فرم را اجرا کنید.</small>}
  </>;
}

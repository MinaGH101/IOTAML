import { useEffect, useState } from 'react';
import { AppDialog } from './AppDialog';

type WorkflowVersionDialogProps = {
  open: boolean;
  defaultName: string;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
};

export function WorkflowVersionDialog({ open, defaultName, busy, onClose, onSave }: WorkflowVersionDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription('');
    }
  }, [defaultName, open]);
  const valid = name.trim().length > 0;
  return (
    <AppDialog open={open} title="ذخیره نسخه جریان" description="این نسخه ثابت و قابل بازیابی است. ذخیره خودکار همچنان نسخه جاری را نگهداری می‌کند." onClose={onClose} closeDisabled={busy} footer={<>
      <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>انصراف</button>
      <button type="button" className="primary-button" disabled={busy || !valid} onClick={() => onSave(name.trim(), description.trim())}>{busy ? 'در حال ذخیره…' : 'ذخیره نسخه'}</button>
    </>}>
      <label className="app-dialog-field"><span>نام نسخه</span><input autoFocus value={name} maxLength={255} onChange={(event) => setName(event.target.value)} placeholder="مثلاً نسخه نهایی پاکسازی داده" /></label>
      <label className="app-dialog-field"><span>توضیحات تغییرات</span><textarea value={description} maxLength={4000} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="چه چیزی در این نسخه تغییر کرده است؟" /></label>
    </AppDialog>
  );
}

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  closeDisabled?: boolean;
};

export function AppDialog({ open, title, description, children, footer, onClose, width = 520, closeDisabled = false }: AppDialogProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDisabled, onClose, open]);

  if (!open) return null;
  return (
    <div className="app-dialog-backdrop" role="presentation" onMouseDown={() => { if (!closeDisabled) onClose(); }}>
      <section className="app-dialog workflow-shell-card" style={{ width: `min(${width}px, calc(100vw - 28px))` }} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="app-dialog-header">
          <div>
            <h2 id="app-dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-button icon-only" disabled={closeDisabled} onClick={onClose} title="بستن" aria-label="بستن"><X size={17}/></button>
        </header>
        <div className="app-dialog-body">{children}</div>
        {footer && <footer className="app-dialog-footer">{footer}</footer>}
      </section>
    </div>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأیید', danger = false, busy = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <AppDialog open={open} title={title} onClose={onClose} closeDisabled={busy} width={440} footer={<>
      <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>انصراف</button>
      <button type="button" className={danger ? 'danger-button' : 'primary-button'} disabled={busy} onClick={onConfirm}>{busy ? 'در حال انجام…' : confirmLabel}</button>
    </>}>
      <p className="app-dialog-confirm-message">{message}</p>
    </AppDialog>
  );
}

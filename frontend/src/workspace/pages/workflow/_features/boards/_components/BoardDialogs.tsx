import { AppDialog, ConfirmDialog } from '../../../../../../shared/_components/AppDialog';
import type { AnalysisBoardTab } from '../../../../../_model/board';
import type { BoardDialogsController } from '../_hooks/useBoardDialogs';

export function BoardDialogs({
  activeBoard,
  controller,
}: {
  activeBoard: AnalysisBoardTab | undefined;
  controller: BoardDialogsController;
}) {
  const {
    renameOpen,
    setRenameOpen,
    renameDraft,
    setRenameDraft,
    deleteOpen,
    setDeleteOpen,
    confirmRename,
    confirmDelete,
  } = controller;

  return (
    <>
      <AppDialog
        open={renameOpen}
        title="تغییر نام برد"
        description="نام برد فعال را تغییر دهید. محتوا و چیدمان برد بدون تغییر می‌ماند."
        onClose={() => setRenameOpen(false)}
        width={440}
        footer={(
          <>
            <button type="button" className="secondary-button" onClick={() => setRenameOpen(false)}>
              انصراف
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!renameDraft.trim()}
              onClick={confirmRename}
            >
              ذخیره نام
            </button>
          </>
        )}
      >
        <label className="app-dialog-field">
          <span>نام برد</span>
          <input
            autoFocus
            value={renameDraft}
            maxLength={120}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && renameDraft.trim()) confirmRename();
            }}
          />
        </label>
      </AppDialog>
      <ConfirmDialog
        open={deleteOpen}
        title="حذف برد"
        message={activeBoard
          ? `برد «${activeBoard.name}» و چیدمان کارت‌های آن حذف شود؟ خروجی‌های اصلی Run حذف نمی‌شوند.`
          : ''}
        confirmLabel="حذف برد"
        danger
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../../../../../shared/_types';
import { ConfirmDialog } from '../../../../../../shared/_components/AppDialog';
import { ComponentDefinitionEditorDialog } from '../../../../../_components/ComponentDefinitionEditorDialog';
import { ComponentVersionsDialog } from '../../../../../_components/ComponentVersionsDialog';
import {
  ComponentVersionDialog,
  CreateComponentDialog,
} from '../../../../../_components/WorkflowComponentDialogs';
import type { WorkflowComponentsController } from '../_hooks/useWorkflowComponents';

export function WorkflowComponentOverlays({
  controller,
  nodes,
  registry,
  selectedCount,
}: {
  controller: WorkflowComponentsController;
  nodes: Node[];
  registry: RegistryNode[];
  selectedCount: number;
}) {
  const {
    busy,
    createDialogOpen,
    setCreateDialogOpen,
    boundary,
    versionDialogOpen,
    setVersionDialogOpen,
    editor,
    confirmDelete,
    setConfirmDelete,
    confirmUngroup,
    setConfirmUngroup,
    definitionDialogOpen,
    setDefinitionDialogOpen,
    managed,
    setManaged,
    managedVersions,
    confirmDeleteVersion,
    setConfirmDeleteVersion,
    pendingUpgrade,
    setPendingUpgrade,
    confirmLeaveEditor,
    setConfirmLeaveEditor,
    leaveEditor,
    createFromSelection,
    ungroup,
    saveVersion,
    applyDefinition,
    confirmUpgradeInstance,
    refreshManagedVersionsForDialog,
    openManagedVersion,
    makeManagedVersionCurrent,
    exportManagedVersion,
    deleteConfirmed,
    deleteVersionConfirmed,
  } = controller;

  return (
    <>
      <CreateComponentDialog
        open={createDialogOpen}
        busy={busy}
        selectedCount={selectedCount}
        initialInputs={boundary.inputs}
        initialOutputs={boundary.outputs}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={(draft) => { void createFromSelection(draft); }}
      />
      <ComponentVersionDialog
        open={versionDialogOpen}
        busy={busy}
        currentVersion={editor?.version.semantic_version || '1.0.0'}
        onClose={() => setVersionDialogOpen(false)}
        onSave={(semanticVersion, changelog) => {
          void saveVersion(semanticVersion, changelog);
        }}
      />
      <ComponentDefinitionEditorDialog
        open={definitionDialogOpen}
        nodes={nodes}
        registry={registry}
        inputs={editor?.version.interface_json.inputs || []}
        outputs={editor?.version.interface_json.outputs || []}
        exposedParameters={editor?.version.exposed_parameters || []}
        onClose={() => setDefinitionDialogOpen(false)}
        onSave={applyDefinition}
      />
      <ComponentVersionsDialog
        open={Boolean(managed)}
        component={managed}
        versions={managedVersions}
        busy={busy}
        onClose={() => setManaged(null)}
        onRefresh={refreshManagedVersionsForDialog}
        onOpenVersion={(action) => { void openManagedVersion(action); }}
        onMakeCurrent={(action) => { void makeManagedVersionCurrent(action); }}
        onExportVersion={(action) => { void exportManagedVersion(action); }}
        onDeleteVersion={setConfirmDeleteVersion}
      />
      <ConfirmDialog
        open={confirmLeaveEditor}
        title="خروج از ویرایش کامپوننت"
        message="تغییرات این نسخه هنوز ذخیره نشده‌اند. خروج، تغییرات ویرایشگر کامپوننت را دور می‌ریزد."
        confirmLabel="خروج بدون ذخیره"
        danger
        onClose={() => setConfirmLeaveEditor(false)}
        onConfirm={leaveEditor}
      />
      <ConfirmDialog
        open={Boolean(pendingUpgrade)}
        title="ارتقای نمونه کامپوننت"
        message={pendingUpgrade
          ? `نسخه ${pendingUpgrade.version.semantic_version} ساخته شد. آیا نمونه این کامپوننت در جریان جاری به نسخه جدید ارتقا یابد؟ جریان‌های دیگر بدون تغییر می‌مانند.`
          : ''}
        confirmLabel="ارتقای این نمونه"
        busy={busy}
        onClose={() => setPendingUpgrade(null)}
        onConfirm={confirmUpgradeInstance}
      />
      <ConfirmDialog
        open={Boolean(confirmDeleteVersion)}
        title="حذف نسخه کامپوننت"
        message={confirmDeleteVersion
          ? `نسخه ${confirmDeleteVersion.version.semantic_version} از «${confirmDeleteVersion.component.name}» حذف شود؟ نسخه جاری یا نسخه‌ای که در جریان‌ها استفاده شده باشد قابل حذف نیست.`
          : ''}
        confirmLabel="حذف نسخه"
        danger
        busy={busy}
        onClose={() => setConfirmDeleteVersion(null)}
        onConfirm={() => { void deleteVersionConfirmed(); }}
      />
      <ConfirmDialog
        open={Boolean(confirmUngroup)}
        title="بازگرداندن کامپوننت به نودها"
        message={confirmUngroup
          ? `کامپوننت «${String(confirmUngroup.data?.label || confirmUngroup.data?.typeLabel || '')}» در همین جریان به نودهای داخلی تبدیل شود؟ کامپوننت ذخیره‌شده در کتابخانه و استفاده‌های آن در جریان‌های دیگر بدون تغییر می‌ماند.`
          : ''}
        confirmLabel="بازگرداندن به نودها"
        busy={busy}
        onClose={() => setConfirmUngroup(null)}
        onConfirm={() => { if (confirmUngroup) ungroup(confirmUngroup); }}
      />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="حذف کامپوننت"
        message={confirmDelete
          ? `کامپوننت «${confirmDelete.name}» برای همیشه حذف شود؟ این کار فقط زمانی مجاز است که هیچ جریان یا نسخه‌ای از آن استفاده نکند.`
          : ''}
        confirmLabel="حذف کامپوننت"
        danger
        busy={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { void deleteConfirmed(); }}
      />
    </>
  );
}

import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../../../../../../shared/types';
import { ComponentDefinitionEditorDialog } from '../../../../../../_components/ComponentDefinitionEditorDialog';
import { ComponentVersionsDialog } from '../../../../../../_components/ComponentVersionsDialog';
import { ComponentVersionDialog, CreateComponentDialog } from '../../../../../../_components/WorkflowComponentDialogs';
import type { WorkflowComponentsController } from '../../_hooks/useWorkflowComponents';
export function ComponentEditorDialogs({ c, nodes, registry, selectedCount }: {
    c: WorkflowComponentsController;
    nodes: Node[];
    registry: RegistryNode[];
    selectedCount: number;
}) { return <><CreateComponentDialog open={c.createDialogOpen} busy={c.busy} selectedCount={selectedCount} initialInputs={c.boundary.inputs} initialOutputs={c.boundary.outputs} onClose={() => c.setCreateDialogOpen(false)} onCreate={(draft) => { void c.createFromSelection(draft); }}/><ComponentVersionDialog open={c.versionDialogOpen} busy={c.busy} currentVersion={c.editor?.version.semantic_version || '1.0.0'} onClose={() => c.setVersionDialogOpen(false)} onSave={(v, changelog) => { void c.saveVersion(v, changelog); }}/><ComponentDefinitionEditorDialog open={c.definitionDialogOpen} nodes={nodes} registry={registry} inputs={c.editor?.version.interface_json.inputs || []} outputs={c.editor?.version.interface_json.outputs || []} exposedParameters={c.editor?.version.exposed_parameters || []} onClose={() => c.setDefinitionDialogOpen(false)} onSave={c.applyDefinition}/><ComponentVersionsDialog open={Boolean(c.managed)} component={c.managed} versions={c.managedVersions} busy={c.busy} onClose={() => c.setManaged(null)} onRefresh={c.refreshManagedVersionsForDialog} onOpenVersion={(a) => { void c.openManagedVersion(a); }} onMakeCurrent={(a) => { void c.makeManagedVersionCurrent(a); }} onExportVersion={(a) => { void c.exportManagedVersion(a); }} onDeleteVersion={c.setConfirmDeleteVersion}/></>; }

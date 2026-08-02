import type { Edge, Node } from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Dataset, PortDefinition, RegistryNode, Run } from '../../shared/_types';
import { compatiblePorts, resolveRegistryId } from '../_model/catalog';
import { normalizeOutputs, type Output } from './ResultsPanel';
import type { InteractiveTableState } from './output/InteractiveTableOutput';
import { categoryClassName } from './NodePalette';
import { NodeDialogHeader } from '../../features/workflow/node-dialog/NodeDialogHeader';
import { NodeInputsPanel } from '../../features/workflow/node-dialog/NodeInputsPanel';
import { NodeOutputsPanel } from '../../features/workflow/node-dialog/NodeOutputsPanel';
import { NodeSettingsPanel } from '../../features/workflow/node-dialog/NodeSettingsPanel';
import { translateRegistryLabels } from '../../features/workflow/node-dialog/registryTranslation';
import { useResizableColumns } from '../../features/workflow/node-dialog/useResizableColumns';

export type NodeModalProps = {
  node: Node;
  workflowNodes: Node[];
  edges: Edge[];
  registry: RegistryNode[];
  aliases: Record<string, string>;
  portCompatibility: Record<string, string[]>;
  datasets: Dataset[];
  availableColumns: string[];
  availableIdColumns?: string[];
  inheritedIdColumn?: string | null;
  availableRows?: Record<string, unknown>[];
  run: Run | null;
  busy: boolean;
  onRunNode: () => void;
  onCancelRun: () => void;
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
  onRename: (nodeId: string, label: string) => void;
  onPinnedChange: (nodeId: string, pinned: { enabled?: boolean; sample?: string }) => void;
  onAddOutputToBoard?: (output: Output, index: number) => void;
  onInputSourceHandleChange: (edgeId: string, sourceHandle: string) => void;
  onClose: () => void;
};

export function NodeModal({ node, workflowNodes, edges, registry, aliases, portCompatibility, datasets, availableColumns, availableIdColumns = [], inheritedIdColumn = null, availableRows = [], run, busy, onRunNode, onCancelRun, onParamsChange, onRename, onPinnedChange, onAddOutputToBoard, onInputSourceHandleChange, onClose }: NodeModalProps) {
  const { gridRef, columns, beginResize } = useResizableColumns();
  const incoming = edges.filter((edge) => edge.target === node.id);
  const inputDataframes = incoming.map((edge) => {
    const sourceNode = workflowNodes.find((item) => item.id === edge.source);
    return { value: edge.source, label: `${String(sourceNode?.data?.label || sourceNode?.data?.typeLabel || edge.source)} · ${String(edge.sourceHandle || 'dataframe')}` };
  });
  const currentOutputs = normalizeOutputs(run, node.id);
  const targetRegistryId = resolveRegistryId(node.data.catalogId || node.data.registryId, aliases);
  const targetDefinition = registry.find((item) => item.id === targetRegistryId);
  const inputGroups = incoming.map((edge) => {
    const sourceNode = workflowNodes.find((item) => item.id === edge.source);
    const sourceRegistryId = resolveRegistryId(sourceNode?.data?.catalogId || sourceNode?.data?.registryId, aliases);
    const sourceDefinition = registry.find((item) => item.id === sourceRegistryId);
    const targetPort = targetDefinition?.inputs.find((port) => port.id === edge.targetHandle) || targetDefinition?.inputs[0];
    const sourcePorts = sourceDefinition?.outputs || (sourceNode?.data?.outputs as PortDefinition[] | undefined) || [];
    const compatibleSourcePorts = sourcePorts.filter((port) => compatiblePorts(String(port.type || 'any'), String(targetPort?.type || 'any'), portCompatibility));
    const configuredHandle = String(edge.sourceHandle || '');
    const selectedHandle = sourcePorts.some((port) => port.id === configuredHandle) ? configuredHandle : String(compatibleSourcePorts[0]?.id || sourcePorts[0]?.id || 'output');
    const sourceOutputs = normalizeOutputs(run, edge.source);
    const annotated = sourceOutputs.filter((output) => String(output.source_handle || '').trim());
    const selectedOutputs = sourceOutputs.filter((output) => String(output.source_handle || '') === selectedHandle);
    return { edge, sourceNode, sourceDefinition, sourcePorts, targetPort, selectedHandle, visibleOutputs: selectedOutputs.length ? selectedOutputs : (annotated.length ? [] : sourceOutputs) };
  });
  const pinned = (node.data.pinned || {}) as { enabled?: boolean; sample?: string };
  const translatedRegistry = useMemo(() => translateRegistryLabels(registry), [registry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateInteractiveTable = (_nodeId: string, tableState: InteractiveTableState) => {
    onParamsChange(node.id, { ...((node.data.params || {}) as Record<string, unknown>), table_state: tableState });
  };

  return (
    <div className="node-modal-backdrop workflow-shell-backdrop n8n-node-backdrop" onClick={onClose}>
      <div className={`node-modal workflow-shell-popup n8n-node-modal ${categoryClassName(String(node.data.category || 'Data Input'))}`} role="dialog" aria-modal="true" aria-label={`تنظیمات ${String(node.data.label || '')}`} onClick={(event) => event.stopPropagation()}>
        <NodeDialogHeader node={node} typeLabel={String(node.data.typeLabel || node.data.label || '')} category={String(node.data.category || 'Data Input')} busy={busy} onRunNode={onRunNode} onCancelRun={onCancelRun} onRename={onRename} onClose={onClose} />
        <div ref={gridRef} className="node-modal-grid n8n-node-grid n8n-node-grid-resizable" style={{ '--output-fr': `${columns.output}fr`, '--settings-fr': `${columns.settings}fr`, '--input-fr': `${columns.input}fr` } as CSSProperties}>
          <NodeOutputsPanel hasRun={Boolean(run)} outputs={currentOutputs} onAddToBoard={onAddOutputToBoard} onInteractiveTableChange={updateInteractiveTable} />
          <div className="n8n-column-resizer" role="separator" aria-label="تغییر عرض خروجی و تنظیمات" onPointerDown={(event) => beginResize('output', 'settings', event)} />
          <NodeSettingsPanel node={node} registry={translatedRegistry} aliases={aliases} datasets={datasets} availableColumns={availableColumns} availableIdColumns={availableIdColumns} inheritedIdColumn={inheritedIdColumn} availableRows={availableRows} inputDataframes={inputDataframes} pinned={pinned} onParamsChange={onParamsChange} onRename={onRename} onPinnedChange={(next) => onPinnedChange(node.id, { ...pinned, ...next })} />
          <div className="n8n-column-resizer" role="separator" aria-label="تغییر عرض تنظیمات و ورودی" onPointerDown={(event) => beginResize('settings', 'input', event)} />
          <NodeInputsPanel groups={inputGroups} hasRun={Boolean(run)} portCompatibility={portCompatibility} onInputSourceHandleChange={onInputSourceHandleChange} onAddOutputToBoard={onAddOutputToBoard} />
        </div>
      </div>
    </div>
  );
}

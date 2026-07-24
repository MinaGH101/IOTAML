import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { categoryClassName, nodeIcon } from '../NodePalette';
import type { PortDefinition, RunNodeStatus } from '../../../shared/_types';

type EditableNodeData = Record<string, unknown> & {
  label?: string;
  typeLabel?: string;
  category?: string;
  description?: string;
  inputs?: PortDefinition[];
  outputs?: PortDefinition[];
  comingSoon?: boolean;
  executionMode?: string;
  onRename?: (nodeId: string, label: string) => void;
  runtimeStatus?: RunNodeStatus['status'] | null;
};

function shapeClass(category: string) {
  if (category === 'Visualizations') return 'shape-ellipse';
  if (category.includes('ML Model')) return 'shape-square';
  return 'shape-rectangle';
}

function PortHandles({ ports, type }: { ports: PortDefinition[]; type: 'source' | 'target' }) {
  const position = type === 'source' ? Position.Right : Position.Left;
  const fallback = ports.length ? ports : [{ id: type === 'source' ? 'output' : 'input', name: 'Any', type: 'any', required: true, multiple: false }];
  return <>{fallback.map((port, index) => <Handle key={`${type}-${port.id}`} id={port.id} type={type} position={position} className={`typed-handle handle-${port.type}`} style={{ top: `${28 + index * 18}px` }} title={`${port.name || port.id}: ${port.type}`} />)}</>;
}

function MlNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as EditableNodeData;
  const category = String(nodeData.category || 'Data Input');
  const label = String(nodeData.label || 'Node');
  const typeLabel = String(nodeData.typeLabel || nodeData.label || 'Node Type');
  const iconNode = { id: String(nodeData.registryId || ''), label: typeLabel, description: String(nodeData.description || ''), category } as any;
  const runtimeStatus = nodeData.runtimeStatus || null;

  const visualRuntimeStatus = runtimeStatus && !['cached', 'succeeded', 'skipped'].includes(runtimeStatus) ? runtimeStatus : null;

  return (
    <div className={`ml-node ${categoryClassName(category)} ${shapeClass(category)} ${selected ? 'selected' : ''} ${nodeData.comingSoon ? 'node-coming-soon' : ''} ${visualRuntimeStatus ? `runtime-${visualRuntimeStatus}` : ''}`}>
      <PortHandles ports={(nodeData.inputs as PortDefinition[]) || []} type="target" />
      <div className="node-content">
        <div className="node-topline"><span className="node-icon">{nodeIcon(iconNode)}</span><span className="node-type-label">{typeLabel}</span></div>
        {selected ? (
          <input className="node-title-input nodrag nopan" dir="ltr" value={label} aria-label="نام نود" onChange={(event) => nodeData.onRename?.(id, event.target.value)} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} />
        ) : <div className="node-title">{label}</div>}
        <div className="node-port-summary" dir="ltr">{nodeData.executionMode || 'instant'}{nodeData.comingSoon ? ' · coming soon' : ''}</div>
      </div>
      <PortHandles ports={(nodeData.outputs as PortDefinition[]) || []} type="source" />
    </div>
  );
}

export const MlNode = memo(MlNodeComponent);

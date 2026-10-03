import type { CSSProperties } from 'react';
import type { Node } from '@xyflow/react';
import { ListTree } from 'lucide-react';
import { categoryClassName, nodeIcon } from '../../../_components/NodePalette';
import type { RegistryNode } from '../../../../shared/types';
type Props = {
    nodes: Node[];
    selectedId: string | null;
    collapsed: boolean;
    floatingLeftStyle: CSSProperties;
    onSelectNode: (nodeId: string) => void;
    onClose: () => void;
};
function nodeData(node: Node) {
    return node.data as Record<string, unknown>;
}
export function WorkflowNodesList({ nodes, selectedId, collapsed, floatingLeftStyle, onSelectNode, onClose }: Props) {
    if (collapsed) return null;
    return (<div className="left-stack workflow-nodes-list-panel" style={{ ...floatingLeftStyle, overflow: 'hidden' }}>
      <div className="workflow-node-list-shell">
        <div className="workflow-node-list-head">
          <span><button className="workflow-node-list-toggle" type="button" onClick={onClose} title="بستن لیست نودها" aria-label="بستن لیست نودها"><ListTree size={17}/></button> نودهای Workflow</span>
          <small>{nodes.length.toLocaleString('fa-IR')} نود</small>
        </div>
        <div className="workflow-node-list-scroll">
          {nodes.length === 0 && <div className="empty-state small">هنوز نودی در Workflow وجود ندارد.</div>}
          {nodes.map((node, index) => {
            const data = nodeData(node);
            const category = String(data.category || 'Data Input');
            const typeLabel = String(data.typeLabel || data.label || node.id);
            const label = String(data.label || `Node ${index + 1}`);
            return (<button key={node.id} className={`workflow-node-list-item ${categoryClassName(category)} ${selectedId === node.id ? 'active' : ''}`} type="button" onClick={() => onSelectNode(node.id)}>
                <span className="workflow-node-list-icon">{nodeIcon({ id: String(data.registryId || ''), label: typeLabel, description: String(data.description || ''), category } as RegistryNode, 16)}</span>
                <span className="workflow-node-list-main">
                  <b>{label}</b>
                  <small>{typeLabel}</small>
                </span>
              </button>);
        })}
        </div>
      </div>
    </div>);
}

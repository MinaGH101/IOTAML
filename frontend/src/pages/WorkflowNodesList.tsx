import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import { ChevronLeft, ListTree } from 'lucide-react';
import { categoryClassName, nodeIcon } from '../components/NodePalette';
import type { RegistryNode } from '../types';

type Props = {
  nodes: Node[];
  selectedId: string | null;
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  floatingLeftStyle: CSSProperties;
  onSelectNode: (nodeId: string) => void;
};

function nodeData(node: Node) {
  return node.data as Record<string, unknown>;
}

export function WorkflowNodesList({ nodes, selectedId, collapsed, setCollapsed, floatingLeftStyle, onSelectNode }: Props) {
  if (collapsed) {
    return (
      <button
        className="analysis-board-node-launcher"
        type="button"
        onClick={() => setCollapsed(false)}
        title="باز کردن لیست نودها"
        aria-label="باز کردن لیست نودها"
        style={{
          position: 'fixed',
          top: floatingLeftStyle.top,
          left: floatingLeftStyle.left,
          zIndex: floatingLeftStyle.zIndex,
        }}
      >
        <ListTree size={18} />
      </button>
    );
  }

  return (
    <div className="left-stack workflow-nodes-list-panel" style={{ ...floatingLeftStyle, overflow: 'hidden' }}>
      <button
        className="workflow-float-toggle workflow-float-toggle-left"
        type="button"
        onClick={() => setCollapsed(true)}
        title="بستن لیست نودها"
        aria-label="بستن لیست نودها"
      >
        <ChevronLeft size={15} />
      </button>

      <div className="workflow-node-list-shell">
        <div className="workflow-node-list-head">
          <span><ListTree size={14} /> نودهای Workflow</span>
          <small>{nodes.length.toLocaleString('fa-IR')} نود</small>
        </div>
        <div className="workflow-node-list-scroll">
          {nodes.length === 0 && <div className="empty-state small">هنوز نودی در Workflow وجود ندارد.</div>}
          {nodes.map((node, index) => {
            const data = nodeData(node);
            const category = String(data.category || 'Data Input');
            const typeLabel = String(data.typeLabel || data.label || node.id);
            const label = String(data.label || `Node ${index + 1}`);
            return (
              <button
                key={node.id}
                className={`workflow-node-list-item ${categoryClassName(category)} ${selectedId === node.id ? 'active' : ''}`}
                type="button"
                onClick={() => onSelectNode(node.id)}
              >
                <span className="workflow-node-list-icon">{nodeIcon({ id: String(data.registryId || ''), label: typeLabel, description: String(data.description || ''), category } as RegistryNode, 16)}</span>
                <span className="workflow-node-list-main">
                  <b>{label}</b>
                  <small>{typeLabel}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

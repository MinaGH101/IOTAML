import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import { ChevronLeft, ChevronRight, ListTree, SlidersHorizontal } from 'lucide-react';
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
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as globalThis.Node)) setControlsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return (
    <div className={`left-stack workflow-nodes-list-panel ${collapsed ? 'left-stack-collapsed workflow-nodes-list-collapsed' : ''}`} style={{ ...floatingLeftStyle, overflow: 'visible' }}>
      <button
        className="workflow-float-toggle workflow-float-toggle-left"
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        title={collapsed ? 'باز کردن لیست نودها' : 'بستن لیست نودها'}
        aria-label={collapsed ? 'باز کردن لیست نودها' : 'بستن لیست نودها'}
        style={{
          top: collapsed ? '10px' : '12px',
          left: collapsed ? 'calc(100% + 8px)' : '12px',
          right: 'auto',
          zIndex: 7000
        }}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      <div className="analysis-board-control-anchor" ref={controlsRef}>
        <button
          className={`workflow-float-toggle analysis-board-control-toggle ${controlsOpen ? 'active' : ''}`}
          type="button"
          onClick={() => setControlsOpen((value) => !value)}
          title="تنظیمات Analysis Board"
          aria-label="تنظیمات Analysis Board"
        >
          <SlidersHorizontal size={15} />
        </button>
        <div className={`analysis-board-control-popup workflow-shell-popup ${controlsOpen ? 'open' : ''}`}>
          <div id="analysis-board-controls-host" />
        </div>
      </div>

      {collapsed ? (
        <div className="workflow-node-mini-list" aria-label="نودهای Workflow">
          {nodes.map((node, index) => {
            const data = nodeData(node);
            const category = String(data.category || 'Data Input');
            const typeLabel = String(data.typeLabel || data.label || node.id);
            return (
              <button
                key={node.id}
                className={`workflow-node-mini-item ${categoryClassName(category)} ${selectedId === node.id ? 'active' : ''}`}
                type="button"
                title={String(data.label || typeLabel)}
                onClick={() => onSelectNode(node.id)}
              >
                {nodeIcon({ id: String(data.registryId || ''), label: typeLabel, description: String(data.description || ''), category } as RegistryNode, 16) || index + 1}
              </button>
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
}

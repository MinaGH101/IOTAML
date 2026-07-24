import type { Edge, Node } from '@xyflow/react';
import { ChevronDown, ChevronUp, Trash2, Ungroup } from 'lucide-react';
import { useState } from 'react';
import type { Dataset, RegistryNode } from '../../shared/_types';
import { categoryLabel } from './NodePalette';
import { ParamEditor } from './ParamEditor';

type Props = {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  datasets: Dataset[];
  availableColumns: string[];
  availableIdColumns?: string[];
  inheritedIdColumn?: string | null;
  availableRows?: Record<string, unknown>[];
  onChange: (nodeId: string, params: Record<string, unknown>) => void;
  onRename: (nodeId: string, label: string) => void;
  onDelete: () => void;
  onUngroupComponent?: (node: Node) => void;
  embedded?: boolean;
  readOnly?: boolean;
};

export function Inspector({ selectedNode, selectedEdge, registry, aliases, datasets, availableColumns, availableIdColumns = [], inheritedIdColumn = null, availableRows = [], onChange, onRename, onDelete, onUngroupComponent, embedded = false, readOnly = false }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  const edgeBody = selectedEdge ? (
    <div className="inspector-header">
      <span>اتصال انتخاب‌شده</span>
      <div className="inspector-name-row">
        <b>{selectedEdge.source} → {selectedEdge.target}</b>
        {!readOnly && <button className="danger icon-only compact-danger" title="حذف اتصال" aria-label="حذف اتصال" type="button" onClick={onDelete}><Trash2 size={13} /></button>}
      </div>
      <p>برای حذف اتصال می‌توانید کلید Delete را هم بزنید.</p>
    </div>
  ) : null;

  const emptyBody = <div className="empty-state">برای تنظیم کامل، روی نود دابل‌کلیک کنید.</div>;

  const nodeBody = selectedNode ? (
    <>
      <div className="inspector-header">
        <span>{categoryLabel(String(selectedNode.data.category))}</span>
        <div className="inspector-name-row">
          <b>{String(selectedNode.data.typeLabel || selectedNode.data.label)} · {String(selectedNode.data.label)}</b>
          {!readOnly && <button className="danger icon-only compact-danger" title="حذف نود" aria-label="حذف نود" type="button" onClick={onDelete}><Trash2 size={13} /></button>}
        </div>
        <p>برای پنجره کامل شبیه n8n روی نود دابل‌کلیک کنید.</p>
        {!readOnly && Boolean(selectedNode.data?.componentSnapshot) && onUngroupComponent && (
          <button type="button" className="secondary-button compact inspector-component-ungroup" onClick={() => onUngroupComponent(selectedNode)}>
            <Ungroup size={14} /> بازگرداندن به نودهای اصلی
          </button>
        )}
      </div>
      <fieldset className="inspector-readonly-fieldset" disabled={readOnly}>
        <ParamEditor selectedNode={selectedNode} registry={registry} aliases={aliases} datasets={datasets} availableColumns={availableColumns} availableIdColumns={availableIdColumns} inheritedIdColumn={inheritedIdColumn} availableRows={availableRows} onParamsChange={onChange} onRename={onRename} />
      </fieldset>
    </>
  ) : null;

  if (embedded) {
    return <div className="inspector inspector-embedded">{edgeBody || nodeBody || emptyBody}</div>;
  }

  if (selectedEdge) {
    return (
      <aside className="inspector">
        <div className="panel-title action-title"><span>تنظیمات</span><button className="tiny-icon" type="button" onClick={() => setCollapsed((v) => !v)}>{collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button></div>
        {!collapsed && <>
          <div className="inspector-header">
            <span>اتصال انتخاب‌شده</span>
            <div className="inspector-name-row">
              <b>{selectedEdge.source} → {selectedEdge.target}</b>
              {!readOnly && <button className="danger icon-only compact-danger" title="حذف اتصال" aria-label="حذف اتصال" type="button" onClick={onDelete}><Trash2 size={13} /></button>}
            </div>
            <p>برای حذف اتصال می‌توانید کلید Delete را هم بزنید.</p>
          </div>
        </>}
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="inspector">
        <div className="panel-title action-title"><span>تنظیمات سریع</span><button className="tiny-icon" type="button" onClick={() => setCollapsed((v) => !v)}>{collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button></div>
        {!collapsed && <div className="empty-state">برای تنظیم کامل، روی نود دابل‌کلیک کنید.</div>}
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <div className="panel-title action-title"><span>تنظیمات سریع</span><button className="tiny-icon" type="button" onClick={() => setCollapsed((v) => !v)}>{collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button></div>
      {!collapsed && <>
        <div className="inspector-header">
          <span>{categoryLabel(String(selectedNode.data.category))}</span>
          <div className="inspector-name-row">
            <b>{String(selectedNode.data.typeLabel || selectedNode.data.label)} · {String(selectedNode.data.label)}</b>
            {!readOnly && <button className="danger icon-only compact-danger" title="حذف نود" aria-label="حذف نود" type="button" onClick={onDelete}><Trash2 size={13} /></button>}
          </div>
          <p>برای پنجره کامل شبیه n8n روی نود دابل‌کلیک کنید.</p>
        </div>
        <fieldset className="inspector-readonly-fieldset" disabled={readOnly}>
          <ParamEditor selectedNode={selectedNode} registry={registry} aliases={aliases} datasets={datasets} availableColumns={availableColumns} availableIdColumns={availableIdColumns} inheritedIdColumn={inheritedIdColumn} availableRows={availableRows} onParamsChange={onChange} onRename={onRename} />
        </fieldset>
      </>}
    </aside>
  );
}

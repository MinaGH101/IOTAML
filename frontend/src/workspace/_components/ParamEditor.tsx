import type { Node } from '@xyflow/react';
import type { SelectOption } from '../../shared/ui';
import type { Dataset, RegistryNode } from '../../shared/types';
import { ParamField } from './param-editor/ParamField';
import { useParamEditorModel } from './param-editor/useParamEditorModel';
export type ParamEditorProps = {
    selectedNode: Node;
    registry: RegistryNode[];
    aliases: Record<string, string>;
    datasets: Dataset[];
    availableColumns: string[];
    availableIdColumns?: string[];
    inheritedIdColumn?: string | null;
    availableRows?: Record<string, unknown>[];
    inputDataframes?: SelectOption[];
    onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
    onRename?: (nodeId: string, label: string) => void;
};
export function ParamEditor(p: ParamEditorProps) { const m = useParamEditorModel(p); return <div className="param-editor workflow-shell-editor"><label className="field"><span>نام نود</span><input className="node-name-input" dir="ltr" value={String(p.selectedNode.data.label || '')} onChange={(e) => p.onRename?.(p.selectedNode.id, e.target.value)}/></label>{m.registryNode?.comingSoon && <div className="node-warning workflow-shell-card">این نود در رجیستری وجود دارد اما اجرای کامل آن هنوز Stub است.</div>}{m.schema.length === 0 && <div className="empty-state">این نود تنظیم خاصی ندارد.</div>}{m.schema.map((param) => <ParamField key={param.name} param={param} p={p} m={m}/>)}</div>; }

import type { Node } from '@xyflow/react';
import { Save, Trash2, X } from 'lucide-react';
import type { CustomNodeDefinition, CustomNodePayload, RegistryNode } from '../../shared/types';
import { BuilderSections } from './custom-node-builder/BuilderSections';
import { useCustomNodeBuilder } from './custom-node-builder/useCustomNodeBuilder';
export function CustomNodeBuilder({ definition, workflowNodes, registry, busy, onSave, onDelete, onClose }: {
    definition: CustomNodeDefinition | null;
    workflowNodes: Node[];
    registry: RegistryNode[];
    busy: boolean;
    onSave: (payload: CustomNodePayload) => Promise<void>;
    onDelete?: () => Promise<void>;
    onClose: () => void;
}) { const m = useCustomNodeBuilder({ definition, workflowNodes, registry, onSave }); return <div className="node-modal-backdrop custom-node-builder-backdrop" onClick={onClose}><div className="node-modal custom-node-builder" dir="rtl" onClick={(e) => e.stopPropagation()}><header className="custom-node-builder-head"><div><span>USER NODE BUILDER</span><h2>{definition ? `ویرایش ${definition.label}` : 'ساخت نود سفارشی'}</h2><p>پورت‌های تایپ‌شده، template تست و اجرای Python sandboxed</p></div><div className="custom-node-builder-actions">{definition && onDelete && <button className="danger" type="button" disabled={busy} onClick={() => onDelete().catch((e) => m.setError(e instanceof Error ? e.message : 'حذف ناموفق بود'))}><Trash2 size={17}/> حذف</button>}<button className="primary" type="button" disabled={busy} onClick={m.submit}><Save size={17}/> ذخیره نود</button><button className="icon-button icon-only" type="button" onClick={onClose}><X size={15}/></button></div></header><div className="custom-node-builder-meta"><label>نام نود<input value={m.name} onChange={(e) => m.setName(e.target.value)}/></label><label>توضیح<input value={m.description} onChange={(e) => m.setDescription(e.target.value)}/></label></div>{m.error && <div className="error-box custom-builder-error">{m.error}</div>}<BuilderSections m={m} workflowNodes={workflowNodes} registry={registry}/></div></div>; }

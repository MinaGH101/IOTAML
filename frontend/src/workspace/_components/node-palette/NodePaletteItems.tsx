import { Pencil, Plus } from 'lucide-react';
import type { DragEvent } from 'react';
import type { RegistryNode } from '../../../shared/types';
import { categoryClassName, nodeIcon } from './config';
function onDragStart(event: DragEvent<HTMLDivElement>, node: RegistryNode) { event.dataTransfer.setData('application/iotaml-node', node.id); event.dataTransfer.effectAllowed = 'move'; }
export function NodeItem({ node, onEdit }: {
    node: RegistryNode;
    onEdit?: (node: RegistryNode) => void;
}) {
    return <div className={`palette-node-card node-palette-item workflow-shell-item ${categoryClassName(node.category)} ${node.comingSoon ? 'coming-soon' : ''} ${node.isCustom ? 'custom-palette-node' : ''}`} draggable onDragStart={(e) => onDragStart(e, node)} title={`${node.label} · ${node.description}${node.comingSoon ? ' · coming soon' : ''}`}>
    {node.isCustom && onEdit && <button className="custom-node-edit-button" type="button" title="ویرایش نود سفارشی" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(node); }}><Pencil size={11}/></button>}<span className="palette-node-icon">{nodeIcon(node, 17)}</span><span className="palette-node-name">{node.label}</span></div>;
}
export function CreateCustomNodeCard({ onClick }: {
    onClick?: () => void;
}) { return <button className="palette-node-card node-palette-item custom-node-create-card workflow-shell-item cat-user-nodes" type="button" onClick={onClick}><span className="palette-node-icon"><Plus size={17}/></span><span className="palette-node-name">ساخت نود</span></button>; }

import type { RegistryNode } from '../../../shared/types';
import { categoryClassName, categoryIcon, categoryLabel, categoryOrder } from './config';
import { CreateCustomNodeCard, NodeItem } from './NodePaletteItems';
export function CollapsedPalette({ grouped, flyout, setFlyout, onCreate, onEdit }: {
    grouped: Map<string, RegistryNode[]>;
    flyout: string | null;
    setFlyout: (v: string | null) => void;
    onCreate?: () => void;
    onEdit?: (n: RegistryNode) => void;
}) { return <aside className="node-palette collapsed-palette workflow-shell-panel"><div className="collapsed-icons">{categoryOrder.map((category) => { const items = grouped.get(category) || []; if (!items.length && category !== 'User Nodes')
    return null; const active = flyout === category; return <button key={category} type="button" className={`collapsed-category workflow-shell-item ${categoryClassName(category)} ${active ? 'active' : ''}`} onClick={() => setFlyout(active ? null : category)} title={categoryLabel(category)}>{categoryIcon(category)}</button>; })}</div>{flyout && <div className={`palette-flyout workflow-shell-popup ${categoryClassName(flyout)}`}><header><b>{categoryLabel(flyout)}</b><button type="button" onClick={() => setFlyout(null)}>×</button></header><div className="palette-flyout-grid">{flyout === 'User Nodes' && <CreateCustomNodeCard onClick={onCreate}/>} {(grouped.get(flyout) || []).map((node) => <NodeItem node={node} key={node.id} onEdit={onEdit}/>)}</div></div>}</aside>; }

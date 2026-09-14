import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { RegistryNode } from '../../../shared/types';
import { categoryClassName, categoryIcon, categoryLabel, categoryOrder } from './config';
import { CreateCustomNodeCard, NodeItem } from './NodePaletteItems';
export function ExpandedPalette({ nodes, grouped, search, setSearch, open, setOpen, onCreate, onEdit }: {
    nodes: RegistryNode[];
    grouped: Map<string, RegistryNode[]>;
    search: string;
    setSearch: (v: string) => void;
    open: Record<string, boolean>;
    setOpen: (v: Record<string, boolean>) => void;
    onCreate?: () => void;
    onEdit?: (n: RegistryNode) => void;
}) { return <aside className="node-palette workflow-shell-panel"><div className="palette-header"><div className="palette-title-block"><span>جعبه نودها</span><small>{nodes.length} نود علمی</small></div></div><label className="search-box palette-search workflow-shell-card"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی نود، دسته یا توضیح..."/></label><div className="palette-groups">{categoryOrder.map((category) => { const items = grouped.get(category) || []; if (!items.length && category !== 'User Nodes')
    return null; const isOpen = open[category] ?? true; return <section className={`palette-group node-group ${categoryClassName(category)}`} key={category}><button className="group-toggle workflow-shell-item" type="button" onClick={() => setOpen({ ...open, [category]: !isOpen })}><span className="group-title-main">{categoryIcon(category)} {categoryLabel(category)}</span>{isOpen ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</button>{isOpen && <div className="palette-grid">{category === 'User Nodes' && <CreateCustomNodeCard onClick={onCreate}/>} {items.map((node) => <NodeItem node={node} key={node.id} onEdit={onEdit}/>)}</div>}</section>; })}</div></aside>; }

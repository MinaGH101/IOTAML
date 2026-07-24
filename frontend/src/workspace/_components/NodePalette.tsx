import {
  Activity,
  BarChart3,
  BrainCircuit,
  ChartColumn,
  ChartScatter,
  ChartSpline,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns3,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Filter,
  FlaskConical,
  Gauge,
  LineChart,
  ListChecks,
  Pencil,
  PieChart,
  Plus,
  Replace,
  Rows3,
  Scaling,
  Search,
  SearchCheck,
  Shuffle,
  Sigma,
  Sparkles,
  Table2,
  Target,
  Trees,
  UserRoundCog,
  Workflow,
  Layers3,
  Zap
} from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { NodeCategory, RegistryNode } from '../../shared/_types';

type Props = {
  nodes: RegistryNode[];
  collapsed: boolean;
  onToggle: () => void;
  onCreateCustomNode?: () => void;
  onEditCustomNode?: (node: RegistryNode) => void;
};

export const categoryOrder: NodeCategory[] = [
  'Data Input',
  'Data Inspection',
  'Data Cleaning',
  'Anomaly Detection',
  'Transformation',
  'Visualizations',
  'ML Data Processing',
  'ML Regression Models',
  'ML Classification Models',
  'ML Model Analysis',
  'Export or Report',
  'Utilities / Advanced',
  'User Nodes',
  'Components'
];

const categoryMeta: Record<NodeCategory, { fa: string; icon: ReactNode }> = {
  'Data Input': { fa: 'ورود داده', icon: <Database size={15} /> },
  'Data Inspection': { fa: 'بازرسی داده', icon: <SearchCheck size={15} /> },
  'Data Cleaning': { fa: 'پاکسازی داده', icon: <FlaskConical size={15} /> },
  'Anomaly Detection': { fa: 'تشخیص ناهنجاری', icon: <Gauge size={15} /> },
  Transformation: { fa: 'تبدیل داده', icon: <Scaling size={15} /> },
  Visualizations: { fa: 'نمودارها', icon: <BarChart3 size={15} /> },
  'ML Data Processing': { fa: 'آماده‌سازی ML', icon: <Workflow size={15} /> },
  'ML Regression Models': { fa: 'مدل‌های رگرسیون', icon: <BrainCircuit size={15} /> },
  'ML Classification Models': { fa: 'مدل‌های طبقه‌بندی', icon: <BrainCircuit size={15} /> },
  'ML Model Analysis': { fa: 'تحلیل مدل', icon: <SearchCheck size={15} /> },
  'Export or Report': { fa: 'خروجی و گزارش', icon: <Download size={15} /> },
  'Utilities / Advanced': { fa: 'ابزارهای پیشرفته', icon: <Zap size={15} /> },
  'User Nodes': { fa: 'نودهای سفارشی', icon: <UserRoundCog size={15} /> },
  Components: { fa: 'کامپوننت‌ها', icon: <Layers3 size={15} /> }
};

export function categoryLabel(category: string) { return categoryMeta[category as NodeCategory]?.fa ?? category; }
export function categoryIcon(category: string) { return categoryMeta[category as NodeCategory]?.icon ?? <Sparkles size={15} />; }
export function categoryClassName(category: string) { return `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`; }

export function nodeIcon(node: RegistryNode, size = 15): ReactNode {
  const key = `${node.id} ${node.label} ${node.description}`.toLowerCase();
  if (node.isComponent) return <Layers3 size={size} />;
  if (node.isCustom) return <UserRoundCog size={size} />;
  if (/python|code/.test(key)) return <Code2 size={size} />;
  if (/csv|excel|file|upload|import/.test(key)) return <FileUp size={size} />;
  if (/json|manual/.test(key)) return <FileSpreadsheet size={size} />;
  if (/select|target|feature/.test(key)) return <Target size={size} />;
  if (/drop|remove|column/.test(key)) return <Columns3 size={size} />;
  if (/row|sample|split/.test(key)) return <Rows3 size={size} />;
  if (/replace|value/.test(key)) return <Replace size={size} />;
  if (/filter/.test(key)) return <Filter size={size} />;
  if (/shuffle|random/.test(key)) return <Shuffle size={size} />;
  if (/scale|standard|normalize|minmax/.test(key)) return <Scaling size={size} />;
  if (/encode|one.?hot|label/.test(key)) return <ListChecks size={size} />;
  if (/scatter/.test(key)) return <ChartScatter size={size} />;
  if (/line/.test(key)) return <LineChart size={size} />;
  if (/bar|column|hist|importance/.test(key)) return <ChartColumn size={size} />;
  if (/pie|radar|spider/.test(key)) return <PieChart size={size} />;
  if (/plot|chart|visual|graph/.test(key)) return <ChartSpline size={size} />;
  if (/describe|summary|stat|mae/.test(key)) return <Sigma size={size} />;
  if (/correlation|corr|matrix|table/.test(key)) return <Table2 size={size} />;
  if (/forest|tree/.test(key)) return <Trees size={size} />;
  if (/regress|linear|logistic|svm|classifier|model|train|neural/.test(key)) return <BrainCircuit size={size} />;
  if (/cluster|pca|kmeans/.test(key)) return <Workflow size={size} />;
  if (/metric|score|accuracy|report/.test(key)) return <Gauge size={size} />;
  if (/predict|prediction/.test(key)) return <Activity size={size} />;
  return categoryIcon(node.category);
}

function onDragStart(event: DragEvent<HTMLDivElement>, node: RegistryNode) {
  event.dataTransfer.setData('application/nocodeml-node', node.id);
  event.dataTransfer.effectAllowed = 'move';
}

function NodeItem({ node, onEdit }: { node: RegistryNode; onEdit?: (node: RegistryNode) => void }) {
  return (
    <div
      className={`palette-node-card node-palette-item workflow-shell-item ${categoryClassName(node.category)} ${node.comingSoon ? 'coming-soon' : ''} ${node.isCustom ? 'custom-palette-node' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, node)}
      title={`${node.label} · ${node.description}${node.comingSoon ? ' · coming soon' : ''}`}
    >
      {node.isCustom && onEdit && (
        <button
          className="custom-node-edit-button"
          type="button"
          title="ویرایش نود سفارشی"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onEdit(node); }}
        >
          <Pencil size={11} />
        </button>
      )}
      <span className="palette-node-icon">{nodeIcon(node, 17)}</span>
      <span className="palette-node-name">{node.label}</span>
    </div>
  );
}

function CreateCustomNodeCard({ onClick }: { onClick?: () => void }) {
  return (
    <button className="palette-node-card node-palette-item custom-node-create-card workflow-shell-item cat-user-nodes" type="button" onClick={onClick}>
      <span className="palette-node-icon"><Plus size={17} /></span>
      <span className="palette-node-name">ساخت نود</span>
    </button>
  );
}

export function NodePalette({ nodes, collapsed, onCreateCustomNode, onEditCustomNode }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flyoutCategory, setFlyoutCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return nodes.filter((node) => !query || `${node.label} ${node.category} ${node.description} ${node.id}`.toLowerCase().includes(query));
  }, [nodes, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, RegistryNode[]>();
    categoryOrder.forEach((category) => map.set(category, []));
    filtered.forEach((node) => map.set(node.category, [...(map.get(node.category) || []), node]));
    return map;
  }, [filtered]);

  if (collapsed) {
    return (
      <aside className="node-palette collapsed-palette workflow-shell-panel">
        <div className="collapsed-icons">
          {categoryOrder.map((category) => {
            const items = grouped.get(category) || [];
            if (items.length === 0 && category !== 'User Nodes') return null;
            const active = flyoutCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={`collapsed-category workflow-shell-item ${categoryClassName(category)} ${active ? 'active' : ''}`}
                onClick={() => setFlyoutCategory(active ? null : category)}
                title={categoryLabel(category)}
              >
                {categoryIcon(category)}
              </button>
            );
          })}
        </div>
        {flyoutCategory && (
          <div className={`palette-flyout workflow-shell-popup ${categoryClassName(flyoutCategory)}`}>
            <header><b>{categoryLabel(flyoutCategory)}</b><button type="button" onClick={() => setFlyoutCategory(null)}>×</button></header>
            <div className="palette-flyout-grid">
              {flyoutCategory === 'User Nodes' && <CreateCustomNodeCard onClick={onCreateCustomNode} />}
              {(grouped.get(flyoutCategory) || []).map((node) => <NodeItem node={node} key={node.id} onEdit={onEditCustomNode} />)}
            </div>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="node-palette workflow-shell-panel">
      <div className="palette-header">
        <div className="palette-title-block"><span>جعبه نودها</span><small>{nodes.length} نود علمی</small></div>
      </div>
      <label className="search-box palette-search workflow-shell-card"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجوی نود، دسته یا توضیح..." /></label>
      <div className="palette-groups">
        {categoryOrder.map((category) => {
          const items = grouped.get(category) || [];
          if (items.length === 0 && category !== 'User Nodes') return null;
          const isOpen = open[category] ?? true;
          return (
            <section className={`palette-group node-group ${categoryClassName(category)}`} key={category}>
              <button className="group-toggle workflow-shell-item" type="button" onClick={() => setOpen((state) => ({ ...state, [category]: !isOpen }))}>
                <span className="group-title-main">{categoryIcon(category)} {categoryLabel(category)}</span>
                {isOpen ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
              </button>
              {isOpen && (
                <div className="palette-grid">
                  {category === 'User Nodes' && <CreateCustomNodeCard onClick={onCreateCustomNode} />}
                  {items.map((node) => <NodeItem node={node} key={node.id} onEdit={onEditCustomNode} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

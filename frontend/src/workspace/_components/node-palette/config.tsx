import { Activity, BarChart3, BrainCircuit, ChartColumn, ChartScatter, ChartSpline, Code2, Columns3, Database, Download, FileSpreadsheet, FileUp, Filter, FlaskConical, Gauge, LineChart, ListChecks, PieChart, Replace, Rows3, Scaling, SearchCheck, Shuffle, Sigma, Sparkles, Table2, Target, Trees, UserRoundCog, Workflow, Layers3, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NodeCategory, RegistryNode } from '../../../shared/types';
export const categoryOrder: NodeCategory[] = ['Data Input', 'Data Inspection', 'Data Cleaning', 'Anomaly Detection', 'Transformation', 'Visualizations', 'ML Data Processing', 'ML Regression Models', 'ML Classification Models', 'ML Model Analysis', 'Export or Report', 'Utilities / Advanced', 'User Nodes', 'Components'];
const meta: Record<NodeCategory, {
    fa: string;
    icon: ReactNode;
}> = {
    'Data Input': { fa: 'ورود داده', icon: <Database size={15}/> }, 'Data Inspection': { fa: 'بازرسی داده', icon: <SearchCheck size={15}/> }, 'Data Cleaning': { fa: 'پاکسازی داده', icon: <FlaskConical size={15}/> }, 'Anomaly Detection': { fa: 'تشخیص ناهنجاری', icon: <Gauge size={15}/> }, Transformation: { fa: 'تبدیل داده', icon: <Scaling size={15}/> }, Visualizations: { fa: 'نمودارها', icon: <BarChart3 size={15}/> }, 'ML Data Processing': { fa: 'آماده‌سازی ML', icon: <Workflow size={15}/> }, 'ML Regression Models': { fa: 'مدل‌های رگرسیون', icon: <BrainCircuit size={15}/> }, 'ML Classification Models': { fa: 'مدل‌های طبقه‌بندی', icon: <BrainCircuit size={15}/> }, 'ML Model Analysis': { fa: 'تحلیل مدل', icon: <SearchCheck size={15}/> }, 'Export or Report': { fa: 'خروجی و گزارش', icon: <Download size={15}/> }, 'Utilities / Advanced': { fa: 'ابزارهای پیشرفته', icon: <Zap size={15}/> }, 'User Nodes': { fa: 'نودهای سفارشی', icon: <UserRoundCog size={15}/> }, Components: { fa: 'کامپوننت‌ها', icon: <Layers3 size={15}/> }
};
export const categoryLabel = (c: string) => meta[c as NodeCategory]?.fa ?? c;
export const categoryIcon = (c: string) => meta[c as NodeCategory]?.icon ?? <Sparkles size={15}/>;
export const categoryClassName = (c: string) => `cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
export function nodeIcon(node: RegistryNode, size = 15): ReactNode { const key = `${node.id} ${node.label} ${node.description}`.toLowerCase(); const rules: Array<[
    RegExp,
    ReactNode
]> = [[/python|code/, <Code2 size={size}/>], [/csv|excel|file|upload|import/, <FileUp size={size}/>], [/json|manual/, <FileSpreadsheet size={size}/>], [/select|target|feature/, <Target size={size}/>], [/drop|remove|column/, <Columns3 size={size}/>], [/row|sample|split/, <Rows3 size={size}/>], [/replace|value/, <Replace size={size}/>], [/filter/, <Filter size={size}/>], [/shuffle|random/, <Shuffle size={size}/>], [/scale|standard|normalize|minmax/, <Scaling size={size}/>], [/encode|one.?hot|label/, <ListChecks size={size}/>], [/scatter/, <ChartScatter size={size}/>], [/line/, <LineChart size={size}/>], [/bar|column|hist|importance/, <ChartColumn size={size}/>], [/pie|radar|spider/, <PieChart size={size}/>], [/plot|chart|visual|graph/, <ChartSpline size={size}/>], [/describe|summary|stat|mae/, <Sigma size={size}/>], [/correlation|corr|matrix|table/, <Table2 size={size}/>], [/forest|tree/, <Trees size={size}/>], [/regress|linear|logistic|svm|classifier|model|train|neural/, <BrainCircuit size={size}/>], [/cluster|pca|kmeans/, <Workflow size={size}/>], [/metric|score|accuracy|report/, <Gauge size={size}/>], [/predict|prediction/, <Activity size={size}/>]]; if (node.isComponent)
    return <Layers3 size={size}/>; if (node.isCustom)
    return <UserRoundCog size={size}/>; return rules.find(([re]) => re.test(key))?.[1] ?? categoryIcon(node.category); }

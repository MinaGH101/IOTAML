import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { InspectorBody } from './inspector/InspectorBody';
import type { InspectorProps } from './inspector/types';
export function Inspector(raw: InspectorProps) { const p = { ...raw, availableIdColumns: raw.availableIdColumns || [], inheritedIdColumn: raw.inheritedIdColumn ?? null, availableRows: raw.availableRows || [], inputDataframes: raw.inputDataframes || [], readOnly: raw.readOnly ?? false }; const [collapsed, setCollapsed] = useState(true); if (p.embedded)
    return <div className="inspector inspector-embedded"><InspectorBody {...p}/></div>; const title = p.selectedEdge ? 'تنظیمات' : 'تنظیمات سریع'; return <aside className="inspector"><div className="panel-title action-title"><span>{title}</span><button className="tiny-icon" type="button" onClick={() => setCollapsed((v) => !v)}>{collapsed ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}</button></div>{!collapsed && <InspectorBody {...p}/>}</aside>; }

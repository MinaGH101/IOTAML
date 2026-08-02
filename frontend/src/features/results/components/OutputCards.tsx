import { Download, Maximize2, Pin, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Output } from '../../../workspace/_model/output';
import type { InteractiveTableState } from '../../../workspace/_components/output/InteractiveTableOutput';
import { downloadOutput } from '../lib/outputDownload';
import { OutputCard } from './OutputCard';
import { OutputRenderer } from './OutputRenderer';

type SharedProps = { variant?: 'panel' | 'modal'; onAddToBoard?: (output: Output, index: number) => void; onInteractiveTableChange?: (nodeId: string, state: InteractiveTableState) => void };

const TabbedOutputCard = memo(function TabbedOutputCard({ outputs, startIndex, variant = 'panel', onAddToBoard }: SharedProps & { outputs: Output[]; startIndex: number }) {
  const [activeLabel, setActiveLabel] = useState(String(outputs[0]?.tab_label || ''));
  const [focused, setFocused] = useState(false);
  const activeOffset = Math.max(0, outputs.findIndex((output) => String(output.tab_label || '') === activeLabel));
  const activeOutput = outputs[activeOffset] || outputs[0];
  if (!activeOutput) return null;
  const activeIndex = startIndex + activeOffset;
  const cardClass = variant === 'modal' ? 'modal-output-card output-card workflow-shell-card' : 'output-card workflow-shell-card';
  const tabs = <div className="output-table-tabs" role="tablist" aria-label="Anomaly classes">{outputs.map((output) => { const label = String(output.tab_label || output.anomaly_class || 'Class'); const active = output === activeOutput; return <button type="button" role="tab" aria-selected={active} className={`output-table-tab ${active ? 'active' : ''}`} onClick={() => setActiveLabel(label)} key={label}>{label}</button>; })}</div>;
  return <>
    <div className={cardClass}><div className="output-head"><b>Detected Anomalies</b><span>{String(activeOutput.kind || 'table')}</span><button title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(activeOutput, activeIndex)}><Download size={13}/></button>{onAddToBoard && <button title="افزودن به Analysis Board" aria-label="افزودن به Analysis Board" onClick={() => onAddToBoard(activeOutput, activeIndex)}><Pin size={13}/></button>}<button title="نمایش کامل" aria-label="نمایش کامل" onClick={() => setFocused(true)}><Maximize2 size={13}/></button></div>{tabs}<div className="output-body"><OutputRenderer output={activeOutput} onAddToBoard={onAddToBoard} eager/></div></div>
    {focused && createPortal(<div className="modal-backdrop workflow-shell-backdrop output-fullscreen-backdrop" onClick={() => setFocused(false)}><div className="modal-card workflow-shell-popup output-fullscreen-card" role="dialog" aria-modal="true" aria-label="Detected Anomalies" onClick={(event) => event.stopPropagation()}><div className="output-fullscreen-head"><h3>Detected Anomalies</h3><div className="output-fullscreen-actions"><button className="tiny-action icon-action" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(activeOutput, activeIndex)}><Download size={13}/></button><button className="modal-close" title="بستن" aria-label="بستن" onClick={() => setFocused(false)}><X size={16}/></button></div></div>{tabs}<div className="output-fullscreen-body"><OutputRenderer output={activeOutput} onAddToBoard={onAddToBoard} fillContainer/></div></div></div>, document.body)}
  </>;
});

export const OutputCards = memo(function OutputCards({ outputs, variant = 'panel', onAddToBoard, onInteractiveTableChange }: SharedProps & { outputs: Output[] }) {
  const groups = useMemo(() => {
    const seen = new Set<string>();
    return outputs.map((output, index) => {
      const group = String(output.tab_group || '').trim();
      if (!group) return { kind: 'single' as const, output, index };
      if (seen.has(group)) return null;
      seen.add(group);
      return { kind: 'group' as const, outputs: outputs.filter((item) => String(item.tab_group || '').trim() === group), index, group };
    }).filter(Boolean);
  }, [outputs]);
  return <>{groups.map((item) => item?.kind === 'single' ? <OutputCard output={item.output} index={item.index} variant={variant} onAddToBoard={onAddToBoard} onInteractiveTableChange={onInteractiveTableChange} key={`${item.output.node_id}-${item.output.path_index}-${item.index}`}/> : item ? <TabbedOutputCard outputs={item.outputs} startIndex={item.index} variant={variant} onAddToBoard={onAddToBoard} key={`tabs-${item.group}-${item.outputs[0]?.node_id}`}/> : null)}</>;
});

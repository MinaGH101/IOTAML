import { Download, Maximize2, Pin, X } from 'lucide-react';
import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Output } from '../../../workspace/_model/output';
import type { InteractiveTableState } from '../../../workspace/_components/output/InteractiveTableOutput';
import { downloadOutput } from '../lib/outputDownload';
import { OutputRenderer } from './OutputRenderer';

function displayTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

type Props = {
  output: Output;
  index: number;
  variant?: 'panel' | 'modal';
  onAddToBoard?: (output: Output, index: number) => void;
  onInteractiveTableChange?: (nodeId: string, state: InteractiveTableState) => void;
};

export const OutputCard = memo(function OutputCard({ output, index, variant = 'panel', onAddToBoard, onInteractiveTableChange }: Props) {
  const [focused, setFocused] = useState(false);
  const title = displayTitle(output, index);
  const cardClass = variant === 'modal' ? 'modal-output-card output-card workflow-shell-card' : 'output-card workflow-shell-card';
  return <>
    <div className={cardClass}>
      <div className="output-head"><b>{title}</b><span>{String(output.kind || 'json')}</span><button title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(output, index)}><Download size={13}/></button>{onAddToBoard && <button title="افزودن به Analysis Board" aria-label="افزودن به Analysis Board" onClick={() => onAddToBoard(output, index)}><Pin size={13}/></button>}<button title="نمایش کامل" aria-label="نمایش کامل" onClick={() => setFocused(true)}><Maximize2 size={13}/></button></div>
      <div className="output-body"><OutputRenderer output={output} onAddToBoard={onAddToBoard} onInteractiveTableChange={onInteractiveTableChange}/></div>
    </div>
    {focused && createPortal(<div className="modal-backdrop workflow-shell-backdrop output-fullscreen-backdrop" onClick={() => setFocused(false)}><div className="modal-card workflow-shell-popup output-fullscreen-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="output-fullscreen-head"><h3>{String(output.title || title || 'نمایش کامل')}</h3><div className="output-fullscreen-actions"><button className="tiny-action icon-action" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(output, index)}><Download size={13}/></button><button className="modal-close" title="بستن" aria-label="بستن" onClick={() => setFocused(false)}><X size={16}/></button></div></div><div className="output-fullscreen-body"><OutputRenderer output={output} onAddToBoard={onAddToBoard} onInteractiveTableChange={onInteractiveTableChange} fillContainer/></div></div></div>, document.body)}
  </>;
});

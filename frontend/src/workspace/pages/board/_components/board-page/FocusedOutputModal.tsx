import { Download, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { downloadOutput, OutputBody } from '../../../../../features/results/components/ResultsPanel';
import type { FocusedOutput } from '../BoardCard';
export function FocusedOutputModal({ focused, onClose }: {
    focused: FocusedOutput | null;
    onClose: () => void;
}) { if (!focused)
    return null; return createPortal(<div className="modal-backdrop workflow-shell-backdrop output-fullscreen-backdrop" onClick={onClose}><div className="modal-card workflow-shell-popup output-fullscreen-card" onClick={(e) => e.stopPropagation()}><div className="output-fullscreen-head"><h3>{focused.title}</h3><div className="output-fullscreen-actions"><button className="tiny-action icon-action" title="دانلود" onClick={() => downloadOutput(focused.output, focused.index)}><Download size={13}/></button><button className="modal-close" title="بستن" onClick={onClose}><X size={16}/></button></div></div><div className="output-fullscreen-body"><OutputBody output={focused.output} fillContainer/></div></div></div>, document.body); }

import type { Output } from '../../../workspace/_model/output';
import { OutputCards } from '../../../workspace/_components/ResultsPanel';
import type { InteractiveTableState } from '../../../workspace/_components/output/InteractiveTableOutput';

export function NodeOutputsPanel({ hasRun, outputs, onAddToBoard, onInteractiveTableChange }: { hasRun: boolean; outputs: Output[]; onAddToBoard?: (output: Output, index: number) => void; onInteractiveTableChange(nodeId: string, state: InteractiveTableState): void }) {
  return <section className="node-modal-section workflow-shell-card n8n-node-panel n8n-io-panel n8n-output-panel"><div className="section-title n8n-panel-title">خروجی</div><div className="n8n-panel-body">{!hasRun && <div className="empty-state n8n-empty-state">داده خروجی وجود ندارد<br/><small>نود را اجرا کنید تا خروجی نمایش داده شود</small></div>}{hasRun && outputs.length === 0 && <div className="empty-state n8n-empty-state">داده خروجی پیدا نشد.</div>}<OutputCards outputs={outputs} variant="modal" onAddToBoard={onAddToBoard} onInteractiveTableChange={onInteractiveTableChange}/></div></section>;
}

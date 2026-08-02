import type { Edge, Node } from '@xyflow/react';
import type { PortDefinition, RegistryNode } from '../../../shared/_types';
import { compatiblePorts } from '../../../workspace/_model/catalog';
import { OutputCards, type Output } from '../../results/components/ResultsPanel';

type InputGroup = {
  edge: Edge;
  sourceNode?: Node;
  sourceDefinition?: RegistryNode;
  sourcePorts: PortDefinition[];
  targetPort?: PortDefinition;
  selectedHandle: string;
  visibleOutputs: Output[];
};

type Props = {
  groups: InputGroup[];
  hasRun: boolean;
  portCompatibility: Record<string, string[]>;
  onInputSourceHandleChange: (edgeId: string, sourceHandle: string) => void;
  onAddOutputToBoard?: (output: Output, index: number) => void;
};

export function NodeInputsPanel({ groups, hasRun, portCompatibility, onInputSourceHandleChange, onAddOutputToBoard }: Props) {
  return (
    <section className="node-modal-section workflow-shell-card n8n-node-panel n8n-io-panel n8n-input-panel">
      <div className="section-title n8n-panel-title">ورودی</div>
      <div className="n8n-panel-body">
        {groups.length === 0 && <div className="empty-state n8n-empty-state">داده ورودی وجود ندارد<br /><small>نود را به یک خروجی قبلی وصل کنید.</small></div>}
        {groups.map(({ edge, sourceNode, sourceDefinition, sourcePorts, targetPort, selectedHandle, visibleOutputs }) => (
          <div className="node-input-source workflow-shell-card" key={edge.id}>
            <div className="node-input-source-head">
              <span><b>{String(sourceNode?.data?.label || sourceDefinition?.label || edge.source)}</b><small>{String(edge.targetHandle || 'input')}</small></span>
              {sourcePorts.length > 1 && <em>انتخاب خروجی ورودی</em>}
            </div>
            {sourcePorts.length > 1 && (
              <div className="node-input-port-radios" role="radiogroup" aria-label={`خروجی ورودی از ${String(sourceNode?.data?.label || edge.source)}`}>
                {sourcePorts.map((port) => {
                  const allowed = compatiblePorts(String(port.type || 'any'), String(targetPort?.type || 'any'), portCompatibility);
                  return (
                    <label className={`node-input-port-radio ${selectedHandle === port.id ? 'active' : ''} ${allowed ? '' : 'disabled'}`} key={port.id}>
                      <input type="radio" name={`input-source-${edge.id}`} value={port.id} checked={selectedHandle === port.id} disabled={!allowed} onChange={() => onInputSourceHandleChange(edge.id, port.id)} />
                      <span><b>{port.name}</b><small>{port.type}{allowed ? '' : ' · ناسازگار با این ورودی'}</small></span>
                    </label>
                  );
                })}
              </div>
            )}
            {!hasRun && <div className="empty-state n8n-empty-state">داده ورودی وجود ندارد<br /><small>نود قبلی را اجرا کنید.</small></div>}
            {hasRun && visibleOutputs.length === 0 && <div className="empty-state n8n-empty-state">برای خروجی انتخاب‌شده داده قابل نمایش پیدا نشد.</div>}
            <OutputCards outputs={visibleOutputs} variant="modal" onAddToBoard={onAddOutputToBoard} />
          </div>
        ))}
      </div>
    </section>
  );
}

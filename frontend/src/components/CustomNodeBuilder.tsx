import { useEffect, useMemo, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import { Code2, FileJson, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import type { CustomNodeDefinition, CustomNodePayload, PortDefinition, RegistryNode } from '../types';

const PORT_TYPES = ['any', 'dataframe', 'json', 'json_items', 'series', 'columns', 'model', 'metrics', 'plot', 'file', 'report', 'artifact', 'artifact_ref', 'text', 'schema', 'trigger', 'stream'];

function uniquePortId(base: string, ports: PortDefinition[]) {
  const normalized = (base || 'input').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^([^A-Za-z])/, 'p_$1') || 'input';
  if (!ports.some((port) => port.id === normalized)) return normalized;
  let index = 2;
  while (ports.some((port) => port.id === `${normalized}_${index}`)) index += 1;
  return `${normalized}_${index}`;
}

function emptyPort(kind: 'input' | 'output', ports: PortDefinition[]): PortDefinition {
  const id = uniquePortId(kind, ports);
  return { id, name: kind === 'input' ? 'Input' : 'Output', type: kind === 'input' ? 'any' : 'json', required: kind === 'input', multiple: false };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

async function readTemplate(file: File): Promise<Record<string, unknown>> {
  if (file.size > 512 * 1024) throw new Error('Template must be smaller than 512 KB.');
  const text = await file.text();
  if (/\.json$/i.test(file.name) || file.type.includes('json')) {
    return { format: 'json', filename: file.name, data: JSON.parse(text) };
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 201);
  if (!lines.length) return { format: 'csv', filename: file.name, columns: [], data: [] };
  const columns = parseCsvLine(lines[0]);
  const data = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? '']));
  });
  return { format: 'csv', filename: file.name, columns, data, truncated: text.split(/\r?\n/).length > 201 };
}

function registryId(node: Node) {
  return String(node.data?.catalogId || node.data?.registryId || '');
}

function PortEditor({ title, ports, onChange, kind }: { title: string; ports: PortDefinition[]; onChange: (ports: PortDefinition[]) => void; kind: 'input' | 'output' }) {
  const update = (index: number, patch: Partial<PortDefinition>) => onChange(ports.map((port, portIndex) => portIndex === index ? { ...port, ...patch } : port));
  return (
    <div className="custom-port-editor">
      <div className="custom-builder-section-head"><b>{title}</b><button className="tiny-action" type="button" onClick={() => onChange([...ports, emptyPort(kind, ports)])}><Plus size={13} /> افزودن پورت</button></div>
      {ports.length === 0 && <div className="empty-state small">هیچ پورتی تعریف نشده است.</div>}
      {ports.map((port, index) => (
        <div className="custom-port-row workflow-shell-card" key={`${port.id}-${index}`}>
          <label>شناسه<input value={port.id} onChange={(event) => update(index, { id: event.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} /></label>
          <label>عنوان<input value={port.name} onChange={(event) => update(index, { name: event.target.value })} /></label>
          <label>نوع<select value={port.type} onChange={(event) => update(index, { type: event.target.value })}>{PORT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="custom-port-check"><input type="checkbox" checked={port.required} onChange={(event) => update(index, { required: event.target.checked })} /> الزامی</label>
          <label className="custom-port-check"><input type="checkbox" checked={port.multiple} onChange={(event) => update(index, { multiple: event.target.checked })} /> چندورودی</label>
          <button className="tiny-action danger custom-port-delete icon-action" type="button" title="حذف پورت" onClick={() => onChange(ports.filter((_, portIndex) => portIndex !== index))}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export function CustomNodeBuilder({ definition, workflowNodes, registry, busy, onSave, onDelete, onClose }: {
  definition: CustomNodeDefinition | null;
  workflowNodes: Node[];
  registry: RegistryNode[];
  busy: boolean;
  onSave: (payload: CustomNodePayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('Custom Python Node');
  const [description, setDescription] = useState('Reusable user node executed in the restricted Python sandbox.');
  const [inputs, setInputs] = useState<PortDefinition[]>([{ id: 'input', name: 'Input', type: 'any', required: true, multiple: false }]);
  const [outputs, setOutputs] = useState<PortDefinition[]>([{ id: 'output', name: 'Output', type: 'json', required: false, multiple: false }]);
  const [code, setCode] = useState('# inputs is keyed by input port id.\n# Return a value or a dict keyed by output port id.\nreturn inputs.get("input")');
  const [template, setTemplate] = useState<Record<string, unknown> | null>(null);
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [sourcePortId, setSourcePortId] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!definition) return;
    setName(definition.name || definition.label);
    setDescription(definition.description || '');
    setInputs(definition.inputs || []);
    setOutputs(definition.outputs || []);
    setCode(definition.code || 'return inputs');
    setTemplate(definition.template || null);
  }, [definition]);

  const sourceDefinition = useMemo(() => {
    const node = workflowNodes.find((item) => item.id === sourceNodeId);
    const id = node ? registryId(node) : '';
    return registry.find((item) => item.id === id) || null;
  }, [sourceNodeId, workflowNodes, registry]);

  useEffect(() => { setSourcePortId(sourceDefinition?.outputs?.[0]?.id || ''); }, [sourceDefinition]);

  const addSourcePort = () => {
    const sourcePort = sourceDefinition?.outputs.find((port) => port.id === sourcePortId) || sourceDefinition?.outputs[0];
    if (!sourcePort) return;
    setInputs((current) => [...current, { ...sourcePort, id: uniquePortId(sourcePort.id || 'input', current), name: `${sourceDefinition?.label || 'Node'} · ${sourcePort.name}`, required: true }]);
  };

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('نام نود الزامی است.');
    if (!code.trim()) return setError('کد Python الزامی است.');
    if (!outputs.length) return setError('حداقل یک خروجی تعریف کنید.');
    const ids = [...inputs, ...outputs].map((port) => port.id);
    if (ids.some((id) => !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id))) return setError('شناسه پورت باید با حرف شروع شود و فقط حروف، عدد، _ یا - داشته باشد.');
    if (new Set(inputs.map((port) => port.id)).size !== inputs.length || new Set(outputs.map((port) => port.id)).size !== outputs.length) return setError('شناسه پورتها باید یکتا باشد.');
    try { await onSave({ name: name.trim(), description: description.trim(), inputs, outputs, code, template }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'ذخیره نود ناموفق بود.'); }
  };

  const upload = async (file: File) => {
    setError('');
    try { setTemplate(await readTemplate(file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'خواندن template ناموفق بود.'); }
  };

  return (
    <div className="node-modal-backdrop custom-node-builder-backdrop" onClick={onClose}>
      <div className="node-modal custom-node-builder" dir="rtl" onClick={(event) => event.stopPropagation()}>
        <header className="custom-node-builder-head">
          <div><span>USER NODE BUILDER</span><h2>{definition ? `ویرایش ${definition.label}` : 'ساخت نود سفارشی'}</h2><p>پورت‌های تایپ‌شده، template تست و اجرای Python sandboxed</p></div>
          <div className="custom-node-builder-actions">
            {definition && onDelete && <button className="danger" type="button" disabled={busy} onClick={() => onDelete().catch((reason) => setError(reason instanceof Error ? reason.message : 'حذف ناموفق بود'))}><Trash2 size={17}/> حذف</button>}
            <button className="primary" type="button" disabled={busy} onClick={submit}><Save size={17}/> ذخیره نود</button>
            <button className="icon-button icon-only" type="button" onClick={onClose}><X size={15} /></button>
          </div>
        </header>

        <div className="custom-node-builder-meta">
          <label>نام نود<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>توضیح<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        {error && <div className="error-box custom-builder-error">{error}</div>}

        <div className="custom-node-builder-grid">
          <section className="custom-node-builder-column">
            <div className="section-title">۱. Inputs</div>
            <div className="custom-builder-column-body">
              <div className="custom-source-picker workflow-shell-card">
                <b>ساخت ورودی از خروجی نودهای Workflow</b>
                <select value={sourceNodeId} onChange={(event) => setSourceNodeId(event.target.value)}><option value="">انتخاب نود...</option>{workflowNodes.map((node) => <option key={node.id} value={node.id}>{String(node.data?.label || node.id)}</option>)}</select>
                <select value={sourcePortId} onChange={(event) => setSourcePortId(event.target.value)} disabled={!sourceDefinition}><option value="">انتخاب خروجی...</option>{sourceDefinition?.outputs.map((port) => <option key={port.id} value={port.id}>{port.name} · {port.type}</option>)}</select>
                <button className="tiny-action" type="button" disabled={!sourceDefinition || !sourcePortId} onClick={addSourcePort}><Plus size={13} /> تبدیل به input port</button>
                <small>اتصال واقعی بعداً با drag کردن نود و وصل‌کردن پورت‌ها انجام می‌شود.</small>
              </div>
              <PortEditor title="Input ports" ports={inputs} onChange={setInputs} kind="input" />
              <div className="custom-template-box workflow-shell-card">
                <b><FileJson size={17}/> Template ورودی</b>
                <span>CSV یا JSON برای تعریف نمونه ورودی و تست کد؛ حداکثر 512KB.</span>
                <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} />
                <button className="tiny-action" type="button" onClick={() => fileRef.current?.click()}><Upload size={13} /> آپلود template</button>
                {template && <div className="custom-template-summary"><code>{String(template.filename || template.format || 'template')}</code><button className="tiny-action icon-action" type="button" onClick={() => setTemplate(null)}><X size={12} /></button></div>}
              </div>
            </div>
          </section>

          <section className="custom-node-builder-column custom-code-column">
            <div className="section-title">۲. Python settings</div>
            <div className="custom-builder-column-body">
              <div className="custom-code-help"><Code2 size={15} /><span><code>inputs</code> یک dict بر اساس شناسه input port است. نتیجه می‌تواند یک مقدار یا dict بر اساس شناسه output port باشد.</span></div>
              <textarea className="custom-code-editor" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} />
              <pre className="custom-code-example">{`# Example\nimport pandas as pd\ndf = pd.DataFrame(inputs["input"])\ndf["total"] = df.select_dtypes("number").sum(axis=1)\nreturn {"output": df}`}</pre>
            </div>
          </section>

          <section className="custom-node-builder-column">
            <div className="section-title">۳. Outputs</div>
            <div className="custom-builder-column-body"><PortEditor title="Output ports" ports={outputs} onChange={setOutputs} kind="output" /><div className="custom-output-note">برای خروجی جدول، نوع <code>dataframe</code> را انتخاب و DataFrame یا آرایه‌ای از objectها برگردانید.</div></div>
          </section>
        </div>
      </div>
    </div>
  );
}

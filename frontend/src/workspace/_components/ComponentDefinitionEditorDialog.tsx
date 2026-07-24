import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Node } from '@xyflow/react';
import { AppDialog } from '../../shared/_components/AppDialog';
import type { ComponentBoundaryPort, ExposedComponentParameter, RegistryNode } from '../../shared/_types';

type Props = {
  open: boolean;
  nodes: Node[];
  registry: RegistryNode[];
  inputs: ComponentBoundaryPort[];
  outputs: ComponentBoundaryPort[];
  exposedParameters: ExposedComponentParameter[];
  onClose: () => void;
  onSave: (value: { inputs: ComponentBoundaryPort[]; outputs: ComponentBoundaryPort[]; exposedParameters: ExposedComponentParameter[] }) => void;
};

function reorder<T>(items: T[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function InterfaceRows({ title, ports, onChange }: { title: string; ports: ComponentBoundaryPort[]; onChange: (ports: ComponentBoundaryPort[]) => void }) {
  return (
    <section className="component-definition-section">
      <header><b>{title}</b><small>{ports.length} پورت عمومی</small></header>
      {ports.map((port, index) => (
        <div className="component-interface-row" key={port.id}>
          <div className="component-interface-order">
            <button type="button" className="workflow-tab-icon-button" disabled={index === 0} onClick={() => onChange(reorder(ports, index, -1))} title="انتقال به بالا"><ArrowUp size={13}/></button>
            <button type="button" className="workflow-tab-icon-button" disabled={index === ports.length - 1} onClick={() => onChange(reorder(ports, index, 1))} title="انتقال به پایین"><ArrowDown size={13}/></button>
          </div>
          <label><span>نام</span><input value={port.name} onChange={(event) => onChange(ports.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label>
          <label><span>نوع</span><select value={port.type} onChange={(event) => onChange(ports.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>{['any', 'dataframe', 'json', 'json_items', 'model', 'metrics', 'plot', 'file', 'report', 'artifact_ref', 'text', 'schema'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="component-interface-required"><input type="checkbox" checked={port.required} onChange={(event) => onChange(ports.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} /> الزامی</label>
          <button type="button" className="workflow-tab-icon-button workflow-version-delete" onClick={() => onChange(ports.filter((_, itemIndex) => itemIndex !== index))} title="پنهان کردن پورت"><Trash2 size={14}/></button>
        </div>
      ))}
      {ports.length === 0 && <div className="empty-state small">هیچ پورت عمومی برای این سمت منتشر نشده است.</div>}
    </section>
  );
}

function safeParameterId(value: string) {
  const normalized = value.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '');
  return /^[A-Za-z]/.test(normalized) ? normalized : `param_${normalized || 'value'}`;
}

export function ComponentDefinitionEditorDialog({ open, nodes, registry, inputs: initialInputs, outputs: initialOutputs, exposedParameters: initialExposed, onClose, onSave }: Props) {
  const [inputs, setInputs] = useState(initialInputs);
  const [outputs, setOutputs] = useState(initialOutputs);
  const [exposed, setExposed] = useState(initialExposed);
  const [nodeId, setNodeId] = useState('');
  const [paramName, setParamName] = useState('');
  const [publicName, setPublicName] = useState('');
  useEffect(() => {
    if (!open) return;
    setInputs(initialInputs);
    setOutputs(initialOutputs);
    setExposed(initialExposed);
    setNodeId(nodes[0]?.id || '');
    setParamName('');
    setPublicName('');
  }, [initialExposed, initialInputs, initialOutputs, nodes, open]);

  const selectedNode = nodes.find((node) => node.id === nodeId) || null;
  const selectedDefinition = registry.find((item) => item.id === String(selectedNode?.data?.registryId || ''));
  const params = selectedDefinition?.settingsSchema || [];
  useEffect(() => {
    if (params.length && !params.some((item) => item.name === paramName)) setParamName(params[0].name);
  }, [paramName, params]);

  const duplicate = useMemo(() => exposed.some((item) => item.internal_node_id === nodeId && item.internal_param === paramName), [exposed, nodeId, paramName]);
  const addParameter = () => {
    const definition = params.find((item) => item.name === paramName);
    if (!definition || !selectedNode || duplicate) return;
    const name = publicName.trim() || definition.label;
    const id = safeParameterId(name || definition.name);
    if (exposed.some((item) => item.id === id)) return;
    const currentParams = (selectedNode.data?.params || {}) as Record<string, unknown>;
    setExposed((items) => [...items, {
      id,
      name,
      description: definition.help || '',
      type: definition.type,
      default: currentParams[definition.name] ?? definition.default,
      required: Boolean(definition.required),
      options: definition.options || [],
      internal_node_id: selectedNode.id,
      internal_param: definition.name,
    }]);
    setPublicName('');
  };

  return (
    <AppDialog open={open} title="رابط عمومی کامپوننت" description="فقط پورت‌ها و پارامترهای منتشرشده در تنظیمات نود کامپوننت دیده می‌شوند." width={920} onClose={onClose} footer={<>
      <button type="button" className="secondary-button" onClick={onClose}>انصراف</button>
      <button type="button" className="primary-button" onClick={() => onSave({ inputs, outputs, exposedParameters: exposed })}>اعمال در نسخه جدید</button>
    </>}>
      <div className="component-definition-grid"><InterfaceRows title="ورودی‌های عمومی" ports={inputs} onChange={setInputs} /><InterfaceRows title="خروجی‌های عمومی" ports={outputs} onChange={setOutputs} /></div>
      <section className="component-definition-section">
        <header><b>پارامترهای عمومی</b><small>{exposed.length} پارامتر منتشرشده</small></header>
        <div className="component-expose-form">
          <label><span>نود داخلی</span><select value={nodeId} onChange={(event) => setNodeId(event.target.value)}>{nodes.map((node) => <option key={node.id} value={node.id}>{String(node.data?.label || node.data?.typeLabel || node.id)}</option>)}</select></label>
          <label><span>پارامتر</span><select value={paramName} onChange={(event) => setParamName(event.target.value)}>{params.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}</select></label>
          <label><span>نام عمومی</span><input value={publicName} onChange={(event) => setPublicName(event.target.value)} placeholder="نام قابل مشاهده برای کاربر" /></label>
          <button type="button" className="primary-button compact" disabled={!paramName || duplicate} onClick={addParameter}><Plus size={14}/> انتشار</button>
        </div>
        <div className="component-exposed-list">
          {exposed.map((item) => (
            <div className="component-exposed-row" key={item.id}><span><b>{item.name}</b><small>{item.internal_node_id} · {item.internal_param} · {item.type}</small></span><button type="button" className="workflow-tab-icon-button workflow-version-delete" onClick={() => setExposed((items) => items.filter((candidate) => candidate.id !== item.id))} title="حذف از رابط عمومی"><Trash2 size={14}/></button></div>
          ))}
          {exposed.length === 0 && <div className="empty-state small">پارامترهای داخلی فعلاً مخفی هستند.</div>}
        </div>
      </section>
    </AppDialog>
  );
}

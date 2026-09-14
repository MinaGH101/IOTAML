import { useEffect, useMemo, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import type { CustomNodeDefinition, CustomNodePayload, PortDefinition, RegistryNode } from '../../../shared/types';
import { readTemplate, registryId, uniquePortId } from './helpers';
export function useCustomNodeBuilder({ definition, workflowNodes, registry, onSave }: {
    definition: CustomNodeDefinition | null;
    workflowNodes: Node[];
    registry: RegistryNode[];
    onSave: (payload: CustomNodePayload) => Promise<void>;
}) { const [name, setName] = useState('Custom Python Node'); const [description, setDescription] = useState('Reusable user node executed in the restricted Python sandbox.'); const [inputs, setInputs] = useState<PortDefinition[]>([{ id: 'input', name: 'Input', type: 'any', required: true, multiple: false }]); const [outputs, setOutputs] = useState<PortDefinition[]>([{ id: 'output', name: 'Output', type: 'json', required: false, multiple: false }]); const [code, setCode] = useState('# inputs is keyed by input port id.\n# Return a value or a dict keyed by output port id.\nreturn inputs.get("input")'); const [template, setTemplate] = useState<Record<string, unknown> | null>(null); const [sourceNodeId, setSourceNodeId] = useState(''); const [sourcePortId, setSourcePortId] = useState(''); const [error, setError] = useState(''); const fileRef = useRef<HTMLInputElement>(null); useEffect(() => { if (!definition)
    return; setName(definition.name || definition.label); setDescription(definition.description || ''); setInputs(definition.inputs || []); setOutputs(definition.outputs || []); setCode(definition.code || 'return inputs'); setTemplate(definition.template || null); }, [definition]); const sourceDefinition = useMemo(() => { const node = workflowNodes.find((item) => item.id === sourceNodeId); return registry.find((item) => item.id === (node ? registryId(node) : '')) || null; }, [registry, sourceNodeId, workflowNodes]); useEffect(() => setSourcePortId(sourceDefinition?.outputs?.[0]?.id || ''), [sourceDefinition]); const addSourcePort = () => { const port = sourceDefinition?.outputs.find((p) => p.id === sourcePortId) || sourceDefinition?.outputs[0]; if (!port)
    return; setInputs((current) => [...current, { ...port, id: uniquePortId(port.id || 'input', current), name: `${sourceDefinition?.label || 'Node'} · ${port.name}`, required: true }]); }; const submit = async () => { setError(''); if (!name.trim())
    return setError('نام نود الزامی است.'); if (!code.trim())
    return setError('کد Python الزامی است.'); if (!outputs.length)
    return setError('حداقل یک خروجی تعریف کنید.'); const ids = [...inputs, ...outputs].map((p) => p.id); if (ids.some((id) => !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)))
    return setError('شناسه پورت باید با حرف شروع شود و فقط حروف، عدد، _ یا - داشته باشد.'); if (new Set(inputs.map((p) => p.id)).size !== inputs.length || new Set(outputs.map((p) => p.id)).size !== outputs.length)
    return setError('شناسه پورتها باید یکتا باشد.'); try {
    await onSave({ name: name.trim(), description: description.trim(), inputs, outputs, code, template });
}
catch (e) {
    setError(e instanceof Error ? e.message : 'ذخیره نود ناموفق بود.');
} }; const upload = async (file: File) => { setError(''); try {
    setTemplate(await readTemplate(file));
}
catch (e) {
    setError(e instanceof Error ? e.message : 'خواندن template ناموفق بود.');
} }; return { name, setName, description, setDescription, inputs, setInputs, outputs, setOutputs, code, setCode, template, setTemplate, sourceNodeId, setSourceNodeId, sourcePortId, setSourcePortId, error, setError, fileRef, sourceDefinition, addSourcePort, submit, upload }; }

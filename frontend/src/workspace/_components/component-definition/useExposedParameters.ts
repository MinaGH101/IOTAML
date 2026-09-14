import { useEffect, useMemo, useState } from 'react';
import type { Node } from '@xyflow/react';
import type { ExposedComponentParameter, RegistryNode } from '../../../shared/types';
function safeParameterId(value: string) { const normalized = value.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, ''); return /^[A-Za-z]/.test(normalized) ? normalized : `param_${normalized || 'value'}`; }
export function useExposedParameters(open: boolean, nodes: Node[], registry: RegistryNode[], initial: ExposedComponentParameter[]) { const [exposed, setExposed] = useState(initial); const [nodeId, setNodeId] = useState(''); const [paramName, setParamName] = useState(''); const [publicName, setPublicName] = useState(''); useEffect(() => { if (open) {
    setExposed(initial);
    setNodeId(nodes[0]?.id || '');
    setParamName('');
    setPublicName('');
} }, [initial, nodes, open]); const node = nodes.find((n) => n.id === nodeId) || null; const definition = registry.find((item) => item.id === String(node?.data?.registryId || '')); const params = definition?.settingsSchema || []; useEffect(() => { if (params.length && !params.some((item) => item.name === paramName))
    setParamName(params[0].name); }, [paramName, params]); const duplicate = useMemo(() => exposed.some((item) => item.internal_node_id === nodeId && item.internal_param === paramName), [exposed, nodeId, paramName]); const add = () => { const d = params.find((item) => item.name === paramName); if (!d || !node || duplicate)
    return; const name = publicName.trim() || d.label; const id = safeParameterId(name || d.name); if (exposed.some((item) => item.id === id))
    return; const current = (node.data?.params || {}) as Record<string, unknown>; setExposed((items) => [...items, { id, name, description: d.help || '', type: d.type, default: current[d.name] ?? d.default, required: Boolean(d.required), options: d.options || [], internal_node_id: node.id, internal_param: d.name }]); setPublicName(''); }; return { exposed, setExposed, nodeId, setNodeId, paramName, setParamName, publicName, setPublicName, params, duplicate, add }; }

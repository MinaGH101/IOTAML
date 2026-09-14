import { useEffect, useState } from 'react';
import type { Node } from '@xyflow/react';
import { Dialog as AppDialog } from '../../shared/ui';
import type { ComponentBoundaryPort, ExposedComponentParameter, RegistryNode } from '../../shared/types';
import { ExposedParameters } from './component-definition/ExposedParameters';
import { InterfaceRows } from './component-definition/InterfaceRows';
import { useExposedParameters } from './component-definition/useExposedParameters';
type Props = {
    open: boolean;
    nodes: Node[];
    registry: RegistryNode[];
    inputs: ComponentBoundaryPort[];
    outputs: ComponentBoundaryPort[];
    exposedParameters: ExposedComponentParameter[];
    onClose: () => void;
    onSave: (value: {
        inputs: ComponentBoundaryPort[];
        outputs: ComponentBoundaryPort[];
        exposedParameters: ExposedComponentParameter[];
    }) => void;
};
export function ComponentDefinitionEditorDialog(p: Props) { const [inputs, setInputs] = useState(p.inputs); const [outputs, setOutputs] = useState(p.outputs); const exposed = useExposedParameters(p.open, p.nodes, p.registry, p.exposedParameters); useEffect(() => { if (p.open) {
    setInputs(p.inputs);
    setOutputs(p.outputs);
} }, [p.inputs, p.open, p.outputs]); return <AppDialog open={p.open} title="رابط عمومی کامپوننت" description="فقط پورت‌ها و پارامترهای منتشرشده در تنظیمات نود کامپوننت دیده می‌شوند." width={920} onClose={p.onClose} footer={<><button type="button" className="secondary-button" onClick={p.onClose}>انصراف</button><button type="button" className="primary-button" onClick={() => p.onSave({ inputs, outputs, exposedParameters: exposed.exposed })}>اعمال در نسخه جدید</button></>}><div className="component-definition-grid"><InterfaceRows title="ورودی‌های عمومی" ports={inputs} onChange={setInputs}/><InterfaceRows title="خروجی‌های عمومی" ports={outputs} onChange={setOutputs}/></div><ExposedParameters nodes={p.nodes} m={exposed}/></AppDialog>; }

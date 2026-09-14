import { memo } from 'react';
import type { Output } from '../../_model/output';
import type { InteractiveTableState } from '../../_model/interactiveTableState';
import { InteractiveTableGrid } from './interactive-table/InteractiveTableGrid';
import { InteractiveTableToolbar } from './interactive-table/InteractiveTableToolbar';
import { useInteractiveTableOutput } from './interactive-table/useInteractiveTableOutput';
export type { InteractiveTableState } from '../../_model/interactiveTableState';
export const InteractiveTableOutput = memo(function InteractiveTableOutput({ output, onStateChange }: {
    output: Output;
    onStateChange?: (state: InteractiveTableState) => void;
}) { const m = useInteractiveTableOutput(output, onStateChange); return <div className="interactive-table" dir="ltr"><InteractiveTableToolbar m={m}/><InteractiveTableGrid m={m} output={output}/></div>; });

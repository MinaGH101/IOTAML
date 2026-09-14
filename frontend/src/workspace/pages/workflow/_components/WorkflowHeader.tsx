import { memo } from 'react';
import { HeaderCenter } from './workflow-header/HeaderCenter';
import { HeaderLeft } from './workflow-header/HeaderLeft';
import { HeaderRight } from './workflow-header/HeaderRight';
import type { WorkflowHeaderProps } from './workflow-header/types';
export { ComponentEditorBanner } from './workflow-header/ComponentEditorBanner';
export const WorkflowHeader = memo(function WorkflowHeader(p: WorkflowHeaderProps) { return <header className="topbar workflow-topbar workflow-topbar-pro" dir="ltr" style={p.floatingTopbarStyle}><HeaderLeft p={p}/><HeaderCenter p={p}/><HeaderRight p={p}/></header>; });

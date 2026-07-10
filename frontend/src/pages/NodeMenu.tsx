import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NodePalette } from '../components/NodePalette';
import type { RegistryNode } from '../types';

type NodeMenuProps = {
  registry: RegistryNode[];
  paletteCollapsed: boolean;
  setPaletteCollapsed: Dispatch<SetStateAction<boolean>>;
  floatingLeftStyle: CSSProperties;
  onCreateCustomNode: () => void;
  onEditCustomNode: (node: RegistryNode) => void;
};

export function NodeMenu({ registry, paletteCollapsed, setPaletteCollapsed, floatingLeftStyle, onCreateCustomNode, onEditCustomNode }: NodeMenuProps) {
  return (
    <div className={`left-stack ${paletteCollapsed ? 'left-stack-collapsed' : ''}`} style={floatingLeftStyle}>
      <button
        className="workflow-float-toggle workflow-float-toggle-left"
        type="button"
        onClick={() => setPaletteCollapsed((value) => !value)}
        title={paletteCollapsed ? 'باز کردن منوی چپ' : 'بستن منوی چپ'}
        aria-label={paletteCollapsed ? 'باز کردن منوی چپ' : 'بستن منوی چپ'}
        style={{
          top: paletteCollapsed ? '10px' : '12px',
          left: paletteCollapsed ? 'calc(100% + 8px)' : '12px',
          right: 'auto',
          zIndex: 7000
        }}
      >
        {paletteCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      <NodePalette
        nodes={registry}
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed((value) => !value)}
        onCreateCustomNode={onCreateCustomNode}
        onEditCustomNode={onEditCustomNode}
      />
    </div>
  );
}

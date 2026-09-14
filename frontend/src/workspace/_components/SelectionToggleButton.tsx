import { CheckSquare } from 'lucide-react';
export function SelectionToggleButton({ items, selected, onChange, subject = '', }: {
    items: string[];
    selected: string[];
    onChange: (items: string[]) => void;
    subject?: string;
}) {
    const allSelected = items.length > 0
        && items.every((item) => selected.includes(item));
    const suffix = subject ? ` ${subject}` : '';
    const text = allSelected
        ? `لغو انتخاب همه${suffix}`
        : `انتخاب همه${suffix}`;
    return (<button type="button" className={`tiny-action selection-toggle ${allSelected ? 'active' : ''}`} title={text} aria-label={text} disabled={!items.length} onClick={() => onChange(allSelected ? [] : [...items])}>
      <CheckSquare size={12}/>
      {text}
    </button>);
}

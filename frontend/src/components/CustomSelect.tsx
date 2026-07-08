import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
};

export function CustomSelect({ value, options, onChange, ariaLabel, placeholder = 'انتخاب کنید', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <div className={`iota-select ${open ? 'open' : ''} ${className}`} ref={ref}>
      <button
        type="button"
        className="iota-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="iota-select-menu" id={menuId} role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'selected' : ''}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

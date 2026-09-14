import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssignableUser } from '../../../shared/types';
import { Input } from '../../../shared/ui';
import { roleLabel, type AssignmentMode } from './constants';

type Props = { mode: AssignmentMode; users: AssignableUser[]; selectedIds: number[]; onChange: (ids: number[]) => void };

export function AssignmentPicker({ mode, users, selectedIds, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUsers = useMemo(() => users.filter((user) => selectedSet.has(user.id)), [selectedSet, users]);
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa');
    return normalized ? users.filter((user) => `${user.display_name} ${user.username} ${roleLabel(user.role)}`.toLocaleLowerCase('fa').includes(normalized)) : users;
  }, [query, users]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = (userId: number) => {
    if (mode === 'edit') { onChange([userId]); setOpen(false); return; }
    onChange(selectedSet.has(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId]);
  };

  return <div className={`assignment-picker ${open ? 'is-open' : ''}`} ref={rootRef}>
    <button className="assignment-picker-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className={selectedUsers.length ? '' : 'is-placeholder'}>{pickerLabel(mode, selectedUsers)}</span><ChevronDown size={16} />
    </button>
    {mode === 'view' && selectedUsers.length > 0 && <div className="assignment-selected-chips">{selectedUsers.map((user) => <button key={user.id} type="button" onClick={() => toggle(user.id)}>{user.display_name}<X size={12} /></button>)}</div>}
    {open && <div className="assignment-picker-menu">
      <div className="assignment-picker-search"><Search size={14} /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام یا نقش..." /></div>
      <div className="assignment-picker-options">{filteredUsers.map((user) => <PickerOption key={user.id} user={user} selected={selectedSet.has(user.id)} onSelect={() => toggle(user.id)} />)}{filteredUsers.length === 0 && <div className="assignment-picker-empty">کاربری پیدا نشد.</div>}</div>
    </div>}
  </div>;
}

function pickerLabel(mode: AssignmentMode, users: AssignableUser[]) {
  if (!users.length) return mode === 'view' ? 'انتخاب کاربران برای مشاهده' : 'انتخاب کاربر ویرایشگر';
  return mode === 'view' ? `${users.length.toLocaleString('fa-IR')} کاربر انتخاب شده` : users[0].display_name;
}

function PickerOption({ user, selected, onSelect }: { user: AssignableUser; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`assignment-picker-option ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
    <span className="assignment-picker-check">{selected && <Check size={14} />}</span>
    <span className="assignment-picker-person"><b>{user.display_name}</b><small>{user.username} · {roleLabel(user.role)}</small></span>
  </button>;
}

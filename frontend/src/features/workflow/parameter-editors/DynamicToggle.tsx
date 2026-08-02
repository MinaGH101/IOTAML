import { Wand2 } from 'lucide-react';

export function DynamicToggle({ enabled, active, onMode }: { enabled: boolean; active: boolean; onMode: (dynamic: boolean) => void }) {
  if (!enabled) return null;
  return (
    <div className="dynamic-toggle workflow-shell-card" dir="ltr">
      <button type="button" className={!active ? 'active' : ''} onClick={() => onMode(false)}>Static</button>
      <button type="button" className={active ? 'active' : ''} onClick={() => onMode(true)}><Wand2 size={11} /> Dynamic</button>
    </div>
  );
}

import { ANALYSIS_BOARD_ZOOM_MAX, ANALYSIS_BOARD_ZOOM_MIN, ANALYSIS_BOARD_ZOOM_STEP } from '../../../_model/board';

export const ZOOM_MIN = ANALYSIS_BOARD_ZOOM_MIN;
export const ZOOM_MAX = ANALYSIS_BOARD_ZOOM_MAX;
export const ZOOM_STEP = ANALYSIS_BOARD_ZOOM_STEP;

export function ZoomControls({ value, onChange, label, compact = false, disabled = false }: {
    value: number;
    onChange: (value: number) => void;
    label: string;
    compact?: boolean;
    disabled?: boolean;
}) {
    const percent = Math.round(value * 100);
    const changeBy = (direction: -1 | 1) => {
        const next = Math.max(ZOOM_MIN * 100, Math.min(ZOOM_MAX * 100, percent + direction * ZOOM_STEP * 100));
        onChange(next / 100);
    };

    return <div className={`analysis-board-zoom ${compact ? 'compact' : ''}`} role="group" aria-label={label} dir="ltr" onPointerDown={(event) => event.stopPropagation()}>
      <button className="analysis-board-zoom-step" type="button" onClick={() => changeBy(-1)} disabled={disabled || percent <= ZOOM_MIN * 100} aria-label={`${label}: کوچک‌تر کردن`}>−</button>
      <button className="analysis-board-zoom-value" type="button" onClick={() => onChange(1)} disabled={disabled} title="بازنشانی به ۱۰۰٪" aria-label={`${label}: ${percent} درصد، بازنشانی به ۱۰۰ درصد`}><span>{percent}%</span></button>
      <button className="analysis-board-zoom-step" type="button" onClick={() => changeBy(1)} disabled={disabled || percent >= ZOOM_MAX * 100} aria-label={`${label}: بزرگ‌تر کردن`}>+</button>
    </div>;
}

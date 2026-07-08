import type { Edge, Node } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';
import { Pin, PinOff, Play, RefreshCw, X } from 'lucide-react';
import type { Dataset, RegistryNode, Run } from '../types';
import { categoryClassName, categoryLabel, nodeIcon } from './NodePalette';
import { ParamEditor } from './ParamEditor';
import { OutputCard, normalizeOutputs } from './ResultsPanel';

type Props = {
  node: Node;
  edges: Edge[];
  registry: RegistryNode[];
  datasets: Dataset[];
  availableColumns: string[];
  run: Run | null;
  busy: boolean;
  onRunNode: () => void;
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
  onRename: (nodeId: string, label: string) => void;
  onPinnedChange: (nodeId: string, pinned: { enabled?: boolean; sample?: string }) => void;
  onClose: () => void;
};

type ColumnKey = 'output' | 'settings' | 'input';
type ColumnWidths = Record<ColumnKey, number>;

const PARAM_TRANSLATIONS: Record<string, string> = {
  'Feature columns': 'ستون‌های ویژگی',
  'Features columns': 'ستون‌های ویژگی',
  'Feature column': 'ستون ویژگی',
  'Target column': 'ستون هدف',
  'Target': 'هدف',
  'Exclude columns': 'ستون‌های حذف‌شده',
  'Excluded columns': 'ستون‌های حذف‌شده',
  'Columns to exclude': 'ستون‌هایی که حذف شوند',
  'Columns': 'ستون‌ها',
  'Column': 'ستون',
  'Dataset': 'دیتاست',
  'Rows': 'ردیف‌ها',
  'Limit': 'محدودیت تعداد',
  'Test size': 'اندازه داده تست',
  'Random state': 'مقدار تصادفی ثابت',
  'Model': 'مدل',
  'Metric': 'معیار',
  'Color': 'رنگ',
  'Title': 'عنوان',
  'X axis': 'محور X',
  'Y axis': 'محور Y',
  'Minimum': 'کمینه',
  'Maximum': 'بیشینه',
  'Normalize': 'نرمال‌سازی',
  'Strategy': 'روش',
  'Method': 'روش',
  'Value': 'مقدار',
  'Find': 'جستجو',
  'Replace': 'جایگزینی',
  'Code': 'کد',
  'Python code': 'کد پایتون',
  'Input': 'ورودی',
  'Output': 'خروجی',
  'Name': 'نام',
  'Description': 'توضیحات',
  'Ascending': 'صعودی',
  'Descending': 'نزولی',
  'True': 'بله',
  'False': 'خیر',
};

function translateParamText(value: string) {
  const normalized = value.trim();
  if (PARAM_TRANSLATIONS[normalized]) return PARAM_TRANSLATIONS[normalized];

  return value
    .replace(/Feature columns/g, 'ستون‌های ویژگی')
    .replace(/Exclude columns/g, 'ستون‌های حذف‌شده')
    .replace(/Target column/g, 'ستون هدف')
    .replace(/Columns/g, 'ستون‌ها')
    .replace(/Column/g, 'ستون')
    .replace(/Dataset/g, 'دیتاست')
    .replace(/Python code/g, 'کد پایتون')
    .replace(/Random state/g, 'مقدار تصادفی ثابت')
    .replace(/Test size/g, 'اندازه داده تست');
}

function translateRegistryLabels<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => translateRegistryLabels(item)) as T;
  if (!value || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const shouldTranslate = ['label', 'title', 'description', 'help', 'helperText', 'placeholder', 'displayName'].includes(key);
    result[key] = typeof raw === 'string' && shouldTranslate ? translateParamText(raw) : translateRegistryLabels(raw);
  }
  return result as T;
}

export function NodeModal({ node, edges, registry, datasets, availableColumns, run, busy, onRunNode, onParamsChange, onRename, onPinnedChange, onClose }: Props) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState<ColumnWidths>({ output: 32, settings: 36, input: 32 });

  const incoming = edges.filter((edge) => edge.target === node.id);
  const inputOutputs = incoming.flatMap((edge) => normalizeOutputs(run, edge.source));
  const currentOutputs = normalizeOutputs(run, node.id);
  const pinned = (node.data.pinned || {}) as { enabled?: boolean; sample?: string };
  const updatePinned = (next: Partial<{ enabled: boolean; sample: string }>) => onPinnedChange(node.id, { ...pinned, ...next });
  const typeLabel = String(node.data.typeLabel || node.data.label || '');
  const category = String(node.data.category || 'Data Input');
  const translatedRegistry = useMemo(() => translateRegistryLabels(registry), [registry]);

  const beginResize = (leftKey: ColumnKey, rightKey: ColumnKey, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const grid = gridRef.current;
    if (!grid) return;

    const startX = event.clientX;
    const totalWidth = grid.getBoundingClientRect().width;
    const startLeft = (columns[leftKey] / 100) * totalWidth;
    const startRight = (columns[rightKey] / 100) * totalWidth;
    const minWidth = Math.min(320, totalWidth * 0.22);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextLeft = Math.max(minWidth, startLeft + delta);
      const nextRight = Math.max(minWidth, startRight - delta);
      const locked = totalWidth - startLeft - startRight;
      const scale = (totalWidth - locked) / (nextLeft + nextRight);

      setColumns((current) => ({
        ...current,
        [leftKey]: ((nextLeft * scale) / totalWidth) * 100,
        [rightKey]: ((nextRight * scale) / totalWidth) * 100,
      }));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('n8n-resizing-columns');
    };

    document.body.classList.add('n8n-resizing-columns');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="node-modal-backdrop workflow-shell-backdrop n8n-node-backdrop" onClick={onClose}>
      <div className={`node-modal workflow-shell-popup n8n-node-modal ${categoryClassName(category)}`} onClick={(event) => event.stopPropagation()}>
        <header className="node-modal-header workflow-shell-header n8n-node-modal-header">
          <div className="node-modal-actions n8n-node-modal-actions n8n-node-left-actions">
            <button className="n8n-execute-icon" type="button" disabled={busy} onClick={onRunNode} title="اجرای نود" aria-label="اجرای نود">
              {busy ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            </button>
            <button className="modal-close" type="button" aria-label="بستن" title="بستن" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="n8n-node-title-block n8n-node-title-block-right">
            <span className="node-modal-kicker n8n-node-kicker">
              <i>{nodeIcon({ id: String(node.data.registryId || ''), label: typeLabel, description: String(node.data.description || ''), category } as any, 14)}</i>
              {categoryLabel(category)} · {typeLabel}
            </span>
            <input className="node-modal-name n8n-node-name" dir="ltr" value={String(node.data.label || '')} aria-label="نام نود" onChange={(event) => onRename(node.id, event.target.value)} />
          </div>
        </header>

        <div
          ref={gridRef}
          className="node-modal-grid n8n-node-grid n8n-node-grid-resizable"
          style={{ '--output-fr': `${columns.output}fr`, '--settings-fr': `${columns.settings}fr`, '--input-fr': `${columns.input}fr` } as React.CSSProperties}
        >
          <section className="node-modal-section workflow-shell-card n8n-node-panel n8n-io-panel n8n-output-panel">
            <div className="section-title n8n-panel-title">خروجی</div>
            <div className="n8n-panel-body">
              {!run && <div className="empty-state n8n-empty-state">داده خروجی وجود ندارد<br /><small>نود را اجرا کنید تا خروجی نمایش داده شود</small></div>}
              {run && currentOutputs.length === 0 && <div className="empty-state n8n-empty-state">داده خروجی پیدا نشد.</div>}
              {currentOutputs.map((output, index) => (
                <OutputCard output={output} index={index} variant="modal" key={`result-${index}-${output.node_id}-${output.path_index}`} />
              ))}
            </div>
          </section>

          <div className="n8n-column-resizer" role="separator" aria-label="تغییر عرض خروجی و تنظیمات" onPointerDown={(event) => beginResize('output', 'settings', event)} />

          <section className="node-modal-section settings-section workflow-shell-card n8n-node-panel n8n-params-panel">
            <div className="section-title n8n-panel-title n8n-settings-title">پارامترها</div>
            <div className="n8n-panel-body n8n-params-body">
              <ParamEditor selectedNode={node} registry={translatedRegistry} datasets={datasets} availableColumns={availableColumns} onParamsChange={onParamsChange} onRename={onRename} />
              <div className="pinned-data-box workflow-shell-card n8n-pinned-box">
                <div className="pinned-data-head">
                  <div><b>داده نمونه ثابت‌شده</b><span>برای تست مرحله‌های بعدی، خروجی نمونه این نود را ثابت نگه دارید.</span></div>
                  <button type="button" className={pinned.enabled ? 'primary icon-only' : 'icon-button'} onClick={() => updatePinned({ enabled: !pinned.enabled })} title="فعال/غیرفعال کردن داده ثابت" aria-label="داده ثابت">
                    {pinned.enabled ? <Pin size={13} /> : <PinOff size={13} />}
                  </button>
                </div>
                <textarea dir="ltr" value={pinned.sample || ''} onChange={(event) => updatePinned({ sample: event.target.value })} placeholder={'[{"column": "value"}] یا {"kind":"metrics","metrics":{"accuracy":0.91}}'} />
                <small>اگر JSON آرایه‌ای وارد کنید، به عنوان جدول استفاده می‌شود. این داده داخل workflow ذخیره می‌شود.</small>
              </div>
            </div>
          </section>

          <div className="n8n-column-resizer" role="separator" aria-label="تغییر عرض تنظیمات و ورودی" onPointerDown={(event) => beginResize('settings', 'input', event)} />

          <section className="node-modal-section workflow-shell-card n8n-node-panel n8n-io-panel n8n-input-panel">
            <div className="section-title n8n-panel-title">ورودی</div>
            <div className="n8n-panel-body">
              {incoming.length === 0 && <div className="empty-state n8n-empty-state">داده ورودی وجود ندارد<br /><small>نودهای قبلی را اجرا کنید تا داده ورودی نمایش داده شود</small></div>}
              {incoming.length > 0 && !run && <div className="empty-state n8n-empty-state">داده ورودی وجود ندارد<br /><small>نودهای قبلی را اجرا کنید تا داده ورودی نمایش داده شود</small></div>}
              {incoming.length > 0 && run && inputOutputs.length === 0 && <div className="empty-state n8n-empty-state">داده ورودی پیدا نشد.</div>}
              {inputOutputs.map((output, index) => (
                <OutputCard output={output} index={index} variant="modal" key={`input-${index}-${output.node_id}-${output.path_index}`} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

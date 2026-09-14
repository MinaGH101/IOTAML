import type { Node } from "@xyflow/react";
import { Pin, PinOff } from "lucide-react";
import type { Dataset, RegistryNode } from "../../../shared/_types";
import type { SelectOption } from "../../../shared/_components/CustomSelect";
import { ParamEditor } from "../../../workspace/_components/ParamEditor";

export function NodeSettingsPanel({
  node,
  registry,
  aliases,
  datasets,
  availableColumns,
  availableIdColumns,
  inheritedIdColumn,
  availableRows,
  inputDataframes,
  pinned,
  onParamsChange,
  onRename,
  onPinnedChange,
}: {
  node: Node;
  registry: RegistryNode[];
  aliases: Record<string, string>;
  datasets: Dataset[];
  availableColumns: string[];
  availableIdColumns: string[];
  inheritedIdColumn: string | null;
  availableRows: Record<string, unknown>[];
  inputDataframes: SelectOption[];
  pinned: { enabled?: boolean; sample?: string };
  onParamsChange(nodeId: string, params: Record<string, unknown>): void;
  onRename(nodeId: string, label: string): void;
  onPinnedChange(next: { enabled?: boolean; sample?: string }): void;
}) {
  return (
    <section className="node-modal-section settings-section workflow-shell-card n8n-node-panel n8n-params-panel">
      <div className="section-title n8n-panel-title n8n-settings-title">
        پارامترها
      </div>
      <div className="n8n-panel-body n8n-params-body">
        <ParamEditor
          selectedNode={node}
          registry={registry}
          aliases={aliases}
          datasets={datasets}
          availableColumns={availableColumns}
          availableIdColumns={availableIdColumns}
          inheritedIdColumn={inheritedIdColumn}
          availableRows={availableRows}
          inputDataframes={inputDataframes}
          onParamsChange={onParamsChange}
          onRename={onRename}
        />
        {/* <div className="pinned-data-box workflow-shell-card n8n-pinned-box">
          <div className="pinned-data-head">
            <div>
              <b>داده نمونه ثابت‌شده</b>
              <span>
                برای تست مرحله‌های بعدی، خروجی نمونه این نود را ثابت نگه دارید.
              </span>
            </div>
            <button
              type="button"
              className={
                pinned.enabled ? "primary icon-only" : "icon-button icon-only"
              }
              onClick={() => onPinnedChange({ enabled: !pinned.enabled })}
              title="فعال/غیرفعال کردن داده ثابت"
              aria-label="داده ثابت"
            >
              {pinned.enabled ? <Pin size={13} /> : <PinOff size={13} />}
            </button>
          </div>
          <textarea
            dir="ltr"
            value={pinned.sample || ""}
            onChange={(event) => onPinnedChange({ sample: event.target.value })}
            placeholder={
              '[{"column": "value"}] یا {"kind":"metrics","metrics":{"accuracy":0.91}}'
            }
          />
          <small>
            اگر JSON آرایه‌ای وارد کنید، به عنوان جدول استفاده می‌شود. این داده
            داخل workflow ذخیره می‌شود.
          </small>
        </div> */}
      </div>
    </section>
  );
}

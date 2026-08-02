import {
  memo,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react';

type Row = Record<string, unknown>;
type SortDirection = 'asc' | 'desc';

type SortState = {
  field: string;
  direction: SortDirection;
} | null;

const PAGE_SIZES = [5, 10, 12, 25, 50, 100] as const;

function formatCell(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('fa-IR')
      : value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (value === null || value === undefined) return '-';
  return String(value);
}

function initialPageSize(rowCount: number) {
  if (rowCount <= 5) return 5;
  if (rowCount <= 10) return 10;
  if (rowCount <= 12) return 12;
  return 25;
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function nextSort(current: SortState, field: string): SortState {
  if (!current || current.field !== field) return { field, direction: 'asc' };
  if (current.direction === 'asc') return { field, direction: 'desc' };
  return null;
}

function SortIcon({
  sort,
  field,
}: {
  sort: SortState;
  field: string;
}) {
  if (sort?.field !== field) return <ChevronsUpDown size={12} />;
  return sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

export const OutputTable = memo(function OutputTable({
  rows,
  columns,
  columnLabels,
}: {
  rows: Row[];
  columns?: string[];
  columnLabels?: Record<string, string>;
}) {
  const resolvedColumns = useMemo(
    () => columns?.length ? columns : Object.keys(rows[0] || {}),
    [columns, rows],
  );
  const [pageSize, setPageSize] = useState(() => initialPageSize(rows.length));
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>(null);

  const orderedRows = useMemo(() => {
    if (!sort) return rows;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (left, right) => compareValues(left[sort.field], right[sort.field]) * direction,
    );
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(orderedRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleRows = useMemo(
    () => orderedRows.slice(pageStart, pageStart + pageSize),
    [orderedRows, pageSize, pageStart],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  if (!resolvedColumns.length) {
    return <div className="empty-state small">جدولی برای نمایش وجود ندارد.</div>;
  }

  return (
    <div className="output-table" dir="ltr">
      <div className="output-table-scroll">
        <table>
          <thead>
            <tr>
              {resolvedColumns.map((field) => (
                <th key={field}>
                  <button
                    type="button"
                    onClick={() => {
                      setSort((current) => nextSort(current, field));
                      setPage(0);
                    }}
                    title={`Sort by ${columnLabels?.[field] || field}`}
                  >
                    <span>{columnLabels?.[field] || field}</span>
                    <SortIcon sort={sort} field={field} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={pageStart + rowIndex}>
                {resolvedColumns.map((field) => (
                  <td key={field} title={formatCell(row[field])}>
                    {formatCell(row[field])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="output-table-footer">
        <span>
          {rows.length
            ? `${(pageStart + 1).toLocaleString('fa-IR')}–${Math.min(pageStart + pageSize, rows.length).toLocaleString('fa-IR')} از ${rows.length.toLocaleString('fa-IR')}`
            : '۰ ردیف'}
        </span>
        <label>
          <span>ردیف در صفحه</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="icon-action"
          disabled={safePage === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className="icon-action"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          title="Next page"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
});

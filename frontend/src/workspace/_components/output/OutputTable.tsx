import { memo } from 'react';
import { OutputTableFooter } from './output-table/OutputTableFooter';
import { OutputTableGrid } from './output-table/OutputTableGrid';
import type { Row } from './output-table/model';
import { useOutputTable } from './output-table/useOutputTable';
export const OutputTable = memo(function OutputTable({ rows, columns, columnLabels }: {
    rows: Row[];
    columns?: string[];
    columnLabels?: Record<string, string>;
}) { const m = useOutputTable(rows, columns); if (!m.resolvedColumns.length)
    return <div className="empty-state small">جدولی برای نمایش وجود ندارد.</div>; return <div className="output-table" dir="ltr"><OutputTableGrid rows={m.visibleRows} columns={m.resolvedColumns} labels={columnLabels} sort={m.sort} sortBy={m.sortBy} start={m.pageStart}/><OutputTableFooter rowCount={rows.length} pageSize={m.pageSize} setPageSize={m.setPageSize} setPage={m.setPage} safePage={m.safePage} pageCount={m.pageCount} pageStart={m.pageStart}/></div>; });

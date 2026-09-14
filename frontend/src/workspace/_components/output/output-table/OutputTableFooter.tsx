import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES } from './model';
export function OutputTableFooter({ rowCount, pageSize, setPageSize, setPage, safePage, pageCount, pageStart }: {
    rowCount: number;
    pageSize: number;
    setPageSize: (n: number) => void;
    setPage: (u: (n: number) => number) => void;
    safePage: number;
    pageCount: number;
    pageStart: number;
}) { return <footer className="output-table-footer"><span>{rowCount ? `${(pageStart + 1).toLocaleString('fa-IR')}–${Math.min(pageStart + pageSize, rowCount).toLocaleString('fa-IR')} از ${rowCount.toLocaleString('fa-IR')}` : '۰ ردیف'}</span><label><span>ردیف در صفحه</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(() => 0); }}>{PAGE_SIZES.map((v) => <option value={v} key={v}>{v}</option>)}</select></label><button type="button" className="icon-action" disabled={safePage === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}><ChevronLeft size={14}/></button><button type="button" className="icon-action" disabled={safePage >= pageCount - 1} onClick={() => setPage((v) => Math.min(pageCount - 1, v + 1))}><ChevronRight size={14}/></button></footer>; }

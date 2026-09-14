import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { formatCell, type Row, type SortState } from './model';
const SortIcon = ({ sort, field }: {
    sort: SortState;
    field: string;
}) => sort?.field !== field ? <ChevronsUpDown size={12}/> : sort.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>;
export function OutputTableGrid({ rows, columns, labels, sort, sortBy, start }: {
    rows: Row[];
    columns: string[];
    labels?: Record<string, string>;
    sort: SortState;
    sortBy: (f: string) => void;
    start: number;
}) { return <div className="output-table-scroll"><table><thead><tr>{columns.map((f) => <th key={f}><button type="button" onClick={() => sortBy(f)} title={`Sort by ${labels?.[f] || f}`}><span>{labels?.[f] || f}</span><SortIcon sort={sort} field={f}/></button></th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={start + i}>{columns.map((f) => <td key={f} title={formatCell(row[f])}>{formatCell(row[f])}</td>)}</tr>)}</tbody></table></div>; }

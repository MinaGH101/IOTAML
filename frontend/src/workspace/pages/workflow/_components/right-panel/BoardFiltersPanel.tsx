import { FilterX, Search } from 'lucide-react';
import { Input, SearchField, Select } from '../../../../../shared/ui';
import type { BoardCaseFilters } from '../../../board/_hooks/useBoardCaseFilters';

const statusOptions = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'new', label: 'جدید' },
  { value: 'processed', label: 'پردازش‌شده' },
  { value: 'awaiting_review', label: 'در انتظار داوری' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'failed', label: 'ناموفق' },
];

export function BoardFiltersPanel({ filters }: { filters: BoardCaseFilters }) {
  const hasActiveFilters = filters.selectedCaseId !== null || Boolean(filters.caseSearch) || Boolean(filters.caseStatus) || Boolean(filters.caseMinScore);
  const caseOptions = [
    { value: '', label: 'همه پرونده‌ها' },
    ...filters.cases.map((item) => ({ value: String(item.id), label: `${item.title} · ${item.case_id}` })),
  ];

  return <div className="workflow-right-tab-body workflow-board-filters-tab">
    <section className="board-filters-panel" aria-label="فیلترهای برد">
      <header className="board-filters-panel-head">
        <div><b>فیلتر نتایج پرونده‌ها</b><span>این فیلترها فقط کارت‌های وابسته به پرونده را روی برد تغییر می‌دهند.</span></div>
        {hasActiveFilters && <button className="board-filters-clear" type="button" onClick={filters.clear}><FilterX size={14}/>پاک کردن</button>}
      </header>
      {!filters.available ? <div className="board-filters-empty">برای این برد هنوز خروجی پرونده‌ای اضافه نشده است.</div> : <div className="board-filters-fields">
        <label className="board-filter-field"><span>جستجوی پرونده</span><SearchField containerClassName="board-filter-search" leading={<Search size={14}/>} value={filters.caseSearch} onChange={(event) => filters.setCaseSearch(event.target.value)} placeholder="نام، شناسه یا اطلاعات پرونده" aria-label="جستجوی پرونده" /></label>
        <label className="board-filter-field"><span>پرونده</span><Select value={filters.selectedCaseId ? String(filters.selectedCaseId) : ''} options={caseOptions} ariaLabel="انتخاب پرونده برای فیلتر برد" disabled={filters.loading} onChange={(value) => filters.setSelectedCaseId(Number(value) || null)}/></label>
        <label className="board-filter-field"><span>وضعیت پرونده</span><Select value={filters.caseStatus} options={statusOptions} ariaLabel="انتخاب وضعیت پرونده برای فیلتر برد" onChange={filters.setCaseStatus}/></label>
        <label className="board-filter-field"><span>حداقل امتیاز</span><Input type="number" min="0" inputMode="decimal" placeholder="مثلاً ۸۰" value={filters.caseMinScore} onChange={(event) => filters.setCaseMinScore(event.target.value)} /></label>
        <p className="board-filters-count" aria-live="polite">{filters.loading ? 'در حال دریافت پرونده‌ها…' : `${filters.filteredCases.length} از ${filters.cases.length} پرونده نمایش داده می‌شود.`}</p>
      </div>}
    </section>
  </div>;
}

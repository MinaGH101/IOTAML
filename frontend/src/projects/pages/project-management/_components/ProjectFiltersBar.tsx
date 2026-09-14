import { PlusCircle, RefreshCw, Search } from 'lucide-react';
import type { UserProfile } from '../../../../shared/types';
import { Button, Input, Select } from '../../../../shared/ui';
import type { AccessFilter, ProjectFilters } from '../projectFilters';

export function ProjectFiltersBar({ user, filters, fetching, onChange, onRefresh, onCreate }: { user: UserProfile; filters: ProjectFilters; fetching: boolean; onChange: (value: ProjectFilters) => void; onRefresh: () => void; onCreate: () => void }) {
  const set = <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) => onChange({ ...filters, [key]: value });
  return <section className="projects-toolbar manager-panel">
    <div className="project-filter-search"><Search size={17} /><Input value={filters.query} onChange={(e) => set('query', e.target.value)} placeholder="جستجو در نام، مالک، کاربران و توضیحات" /></div>
    <Select ariaLabel="دسترسی پروژه" value={filters.access} onChange={(next) => set('access', next as AccessFilter)} options={[{ value: 'all', label: 'همه دسترسی‌ها' }, { value: 'owned', label: 'پروژه‌های مالکیتی' }, { value: 'assigned', label: 'پروژه‌های تخصیص‌یافته' }, { value: 'edit', label: 'قابل ویرایش' }, { value: 'view', label: 'فقط مشاهده' }, { value: 'new', label: 'تخصیص جدید' }]} />
    <Select ariaLabel="وضعیت پروژه" value={filters.state} onChange={(next) => set('state', next as ProjectFilters['state'])} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, { value: 'open', label: 'باز' }, { value: 'closed', label: 'بسته' }]} />
    <Select ariaLabel="اولویت پروژه" value={filters.priority} onChange={(next) => set('priority', next as ProjectFilters['priority'])} options={[{ value: 'all', label: 'همه اولویت‌ها' }, { value: 'high', label: 'زیاد' }, { value: 'medium', label: 'متوسط' }, { value: 'low', label: 'کم' }]} />
    <Button loading={fetching} leadingIcon={<RefreshCw size={15} />} onClick={onRefresh}>بروزرسانی</Button>
    {user.role !== 'guest' && <Button variant="primary" leadingIcon={<PlusCircle size={15} />} onClick={onCreate}>پروژه جدید</Button>}
  </section>;
}

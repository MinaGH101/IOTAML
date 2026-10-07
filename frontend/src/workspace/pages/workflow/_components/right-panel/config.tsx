import { BarChart3, Bot, Filter, GitBranch, History, PackageOpen, SlidersHorizontal } from 'lucide-react';
import type { RightTab } from './types';
export const rightTabs: RightTab[] = ['results', 'settings', 'history', 'assistant', 'versions', 'components'];
export const rightTabsFor = (boardOpen: boolean): RightTab[] => boardOpen ? ['filters', ...rightTabs] : rightTabs;
export const rightTabMeta: Record<RightTab, {
    label: string;
    icon: typeof BarChart3;
}> = {
    filters: { label: 'فیلترهای برد', icon: Filter }, assistant: { label: 'دستیار هوشمند', icon: Bot }, results: { label: 'خروجی نود', icon: BarChart3 }, settings: { label: 'تنظیمات نود', icon: SlidersHorizontal },
    history: { label: 'تاریخچه اجرا', icon: History }, versions: { label: 'نسخه‌های جریان', icon: GitBranch }, components: { label: 'کامپوننت‌ها', icon: PackageOpen },
};

import { HardDrive } from 'lucide-react';
import type { ArtifactUsage } from '../../../../shared/types';
import { formatBytes } from '../../../lib/formatBytes';

export function ArtifactUsageSummary({ usage }: { usage: ArtifactUsage | null }) {
  if (!usage) return null;
  const percent = Math.min(100, usage.quota_bytes ? (usage.total_bytes / usage.quota_bytes) * 100 : 0);
  return <div className="artifact-usage-summary">
    <div className="artifact-usage-head"><span><HardDrive size={17}/> فضای ذخیره‌سازی پروژه</span><b>{formatBytes(usage.total_bytes)} از {formatBytes(usage.quota_bytes)}</b></div>
    <div className="artifact-usage-track" aria-label="میزان استفاده از فضای ذخیره‌سازی"><span style={{ width: `${percent}%` }} /></div>
    <small>{usage.artifact_count.toLocaleString('fa-IR')} فایل مدیریت‌شده در فضای پروژه</small>
  </div>;
}

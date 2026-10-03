import { ApiError } from '../../../../../shared/api/httpClient';
import { userFriendlyErrorMessage, workflowProblemCopy } from '../../../../../shared/lib/errorMessages';
export function executionErrorMessage(error: unknown) { if (!(error instanceof ApiError))
    return userFriendlyErrorMessage(error, 'اجرا کامل نشد. اتصال‌ها و تنظیمات نودها را بررسی کنید.'); const problems = Array.isArray(error.details.errors) ? error.details.errors as Array<Record<string, unknown>> : []; if (!problems.length)
    return error.message; const first = problems[0]; const copy = workflowProblemCopy(first); const location = [first.nodeId ? `نود ${String(first.nodeId)}` : '', first.field ? `تنظیم ${String(first.field)}` : '', first.port ? `پورت ${String(first.port)}` : ''].filter(Boolean).join(' · '); return `${copy.message}${location ? ` (${location})` : ''} — ${copy.action}`; }

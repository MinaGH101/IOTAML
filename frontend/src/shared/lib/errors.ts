import { ApiError } from '../api/httpClient';

export type UiMessage = { text: string; tone: 'success' | 'error' | 'info' } | null;

const API_ERROR_MESSAGES: Record<string, string> = {
  ARTIFACT_TOO_LARGE: 'حجم فایل بیشتر از محدودیت فضای ذخیره‌سازی است.',
  STORAGE_QUOTA_EXCEEDED: 'سهمیه فضای ذخیره‌سازی پروژه یا کاربر تکمیل شده است.',
  STORAGE_UNAVAILABLE: 'فضای ذخیره‌سازی در دسترس نیست. دوباره تلاش کنید.',
  DATASET_READ_FAILED: 'فایل CSV قابل خواندن نیست.',
  UNSUPPORTED_FILE_TYPE: 'نوع فایل پشتیبانی نمی‌شود.',
  PROJECT_NOT_FOUND: 'پروژه پیدا نشد.',
  DATASET_NOT_FOUND: 'دیتاست پیدا نشد.',
  WORKFLOW_NOT_FOUND: 'جریان کاری پیدا نشد.',
  WORKFLOW_VALIDATION_FAILED: 'ساختار جریان کاری معتبر نیست.',
  PERMISSION_DENIED: 'اجازه انجام این عملیات را ندارید.',
  VALIDATION_ERROR: 'اطلاعات واردشده معتبر نیست.',
};

export function messageFromError(error: unknown, fallback: string): UiMessage {
  if (error instanceof ApiError) {
    return { text: API_ERROR_MESSAGES[error.code] || error.message || fallback, tone: 'error' };
  }
  return { text: error instanceof Error ? error.message : fallback, tone: 'error' };
}

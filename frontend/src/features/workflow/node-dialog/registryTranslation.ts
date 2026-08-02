const PARAM_TRANSLATIONS: Record<string, string> = {
  'Feature columns': 'ستون‌های ویژگی', 'Features columns': 'ستون‌های ویژگی', 'Feature column': 'ستون ویژگی', 'Target column': 'ستون هدف', Target: 'هدف',
  'Exclude columns': 'ستون‌های حذف‌شده', 'Excluded columns': 'ستون‌های حذف‌شده', 'Columns to exclude': 'ستون‌هایی که حذف شوند', Columns: 'ستون‌ها', Column: 'ستون', Dataset: 'دیتاست', Rows: 'ردیف‌ها', Limit: 'محدودیت تعداد',
  'Test size': 'اندازه داده تست', 'Random state': 'مقدار تصادفی ثابت', Model: 'مدل', Metric: 'معیار', Color: 'رنگ', Title: 'عنوان', 'X axis': 'محور X', 'Y axis': 'محور Y', Minimum: 'کمینه', Maximum: 'بیشینه', Normalize: 'نرمال‌سازی', Strategy: 'روش', Method: 'روش', Value: 'مقدار', Find: 'جستجو', Replace: 'جایگزینی', Code: 'کد', 'Python code': 'کد پایتون', Input: 'ورودی', Output: 'خروجی', Name: 'نام', Description: 'توضیحات', Ascending: 'صعودی', Descending: 'نزولی', True: 'بله', False: 'خیر',
};

function translateParamText(value: string) {
  const normalized = value.trim();
  if (PARAM_TRANSLATIONS[normalized]) return PARAM_TRANSLATIONS[normalized];
  return value.replace(/Feature columns/g, 'ستون‌های ویژگی').replace(/Exclude columns/g, 'ستون‌های حذف‌شده').replace(/Target column/g, 'ستون هدف').replace(/Columns/g, 'ستون‌ها').replace(/Column/g, 'ستون').replace(/Dataset/g, 'دیتاست').replace(/Python code/g, 'کد پایتون').replace(/Random state/g, 'مقدار تصادفی ثابت').replace(/Test size/g, 'اندازه داده تست');
}

export function translateRegistryLabels<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => translateRegistryLabels(item)) as T;
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const shouldTranslate = ['label', 'title', 'description', 'help', 'helperText', 'placeholder', 'displayName'].includes(key);
    result[key] = typeof raw === 'string' && shouldTranslate ? translateParamText(raw) : translateRegistryLabels(raw);
  }
  return result as T;
}

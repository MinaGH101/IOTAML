import type { SelectOption } from '../../../shared/_components/CustomSelect';
import type { NodeParam } from '../../../shared/_types';

export function uniq(values: string[]) { return [...new Set(values.filter(Boolean))]; }
export function parseArray(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : String(value || '').split(',').map((v) => v.trim()).filter(Boolean); }
export function isDynamic(value: unknown): value is { mode: 'dynamic'; expression: string } { return Boolean(value && typeof value === 'object' && (value as { mode?: string }).mode === 'dynamic'); }
export function staticValue(value: unknown, fallback: unknown) { return isDynamic(value) ? fallback : value ?? fallback ?? ''; }
export const FRIENDLY_OPTION_LABELS: Record<string, string> = {
  pair_count: 'Pair count',
  mae: 'MAE',
  mae_pct: 'MAE (%)',
  rmse: 'RMSE',
  mean_bias: 'Mean bias',
  median_absolute_error: 'Median absolute error',
  mean_rpd_pct: 'Mean RPD (%)',
  median_rpd_pct: 'Median RPD (%)',
  max_rpd_pct: 'Maximum RPD (%)',
  mean_relative_bias_pct: 'Mean relative bias (%)',
  pearson_r: 'Pearson r',
  spearman_rho: 'Spearman rho',
  mean_pair_rsd_pct: 'Mean pair RSD (%)',
  mean_numeric: 'Average numeric duplicates',
  first: 'استفاده از اولین ردیف منطبق',
  nearest_boundary: 'نزدیک‌ترین مرز معتبر',
  keep: 'حفظ مقدار و فقط علامت‌گذاری',
  missing: 'جایگزینی با مقدار خالی',
  hazen: 'Hazen',
  weibull: 'Weibull',
  blom: 'Blom',
  none: 'هیچ‌کدام',
  rows: 'ردیف‌ها (عمودی / محور Y)',
  columns: 'ستون‌ها (افقی / محور X)',
  match: 'تطبیق دقیق',
  union: 'اجتماع ستون‌ها',
  intersection: 'اشتراک ستون‌ها',
  id: 'تطبیق با ستون شناسه',
  position: 'تطبیق بر اساس موقعیت ردیف',
  inner: 'فقط شناسه‌های مشترک',
  outer: 'همه شناسه‌ها',
  left: 'همه ردیف‌های ورودی اول',
  suffix: 'افزودن پسوند خودکار',
  error: 'نمایش خطا',
  true: 'بله',
  false: 'خیر',
  auto: 'خودکار', regression: 'رگرسیون', classification: 'طبقه‌بندی',
  highest: 'بیشترین', lowest: 'کمترین', full_data: 'کل داده',
  train_test_split: 'تقسیم آموزش/آزمون', k_fold: 'اعتبارسنجی K-Fold',
  uniform: 'یکنواخت', distance: 'بر اساس فاصله', linear: 'خطی',
  poly: 'چندجمله‌ای', sigmoid: 'سیگموید', select: 'انتخاب',
  drop: 'حذف', contains: 'شامل باشد', not_contains: 'شامل نباشد',
  column: 'ستون', column_name: 'نام ستون', row_index: 'شماره ردیف',
  numeric: 'عددی', text: 'متنی', boolean: 'بولی', datetime: 'تاریخ و زمان',
  mean: 'میانگین', median: 'میانه', both: 'هر دو دنباله',
  upper: 'دنباله بالا', lower: 'دنباله پایین', vertical: 'عمودی',
  horizontal: 'افقی', all: 'همه', pearson: 'پیرسون',
  spearman: 'اسپیرمن', kendall: 'کندال', standard: 'استاندارد',
  minmax: 'کمینه–بیشینه', robust: 'مقاوم', maxabs: 'بیشینه قدرمطلق',
  mean_std: 'میانگین و انحراف معیار', std_only: 'فقط انحراف معیار',
  mean_only: 'فقط میانگین', center_scale: 'مرکز و مقیاس',
  scale_only: 'فقط مقیاس', center_only: 'فقط مرکز',
  train: 'آموزش', test: 'آزمون', fold_tests: 'آزمون‌های Fold',
  external: 'داده خارجی', binary: 'دودویی', macro: 'ماکرو',
  weighted: 'وزن‌دار', micro: 'میکرو', accuracy: 'دقت',
  precision: 'صحت مثبت', recall: 'بازیابی',
};
export function friendlyOptionLabel(value: unknown, fallback: string) {
  if (value === null) return 'None';
  const key = String(value || '');
  return FRIENDLY_OPTION_LABELS[key] || key || fallback;
}

export const FARSI_SETTING_LABELS: Record<string, string> = {
  'Add Outlier Flag Columns': 'افزودن ستون علامت ناهنجاری', Alpha: 'آلفا',
  'Analyte / Measurement Columns': 'ستون‌های آنالیت / اندازه‌گیری', Bins: 'تعداد بازه‌ها',
  'Case-sensitive IDs': 'حساسیت شناسه به بزرگی حروف', Center: 'مرکز',
  'Classification Average': 'میانگین طبقه‌بندی', Code: 'کد', Color: 'رنگ',
  Column: 'ستون', 'Column Mode': 'حالت ستون', Columns: 'ستون‌ها',
  'Data Pair': 'جفت داده', 'Data Pairs': 'جفت‌های داده',
  'DataFrame Sample ID Column': 'ستون شناسه نمونه دیتافریم', Dataset: 'دیتاست',
  'Denominator Column': 'ستون مخرج', 'Describe Include': 'نوع ستون‌های گزارش توصیفی',
  'Detection Limit CSV': 'فایل CSV حد تشخیص',
  'Duplicate Sample Mapping Column': 'ستون نگاشت نمونه تکراری',
  'Error Metrics': 'معیارهای خطا', 'Feature Columns': 'ستون‌های ویژگی',
  Filename: 'نام فایل', 'Filter Target': 'هدف فیلتر', 'First Column Name': 'نام ستون اول',
  'Force Finite': 'اجبار به مقادیر متناهی', 'Gap Sensitivity': 'حساسیت فاصله',
  'Guideline Labels': 'برچسب خطوط راهنما', 'Guideline Values': 'مقادیر خطوط راهنما',
  'ID Column': 'ستون شناسه', 'Imputation Blocks': 'بلوک‌های جایگذاری',
  'JSON Payload': 'داده JSON', Kernel: 'کرنل', 'Max Iterations': 'حداکثر تکرار',
  'Max Output Rows': 'حداکثر ردیف خروجی', 'Max Plot Columns': 'حداکثر ستون نمودار',
  'Max Plot Points': 'حداکثر نقاط نمودار', 'Max Points': 'حداکثر نقاط',
  'Max Points Per Plot': 'حداکثر نقاط هر نمودار',
  'Maximum Outlier Fraction': 'حداکثر نسبت داده پرت', 'Memory MB': 'حافظه (MB)',
  Method: 'روش', Metrics: 'معیارها', 'MinMax: Feature Max': 'بیشینه MinMax',
  'MinMax: Feature Min': 'کمینه MinMax', 'Minimum Retained Values': 'حداقل مقادیر حفظ‌شده',
  Neighbors: 'تعداد همسایه‌ها', 'Normalization Blocks': 'بلوک‌های نرمال‌سازی',
  'Number of Folds': 'تعداد Fold', 'Numerator Column': 'ستون صورت',
  Operator: 'عملگر', Orientation: 'جهت', 'Output Column': 'ستون خروجی',
  'Plotting Position': 'روش موقعیت ترسیم', 'Preview Rows': 'ردیف‌های پیش‌نمایش',
  'Random State': 'بذر تصادفی', 'Raw / Duplicate Mapping': 'نگاشت خام / تکراری',
  'Raw Sample Mapping Column': 'ستون نگاشت نمونه خام',
  'Repeated DataFrame ID Policy': 'قانون شناسه تکراری دیتافریم',
  Replacement: 'جایگزینی', 'Replacement Blocks': 'بلوک‌های جایگزینی',
  'Replacing Condition': 'شرط جایگزینی', 'Replacing Value': 'مقدار جایگزین',
  'Report Condition Blocks JSON': 'JSON بلوک‌های شرط گزارش',
  'Report Match Key': 'کلید تطبیق گزارش', 'Require Unique ID': 'الزام شناسه یکتا',
  'Robust Mode': 'حالت Robust', 'Robust: Quantile Max': 'بیشینه چندک Robust',
  'Robust: Quantile Min': 'کمینه چندک Robust', 'Row End': 'ردیف پایان',
  'Row Query': 'عبارت فیلتر ردیف', 'Row Start': 'ردیف شروع', 'Find By':'جستجو براساس',
  'Scaling Method': 'روش مقیاس‌بندی', 'Scatter Plot Blocks': 'بلوک‌های نمودار پراکندگی',
  'Series Colors': 'رنگ سری‌ها', Shuffle: 'برزدن داده‌ها', Sort: 'مرتب‌سازی',
  'Standard Mode': 'حالت استاندارد', 'Standardize Data': 'استانداردسازی داده',
  'Stratify Classification Target': 'لایه‌بندی هدف طبقه‌بندی', Tail: 'دنباله',
  'Target Column': 'ستون هدف', 'Target Type': 'نوع هدف', 'Task Type': 'نوع مسئله',
  'Test Size': 'اندازه داده آزمون', 'Timeout Seconds': 'مهلت اجرا (ثانیه)',
  'Top N': 'تعداد برتر', 'Train Mode': 'حالت آموزش', Value: 'مقدار',
  Weights: 'وزن‌ها', 'X Column': 'ستون X', 'X Max': 'بیشینه X', 'X Min': 'کمینه X',
  'X-axis Columns': 'ستون‌های محور X', 'Y Column': 'ستون Y',
  'Y Max': 'بیشینه Y', 'Y Min': 'کمینه Y', 'Y-axis Rows': 'ردیف‌های محور Y',
};

export function farsiSettingLabel(label: string) {
  return FARSI_SETTING_LABELS[label] || label;
}
export function selectOptions(options: unknown[]): SelectOption[] { return options.map((option, index) => ({ value: option === null ? 'null' : String(option), label: friendlyOptionLabel(option, `گزینه ${index + 1}`) })); }
export function normalizeNumber(value: string, param: NodeParam) { if (value === '') return null; const n = Number(value); return param.type === 'integer' ? Math.round(n) : n; }
export function toggleItem(items: string[], item: string) { return items.includes(item) ? items.filter((value) => value !== item) : uniq([...items, item]); }

export function shouldShowParam(registryId: string, paramName: string, params: Record<string, unknown>) {
  if (registryId === 'TR-020') {
    const method = String(params.method || 'standard');
    if (['columns', 'method', 'max_output_rows'].includes(paramName)) return true;
    if (['standard_mode'].includes(paramName)) return method === 'standard';
    if (['feature_min', 'feature_max'].includes(paramName)) return method === 'minmax';
    if (['quantile_min', 'quantile_max', 'robust_mode'].includes(paramName)) return method === 'robust';
    if (['with_mean', 'with_std', 'with_centering', 'with_scaling'].includes(paramName)) return false;
  }
  if (registryId === 'UT-003') {
    const axis = String(params.axis || 'rows');
    const alignment = String(params.column_alignment || 'id');
    if (['axis', 'max_output_rows'].includes(paramName)) return true;
    if (paramName === 'row_schema') return axis === 'rows';
    if (['column_alignment', 'duplicate_columns'].includes(paramName)) return axis === 'columns';
    if (['id_column', 'join_type'].includes(paramName)) return axis === 'columns' && alignment === 'id';
  }
  return true;
}

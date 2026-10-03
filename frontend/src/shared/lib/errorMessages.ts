export const DEFAULT_ERROR_MESSAGE = 'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.';
export const ASSISTANT_ERROR_MESSAGE = 'سرعت نت کمه! بعدا دوباره تلاش کنید.';

const PERSIAN_TEXT = /[\u0600-\u06ff]/;

const API_ERROR_MESSAGES: Record<string, string> = {
  ARTIFACT_TOO_LARGE: 'حجم فایل بیشتر از حد مجاز است. یک فایل کوچک‌تر انتخاب کنید.',
  BAD_REQUEST: 'درخواست قابل پردازش نیست. اطلاعات واردشده را بررسی کنید.',
  CONFLICT: 'این اطلاعات هم‌زمان تغییر کرده است. صفحه را تازه‌سازی و دوباره تلاش کنید.',
  CUSTOM_CODE_DISABLED: 'اجرای کد سفارشی در تنظیمات این سامانه غیرفعال است.',
  DATASET_NOT_FOUND: 'دیتاست پیدا نشد. یک دیتاست موجود را انتخاب کنید.',
  DATASET_READ_FAILED: 'فایل داده خوانده نشد. فرمت و محتوای فایل را بررسی کنید.',
  HTTP_ERROR: 'سرویس در حال حاضر پاسخ مناسبی نداد. کمی بعد دوباره تلاش کنید.',
  INTERNAL_ERROR: 'یک مشکل موقت در سامانه رخ داد. کمی بعد دوباره تلاش کنید.',
  NETWORK_ERROR: 'ارتباط با سرور برقرار نشد. اینترنت و اتصال سرور را بررسی کنید.',
  NOT_FOUND: 'اطلاعات درخواستی پیدا نشد. ممکن است حذف یا جابه‌جا شده باشد.',
  PAYLOAD_TOO_LARGE: 'حجم اطلاعات بیشتر از حد مجاز است. حجم فایل یا داده را کمتر کنید.',
  PERMISSION_DENIED: 'اجازه انجام این کار را ندارید. سطح دسترسی خود را بررسی کنید.',
  PROJECT_NOT_FOUND: 'پروژه پیدا نشد. به فهرست پروژه‌ها برگردید و دوباره انتخاب کنید.',
  RATE_LIMITED: 'درخواست‌های زیادی ارسال شده است. چند لحظه صبر کنید و دوباره تلاش کنید.',
  REQUEST_CANCELLED: 'عملیات لغو شد.',
  REQUEST_FAILED: 'درخواست انجام نشد. لطفاً دوباره تلاش کنید.',
  REQUEST_TIMEOUT: 'پاسخ سرور دیر رسید. اتصال اینترنت را بررسی و دوباره تلاش کنید.',
  RESPONSE_TOO_LARGE: 'حجم پاسخ برای نمایش بیش از حد زیاد است. داده یا محدوده درخواست را کمتر کنید.',
  SERVICE_UNAVAILABLE: 'سرویس موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.',
  SQL_IMPORT_EMPTY: 'جدول انتخاب‌شده داده‌ای ندارد. یک جدول دیگر انتخاب کنید.',
  SQL_IMPORT_FAILED: 'داده از SQL خوانده نشد. تنظیمات اتصال و دسترسی خواندن را بررسی کنید.',
  SQL_IMPORT_LIMIT: 'حجم داده SQL بیشتر از حد مجاز است. تعداد ردیف‌ها را کمتر کنید.',
  STORAGE_QUOTA_EXCEEDED: 'فضای ذخیره‌سازی کافی نیست. فایل‌های غیرضروری را حذف کنید.',
  STORAGE_UNAVAILABLE: 'فضای ذخیره‌سازی در دسترس نیست. کمی بعد دوباره تلاش کنید.',
  UNAUTHORIZED: 'نشست شما پایان یافته است. دوباره وارد حساب کاربری شوید.',
  UNSUPPORTED_CONTENT_TYPE: 'نوع محتوای فایل پشتیبانی نمی‌شود. یک فایل معتبر انتخاب کنید.',
  UNSUPPORTED_FILE_TYPE: 'نوع فایل پشتیبانی نمی‌شود. فرمت فایل را بررسی کنید.',
  VALIDATION_ERROR: 'بعضی اطلاعات کامل یا معتبر نیست. فیلدهای مشخص‌شده را بررسی کنید.',
  WORKFLOW_NAME_REQUIRED: 'نام جریان کاری را وارد کنید.',
  WORKFLOW_NOT_FOUND: 'جریان کاری پیدا نشد. از فهرست، یک جریان موجود را باز کنید.',
  WORKFLOW_PLAN_INVALID: 'ساختار جریان کاری قابل اجرا نیست. اتصال‌ها و تنظیمات نودها را بررسی کنید.',
  WORKFLOW_VALIDATION_FAILED: 'جریان کاری آماده اجرا نیست. موارد مشخص‌شده را اصلاح کنید.',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: API_ERROR_MESSAGES.BAD_REQUEST,
  401: API_ERROR_MESSAGES.UNAUTHORIZED,
  403: API_ERROR_MESSAGES.PERMISSION_DENIED,
  404: API_ERROR_MESSAGES.NOT_FOUND,
  409: API_ERROR_MESSAGES.CONFLICT,
  413: API_ERROR_MESSAGES.PAYLOAD_TOO_LARGE,
  422: API_ERROR_MESSAGES.VALIDATION_ERROR,
  429: API_ERROR_MESSAGES.RATE_LIMITED,
  500: API_ERROR_MESSAGES.INTERNAL_ERROR,
  502: API_ERROR_MESSAGES.SERVICE_UNAVAILABLE,
  503: API_ERROR_MESSAGES.SERVICE_UNAVAILABLE,
  504: API_ERROR_MESSAGES.REQUEST_TIMEOUT,
};

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

export function containsPersianText(value: unknown): value is string {
  return typeof value === 'string' && PERSIAN_TEXT.test(value);
}

export function friendlyApiErrorMessage(code: string, status: number, rawMessage?: string): string {
  return API_ERROR_MESSAGES[code]
    || STATUS_MESSAGES[status]
    || (containsPersianText(rawMessage) ? rawMessage : DEFAULT_ERROR_MESSAGE);
}

export function userFriendlyErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (typeof error === 'string') return containsPersianText(error) ? error : fallback;
  if (!error || typeof error !== 'object') return fallback;

  const candidate = error as ErrorLike;
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const status = typeof candidate.status === 'number' ? candidate.status : 0;
  if (code || status) {
    return friendlyApiErrorMessage(
      code || 'REQUEST_FAILED',
      status,
      typeof candidate.message === 'string' ? candidate.message : undefined,
    );
  }

  return containsPersianText(candidate.message) ? candidate.message : fallback;
}

export function isRequestCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as ErrorLike & { name?: unknown };
  return candidate.code === 'REQUEST_CANCELLED' || candidate.name === 'AbortError';
}

type WorkflowProblem = Record<string, unknown>;

const WORKFLOW_PROBLEM_COPY: Record<string, { message: string; action: string }> = {
  NODE_APPLICATION_ERROR: {
    message: 'این نود به‌دلیل یک مشکل داخلی کامل نشد.',
    action: 'جریان را دوباره اجرا کنید؛ اگر تکرار شد، تنظیمات همین نود را بازبینی کنید.',
  },
  NODE_DATA_CONTRACT_INVALID: {
    message: 'داده ورودی این نود با ساختار مورد انتظار سازگار نیست.',
    action: 'ورودی‌های متصل، ستون‌های انتخاب‌شده و تنظیمات نود را بررسی کنید.',
  },
  circular_dependency: {
    message: 'اتصال‌ها یک مسیر حلقه‌ای ساخته‌اند.',
    action: 'یکی از اتصال‌های حلقه را حذف کنید تا مسیر اجرا یک‌طرفه شود.',
  },
  dangling_edge: {
    message: 'یک اتصال به نودی اشاره می‌کند که دیگر وجود ندارد.',
    action: 'اتصال خراب را حذف و نودها را دوباره به هم وصل کنید.',
  },
  duplicate_edge_id: {
    message: 'یک اتصال تکراری در جریان کاری وجود دارد.',
    action: 'اتصال تکراری را حذف و دوباره ایجاد کنید.',
  },
  duplicate_node_id: {
    message: 'یک نود تکراری در جریان کاری وجود دارد.',
    action: 'نود تکراری را حذف و دوباره اضافه کنید.',
  },
  incompatible_ports: {
    message: 'نوع خروجی یک نود با ورودی نود بعدی سازگار نیست.',
    action: 'خروجی را به ورودی هم‌نوع وصل کنید یا یک نود تبدیل داده بین آن‌ها قرار دهید.',
  },
  invalid_component_snapshot: {
    message: 'نسخه ذخیره‌شده این کامپوننت معتبر نیست.',
    action: 'کامپوننت را از کتابخانه دوباره اضافه یا به نسخه جدید ارتقا دهید.',
  },
  invalid_graph: {
    message: 'ساختار ذخیره‌شده جریان کاری معتبر نیست.',
    action: 'جریان را دوباره باز کنید یا یک نسخه سالم را بازیابی کنید.',
  },
  invalid_graph_item: {
    message: 'یکی از نودها یا اتصال‌ها ساختار معتبری ندارد.',
    action: 'مورد خراب را حذف و دوباره ایجاد کنید.',
  },
  invalid_input_port: {
    message: 'پورت ورودی انتخاب‌شده دیگر وجود ندارد.',
    action: 'اتصال را به یکی از ورودی‌های موجود نود وصل کنید.',
  },
  invalid_output_port: {
    message: 'پورت خروجی انتخاب‌شده دیگر وجود ندارد.',
    action: 'اتصال را از یکی از خروجی‌های موجود نود ایجاد کنید.',
  },
  invalid_setting_choice: {
    message: 'مقدار یکی از تنظیمات در فهرست گزینه‌های مجاز نیست.',
    action: 'تنظیم نود را باز کنید و یکی از گزینه‌های موجود را انتخاب کنید.',
  },
  invalid_setting_type: {
    message: 'نوع مقدار یکی از تنظیمات نود درست نیست.',
    action: 'مقدار تنظیم را پاک کنید و دوباره با فرمت درست وارد کنید.',
  },
  missing_edge_id: {
    message: 'یکی از اتصال‌ها ناقص ذخیره شده است.',
    action: 'اتصال ناقص را حذف و دوباره ایجاد کنید.',
  },
  missing_node_id: {
    message: 'یکی از نودها ناقص ذخیره شده است.',
    action: 'نود ناقص را حذف و دوباره اضافه کنید.',
  },
  missing_required_input_connection: {
    message: 'ورودی ضروری این نود هنوز متصل نشده است.',
    action: 'ورودی مشخص‌شده را به خروجی سازگار از نود قبلی وصل کنید.',
  },
  missing_required_setting: {
    message: 'یکی از تنظیمات ضروری نود خالی است.',
    action: 'تنظیمات نود را باز کنید و فیلد مشخص‌شده را تکمیل کنید.',
  },
  multiple_edges_single_input: {
    message: 'به یک ورودیِ تک‌اتصالی، چند خروجی وصل شده است.',
    action: 'اتصال‌های اضافه را حذف کنید و فقط یک اتصال نگه دارید.',
  },
  node_implementation_unavailable: {
    message: 'این نود در نسخه فعلی قابل اجرا نیست.',
    action: 'نود را با یک نود موجود در کتابخانه جایگزین کنید.',
  },
  unsupported_node_type: {
    message: 'نوع یکی از نودها در نسخه فعلی پشتیبانی نمی‌شود.',
    action: 'نود را حذف و نمونه جدید آن را از کتابخانه اضافه کنید.',
  },
};

export function workflowProblemCopy(problem: WorkflowProblem): { message: string; action: string } {
  const key = String(problem.type || problem.code || problem.error_type || '');
  const known = WORKFLOW_PROBLEM_COPY[key];
  if (known) return known;

  const rawMessage = problem.message;
  const rawAction = problem.suggestedFix || problem.suggested_fix;
  const applicationOwned = problem.responsibility === 'application';
  return {
    message: containsPersianText(rawMessage)
      ? rawMessage
      : applicationOwned
        ? 'این بخش به‌دلیل یک مشکل داخلی کامل نشد.'
        : 'جریان کاری با اطلاعات فعلی قابل اجرا نیست.',
    action: containsPersianText(rawAction)
      ? rawAction
      : applicationOwned
        ? 'یک‌بار دیگر تلاش کنید؛ اگر تکرار شد، تنظیمات نود را بررسی کنید.'
        : 'اتصال‌ها، داده ورودی و تنظیمات نود را بررسی کنید.',
  };
}

const BYTE_UNITS = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '۰ بایت';
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), BYTE_UNITS.length - 1);
  const amount = value / 1024 ** index;
  return `${amount.toLocaleString('fa-IR', { maximumFractionDigits: index === 0 ? 0 : 1 })} ${BYTE_UNITS[index]}`;
}

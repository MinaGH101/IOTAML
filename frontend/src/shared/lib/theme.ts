export type Theme = 'light' | 'dark';

const PROJECT_COLOR_VARIABLES = [
  '--theme-project-color-1',
  '--theme-project-color-2',
  '--theme-project-color-3',
  '--theme-project-color-4',
  '--theme-project-color-5',
  '--theme-project-color-6',
  '--theme-project-color-7',
] as const;

export function readThemeColor(variable: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

export function getProjectColors(): string[] {
  return PROJECT_COLOR_VARIABLES.map(readThemeColor).filter(Boolean);
}

export function getDefaultProjectColor(): string {
  return readThemeColor('--theme-project-color-1') || readThemeColor('--theme-primary');
}

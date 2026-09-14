export const BRANCH_COLOR_VARIABLES = [
    '--theme-primary',
    '--theme-success',
    '--theme-warning',
    '--theme-secondary',
    '--theme-danger',
] as const;
export function cssColor(styles: CSSStyleDeclaration, name: string, fallback: string) {
    return styles.getPropertyValue(name).trim() || fallback;
}
export function branchColors(styles: CSSStyleDeclaration) {
    const fallbacks = ['Highlight', 'LinkText', 'Mark', 'AccentColor', 'VisitedText'];
    return BRANCH_COLOR_VARIABLES.map((variable, index) => cssColor(styles, variable, fallbacks[index]));
}

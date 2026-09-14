const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
export function getThemeSnapshot() {
    return document.documentElement.dataset.theme || 'dark';
}
export function subscribeTheme(listener: () => void) {
    listeners.add(listener);
    if (!observer) {
        observer = new MutationObserver(() => {
            listeners.forEach((callback) => callback());
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && observer) {
            observer.disconnect();
            observer = null;
        }
    };
}

type Listener = (visible: boolean) => void;
type Pool = {
    observer: IntersectionObserver;
    listeners: Map<Element, Listener>;
    intersections: Map<Element, boolean>;
};
const pools = new Map<string, Pool>();
let installed = false;
function publish() { const pageVisible = document.visibilityState !== 'hidden'; pools.forEach(({ listeners, intersections }) => listeners.forEach((listener, element) => listener(pageVisible && Boolean(intersections.get(element))))); }
function sync() { if (pools.size && !installed) {
    document.addEventListener('visibilitychange', publish);
    installed = true;
}
else if (!pools.size && installed) {
    document.removeEventListener('visibilitychange', publish);
    installed = false;
} }
function getPool(rootMargin: string) { const existing = pools.get(rootMargin); if (existing)
    return existing; const listeners = new Map<Element, Listener>(); const intersections = new Map<Element, boolean>(); const observer = new IntersectionObserver((entries) => { const pageVisible = document.visibilityState !== 'hidden'; entries.forEach((entry) => { intersections.set(entry.target, entry.isIntersecting); listeners.get(entry.target)?.(pageVisible && entry.isIntersecting); }); }, { root: null, rootMargin, threshold: 0 }); const pool = { observer, listeners, intersections }; pools.set(rootMargin, pool); sync(); return pool; }
function release(rootMargin: string, pool: Pool) { if (pool.listeners.size)
    return; pool.observer.disconnect(); pool.intersections.clear(); pools.delete(rootMargin); sync(); }
export function observeVisibility(element: Element, rootMargin: string, listener: Listener) { const pool = getPool(rootMargin); pool.listeners.set(element, listener); pool.intersections.set(element, false); pool.observer.observe(element); return () => { pool.observer.unobserve(element); pool.listeners.delete(element); pool.intersections.delete(element); release(rootMargin, pool); }; }

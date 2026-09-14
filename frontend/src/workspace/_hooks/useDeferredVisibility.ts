import { useEffect, useRef, useState } from 'react';
import { observeVisibility } from './deferred-visibility/observerPool';
type MountScheduler = (run: () => void) => () => void;
export function useDeferredVisibility<T extends HTMLElement>({ enabled = true, rootMargin, sticky = false, scheduleMount }: {
    enabled?: boolean;
    rootMargin: string;
    sticky?: boolean;
    scheduleMount: MountScheduler;
}) { const elementRef = useRef<T | null>(null); const [visible, setVisible] = useState(false); const [mountReady, setMountReady] = useState(false); useEffect(() => { const element = elementRef.current; if (!enabled || !element) {
    setVisible(false);
    return;
} if (typeof IntersectionObserver === 'undefined') {
    setVisible(document.visibilityState !== 'hidden');
    return;
} return observeVisibility(element, rootMargin, (next) => { if (next || !sticky)
    setVisible(next); }); }, [enabled, rootMargin, sticky]); useEffect(() => { if (!enabled || !visible) {
    setMountReady(false);
    return;
} return scheduleMount(() => setMountReady(true)); }, [enabled, scheduleMount, visible]); return { elementRef, visible: enabled && visible && mountReady }; }

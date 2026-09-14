import { useDeferredVisibility } from '../../_hooks/useDeferredVisibility';
import { scheduleOutputMount } from '../../_utils/mountScheduler';
export function useOutputVisibility<T extends HTMLElement>(enabled = true) {
    return useDeferredVisibility<T>({
        enabled,
        rootMargin: '200px',
        sticky: true,
        scheduleMount: scheduleOutputMount,
    });
}

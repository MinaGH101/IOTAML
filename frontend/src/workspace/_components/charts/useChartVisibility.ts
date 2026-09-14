import { useDeferredVisibility } from '../../_hooks/useDeferredVisibility';
import { scheduleChartMount } from '../../_utils/mountScheduler';
export function useChartVisibility<T extends HTMLElement>() {
    return useDeferredVisibility<T>({
        rootMargin: '500px',
        scheduleMount: scheduleChartMount,
    });
}

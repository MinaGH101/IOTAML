type MountJob = {
    run: () => void;
    cancelled: boolean;
};
type TickScheduler = (run: () => void) => void;
function createMountScheduler(scheduleTick: TickScheduler) {
    const queue: MountJob[] = [];
    let pending = false;
    const drain = () => {
        pending = false;
        let job = queue.shift();
        while (job?.cancelled)
            job = queue.shift();
        job?.run();
        schedule();
    };
    const schedule = () => {
        if (pending || queue.length === 0)
            return;
        pending = true;
        scheduleTick(drain);
    };
    return (run: () => void) => {
        const job: MountJob = { run, cancelled: false };
        queue.push(job);
        schedule();
        return () => {
            job.cancelled = true;
        };
    };
}
export const scheduleOutputMount = createMountScheduler((run) => {
    window.requestAnimationFrame(run);
});
export const scheduleChartMount = createMountScheduler((run) => {
    window.setTimeout(run, 24);
});

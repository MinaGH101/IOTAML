type ChartMountJob = {
  run: () => void;
  cancelled: boolean;
};

const queue: ChartMountJob[] = [];
let timer = 0;

function scheduleNext() {
  if (timer || queue.length === 0) return;
  timer = window.setTimeout(() => {
    timer = 0;
    let job = queue.shift();
    while (job?.cancelled) job = queue.shift();
    job?.run();
    scheduleNext();
  }, 24);
}

export function scheduleChartMount(run: () => void) {
  const job: ChartMountJob = {
    run,
    cancelled: false,
  };
  queue.push(job);
  scheduleNext();
  return () => {
    job.cancelled = true;
  };
}

type MountJob = {
  run: () => void;
  cancelled: boolean;
};

const queue: MountJob[] = [];
let frame = 0;

function runNext() {
  frame = 0;
  let job = queue.shift();
  while (job?.cancelled) job = queue.shift();
  job?.run();
  if (queue.length) frame = window.requestAnimationFrame(runNext);
}

export function scheduleOutputMount(run: () => void) {
  const job: MountJob = { run, cancelled: false };
  queue.push(job);
  if (!frame) frame = window.requestAnimationFrame(runNext);
  return () => {
    job.cancelled = true;
  };
}

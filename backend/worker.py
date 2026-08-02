"""IOTA ML backend implementation for worker."""

from app.workers.reliable_worker import run_worker

if __name__ == '__main__':
    run_worker()

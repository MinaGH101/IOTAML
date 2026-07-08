from __future__ import annotations
import os
from redis import Redis
from rq import Queue, Worker

if __name__ == '__main__':
    redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    connection = Redis.from_url(redis_url)
    worker = Worker([Queue('workflow-runs', connection=connection)], connection=connection)
    worker.work()

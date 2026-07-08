from redis import Redis
from rq import Queue, Worker
from app.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    redis_conn = Redis.from_url(settings.redis_url)
    worker = Worker([Queue("workflow-runs", connection=redis_conn)], connection=redis_conn)
    worker.work(with_scheduler=False)

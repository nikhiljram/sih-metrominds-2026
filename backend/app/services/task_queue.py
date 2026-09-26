"""Persistent Task Queue Service — Supports Redis/Celery queue with FastAPI fallback"""

import os
from typing import Callable, Any
from fastapi import BackgroundTasks

REDIS_URL = os.getenv("REDIS_URL", "")

class TaskQueueManager:
    def __init__(self):
        self.use_redis = bool(REDIS_URL)
        if self.use_redis:
            try:
                import redis
                from rq import Queue
                self.redis_conn = redis.from_url(REDIS_URL)
                self.queue = Queue("investigation_tasks", connection=self.redis_conn)
                print(f"✅ Redis Task Queue connected: {REDIS_URL}")
            except Exception as e:
                print(f"⚠️ Redis connection failed ({e}). Falling back to in-process async queue.")
                self.use_redis = False

    def enqueue_task(self, background_tasks: BackgroundTasks, func: Callable, *args, **kwargs) -> Any:
        """Enqueue heavy asynchronous work into Redis Queue if configured, else FastAPI BackgroundTasks."""
        if self.use_redis:
            try:
                job = self.queue.enqueue(func, *args, **kwargs)
                print(f"📥 Enqueued job {job.id} to persistent Redis queue")
                return job.id
            except Exception as e:
                print(f"⚠️ Failed to enqueue to Redis ({e}). Executing in BackgroundTasks.")
        
        background_tasks.add_task(func, *args, **kwargs)
        return "background_task"

task_queue = TaskQueueManager()

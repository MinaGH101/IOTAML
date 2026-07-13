from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://nocodeml:nocodeml@postgres:5432/nocodeml"
    redis_url: str = "redis://redis:6379/0"
    storage_dir: str = "/app/storage"
    storage_backend: str = "local"
    minio_endpoint: str = "minio:9000"
    minio_public_endpoint: str = "localhost:9000"
    minio_access_key: str = "nocodeml"
    minio_secret_key: str = "nocodeml-secret"
    minio_secure: bool = False
    artifact_bucket: str = "iota-artifacts"
    artifact_signed_url_ttl_seconds: int = 900
    artifact_max_upload_bytes: int = 512 * 1024 * 1024
    artifact_default_retention_days: int = 30
    artifact_user_quota_bytes: int = 10 * 1024 * 1024 * 1024
    artifact_project_quota_bytes: int = 5 * 1024 * 1024 * 1024
    cors_origins: str = "http://localhost:5174"
    user_file: str = "/app/app/data/user.json"
    auth_secret: str = "change-this-secret-in-production"
    auth_token_ttl_seconds: int = 60 * 60 * 12

    job_poll_interval_seconds: float = 1.0
    job_active_poll_interval_seconds: float = 0.05
    job_state_poll_interval_seconds: float = 0.75
    job_use_fork_fast_path: bool = True
    job_heartbeat_interval_seconds: int = 10
    job_worker_health_interval_seconds: float = 5.0
    job_stale_after_seconds: int = 45
    job_default_timeout_seconds: int = 7200
    job_default_max_attempts: int = 3
    job_retry_base_delay_seconds: int = 10
    job_retry_max_delay_seconds: int = 900
    job_worker_concurrency: int = 2
    job_memory_limit_mb: int = 4096
    job_cpu_limit_seconds: int = 7200
    job_network_disabled: bool = True
    job_runtime_retention_hours: int = 72
    max_active_runs_per_user: int = 4
    max_active_runs_per_project: int = 8
    max_workflow_nodes: int = 500
    max_workflow_payload_bytes: int = 5_000_000

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Typed application configuration and production safety validation."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Single source of truth for all runtime configuration."""

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore', case_sensitive=False)

    app_environment: Literal['development', 'test', 'production'] = 'development'
    app_name: str = 'IOTA ML API'
    app_version: str = '1.0.0'
    debug: bool = False

    database_url: str = 'postgresql+psycopg2://iotaml:dev-only-password@postgres:5432/iotaml'
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=5, ge=0, le=50)
    database_pool_timeout_seconds: int = Field(default=30, ge=1, le=300)
    database_pool_recycle_seconds: int = Field(default=1800, ge=60, le=86400)

    redis_url: str = 'redis://redis:6379/0'
    redis_required_for_readiness: bool = False
    redis_connect_timeout_seconds: float = Field(default=2.0, gt=0, le=30)

    storage_dir: str = '/app/storage'
    storage_backend: Literal['local', 'minio'] = 'local'
    minio_endpoint: str = 'minio:9000'
    minio_public_endpoint: str = 'localhost:9000'
    minio_access_key: str = 'iotaml-dev'
    minio_secret_key: str = 'dev-only-minio-password'
    minio_secure: bool = False
    artifact_bucket: str = 'iota-artifacts'
    artifact_signed_url_ttl_seconds: int = Field(default=900, ge=60, le=86400)
    artifact_max_upload_bytes: int = Field(default=512 * 1024 * 1024, ge=1)
    artifact_default_retention_days: int = Field(default=30, ge=1)
    artifact_user_quota_bytes: int = Field(default=10 * 1024 * 1024 * 1024, ge=1)
    artifact_project_quota_bytes: int = Field(default=5 * 1024 * 1024 * 1024, ge=1)
    artifact_reconciliation_batch_size: int = Field(default=200, ge=1, le=5000)
    artifact_pending_timeout_seconds: int = Field(default=3600, ge=60)

    cors_origins: str = 'http://localhost:5174'
    user_file: str = '/app/app/data/user.json'
    auth_secret: str = 'change-this-secret-in-production'
    auth_token_ttl_seconds: int = Field(default=60 * 60 * 12, ge=300)
    admin_bootstrap_enabled: bool = True
    admin_email: str = 'admin@iota.local'
    admin_password: str = ''
    admin_first_name: str = 'IOTA'
    admin_last_name: str = 'Admin'
    openai_api_key: str = ''
    openai_base_url: str = 'https://api.openai.com/v1'
    openai_model: str = 'gpt-4o-mini'
    assistant_context_message_limit: int = Field(default=5, ge=1, le=50)

    upload_preview_max_rows: int = Field(default=100, ge=1, le=5000)
    profile_image_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=100 * 1024 * 1024)
    login_rate_limit_per_minute: int = Field(default=10, ge=1, le=1000)
    upload_rate_limit_per_minute: int = Field(default=20, ge=1, le=1000)
    run_rate_limit_per_minute: int = Field(default=30, ge=1, le=1000)
    upload_preview_max_columns: int = Field(default=200, ge=1, le=2000)
    api_default_page_size: int = Field(default=50, ge=1, le=500)
    api_max_page_size: int = Field(default=200, ge=1, le=1000)
    api_max_response_bytes: int = Field(default=10_000_000, ge=1024)
    max_workflow_nodes: int = Field(default=500, ge=1, le=10000)
    max_workflow_payload_bytes: int = Field(default=5_000_000, ge=1024)

    job_poll_interval_seconds: float = Field(default=1.0, gt=0)
    job_active_poll_interval_seconds: float = Field(default=0.05, gt=0)
    job_state_poll_interval_seconds: float = Field(default=0.75, gt=0)
    job_use_fork_fast_path: bool = True
    job_heartbeat_interval_seconds: int = Field(default=10, ge=1)
    job_worker_health_interval_seconds: float = Field(default=5.0, gt=0)
    job_stale_after_seconds: int = Field(default=45, ge=10)
    job_default_timeout_seconds: int = Field(default=7200, ge=10)
    job_default_max_attempts: int = Field(default=3, ge=1, le=20)
    job_retry_base_delay_seconds: int = Field(default=10, ge=1)
    job_retry_max_delay_seconds: int = Field(default=900, ge=1)
    job_worker_concurrency: int = Field(default=2, ge=1, le=64)
    job_memory_limit_mb: int = Field(default=4096, ge=128)
    job_cpu_limit_seconds: int = Field(default=7200, ge=1)
    job_network_disabled: bool = True
    job_runtime_retention_hours: int = Field(default=72, ge=1)
    job_shutdown_grace_seconds: int = Field(default=20, ge=1, le=300)
    job_stdout_max_bytes: int = Field(default=2_000_000, ge=1024)
    job_stderr_max_bytes: int = Field(default=2_000_000, ge=1024)
    job_result_max_bytes: int = Field(default=50_000_000, ge=1024)
    max_active_runs_per_user: int = Field(default=4, ge=1)
    max_active_runs_per_project: int = Field(default=8, ge=1)

    node_cache_enabled: bool = True
    node_cache_retention_days: int = Field(default=30, ge=1)
    node_cache_candidates_per_fingerprint: int = Field(default=8, ge=1, le=100)
    node_cache_max_bytes_per_project: int = Field(default=3 * 1024 * 1024 * 1024, ge=1)
    node_cache_compression: int = Field(default=3, ge=0, le=9)
    node_cache_cleanup_batch_size: int = Field(default=200, ge=1)
    workflow_version_limit: int = Field(default=100, ge=1)

    allow_custom_code: bool = False
    sql_import_sources: dict[str, dict] = Field(default_factory=dict)
    sql_import_max_rows: int = Field(default=100000, ge=1, le=1000000)
    custom_code_timeout_seconds: int = Field(default=30, ge=1, le=3600)
    custom_code_memory_mb: int = Field(default=512, ge=64)

    log_level: str = 'INFO'
    log_json: bool = True
    log_field_max_length: int = Field(default=4000, ge=256)
    metrics_enabled: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]

    @model_validator(mode='after')
    def validate_runtime(self) -> 'Settings':
        if self.job_retry_max_delay_seconds < self.job_retry_base_delay_seconds:
            raise ValueError('JOB_RETRY_MAX_DELAY_SECONDS must be >= JOB_RETRY_BASE_DELAY_SECONDS')
        if self.allow_custom_code:
            raise ValueError('Custom Python execution is unavailable until an OS-isolated runner is implemented. Keep ALLOW_CUSTOM_CODE=false.')
        if self.app_environment != 'production':
            return self
        unsafe: list[str] = []
        if self.auth_secret in {'', 'change-this-secret-in-production', 'dev-only-auth-secret-change-me'} or len(self.auth_secret) < 32:
            unsafe.append('AUTH_SECRET')
        if self.storage_backend == 'minio':
            if self.minio_access_key in {'', 'iotaml-dev', 'nocodeml', 'nocodeml-dev'}:
                unsafe.append('MINIO_ACCESS_KEY')
            if self.minio_secret_key in {'', 'nocodeml-secret', 'dev-only-minio-password'} or len(self.minio_secret_key) < 16:
                unsafe.append('MINIO_SECRET_KEY')
        if '*' in self.cors_origin_list:
            unsafe.append('CORS_ORIGINS')
        if unsafe:
            raise ValueError('Unsafe production configuration: ' + ', '.join(unsafe))
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

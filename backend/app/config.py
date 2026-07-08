from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://nocodeml:nocodeml@postgres:5432/nocodeml"
    redis_url: str = "redis://redis:6379/0"
    storage_dir: str = "/app/storage"
    cors_origins: str = "http://localhost:5174"
    user_file: str = "/app/app/data/user.json"
    auth_secret: str = "change-this-secret-in-production"
    auth_token_ttl_seconds: int = 60 * 60 * 12

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

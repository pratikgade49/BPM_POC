"""Application configuration, loaded once from environment / .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_admin_dsn: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    database_name: str = "bpm_studio"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/bpm_studio"

    jwt_secret_key: str = "change-this-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 10080

    bootstrap_admin_email: str = "admin@example.com"
    bootstrap_admin_password: str = "change-this-password"


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor - use this everywhere instead of instantiating Settings()."""
    return Settings()

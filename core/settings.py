"""
Application settings loaded from environment (e.g. .env).
Uses Pydantic BaseSettings; never hardcodes secrets.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from project root so it works regardless of CWD when starting uvicorn.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """
    Load OPENAI_API_KEY and Supabase credentials from environment.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = ""
    project_url: str = ""
    service_role_key: str = ""
    dict_db_path: str = "data/item_dictionary.db"

    @property
    def has_openai_key(self) -> bool:
        """Return True if a non-empty OpenAI API key is configured."""
        return bool(self.openai_api_key and self.openai_api_key.strip())

    @property
    def has_supabase(self) -> bool:
        """Return True if Supabase URL and service role key are configured."""
        return bool(
            self.project_url and self.project_url.strip()
            and self.service_role_key and self.service_role_key.strip()
        )


def get_settings() -> Settings:
    """
    Return the application settings instance (loads from .env once).
    """
    return Settings()

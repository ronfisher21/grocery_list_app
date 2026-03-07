"""
Application settings loaded from environment (e.g. .env).
Uses Pydantic BaseSettings; never hardcodes secrets.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Load OPENAI_API_KEY from environment.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str

    @property
    def has_openai_key(self) -> bool:
        """Return True if a non-empty OpenAI API key is configured."""
        return bool(self.openai_api_key and self.openai_api_key.strip())


def get_settings() -> Settings:
    """
    Return the application settings instance (loads from .env once).
    """
    return Settings()

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[4]
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "learning_tree.db"


class Settings(BaseSettings):
    app_name: str = "The Learning Tree API"
    database_url: str = f"sqlite:///{DB_PATH.as_posix()}"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str | None = None
    ollama_fast_model: str = "llama3.2:3b"
    ollama_advanced_model: str = "qwen3:30b"
    lesson_temperature: float = 0.2
    ollama_timeout_seconds: int = 180

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="LEARNING_TREE_",
    )


DATA_DIR.mkdir(parents=True, exist_ok=True)
settings = Settings()

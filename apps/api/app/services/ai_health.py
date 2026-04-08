from __future__ import annotations

from urllib.error import URLError
from urllib.request import urlopen

from app.core.config import settings


def default_health_model() -> str:
    return settings.ollama_fast_model or settings.ollama_model or settings.ollama_advanced_model


def check_ai_health() -> dict[str, str]:
    try:
        with urlopen(f"{settings.ollama_base_url}/api/tags", timeout=2) as response:
            if response.status == 200:
                return {
                    "status": "ok",
                    "provider": "ollama",
                    "model": default_health_model(),
                }
    except URLError as exc:
        return {
            "status": "offline",
            "provider": "ollama",
            "model": default_health_model(),
            "detail": str(exc.reason),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "offline",
            "provider": "ollama",
            "model": default_health_model(),
            "detail": str(exc),
        }

    return {
        "status": "offline",
        "provider": "ollama",
        "model": default_health_model(),
        "detail": "Unexpected response from Ollama.",
    }

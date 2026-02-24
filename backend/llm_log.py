import os
from typing import Any


def llm_debug_enabled() -> bool:
    return os.getenv("DEBUG_LLM", "").strip().lower() in {"1", "true", "yes", "on"}


def debug_llm(message: str) -> None:
    if llm_debug_enabled():
        print(message)


def log_gemini_usage(op: str, resp: Any) -> None:
    """
    Best-effort usage metadata logger; shape differs across SDK versions.
    """
    usage = getattr(resp, "usage_metadata", None) or getattr(resp, "usageMetadata", None)
    if not usage:
        return
    print(f"[llm:{op}] usage={usage}")

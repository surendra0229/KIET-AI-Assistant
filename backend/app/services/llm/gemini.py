"""Gemini API integration using the modern google-genai SDK.

Kept intentionally small — the prompt does all grounding work. The model
receives only the RAG prompt and returns the answer text.
"""
from __future__ import annotations

import time
from functools import lru_cache

from google.genai.errors import APIError

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class GeminiError(RuntimeError):
    """Raised for missing keys, quota, or upstream failures."""


@lru_cache
def _client():
    settings = get_settings()
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured.")
    # pyrefly: ignore [missing-import]
    from google import genai  # google-genai (modern SDK)
    return genai.Client(api_key=settings.gemini_api_key)


# Keep backward-compat alias so main.py can still call _model()
def _model():
    return _client()



def generate_answer(prompt: str) -> str:
    settings = get_settings()
    configured_model = settings.gemini_model
    
    # Build list of models to try starting with the configured model
    models_to_try = [configured_model]
    fallbacks = ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite-preview", "gemini-3.5-flash", "gemini-2.0-flash"]
    for fb in fallbacks:
        if fb != configured_model:
            models_to_try.append(fb)
            
    last_error = None
    
    for model in models_to_try:
        log.info("Attempting generation with model: %s", model)
        for attempt in range(3):
            try:
                client = _client()
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "max_output_tokens": 1024,
                    },
                )
                text = (getattr(response, "text", None) or "").strip()
                if not text:
                    raise GeminiError("Empty response from Gemini.")
                
                if model != configured_model:
                    log.warning(
                        "Used fallback model %s because configured model %s was unavailable.",
                        model,
                        configured_model,
                    )
                return text
                
            except APIError as e:
                last_error = e
                status_code = getattr(e, "code", None)
                err_msg = str(e)
                
                # Check if it is a rate limit (429) or transient server error (503 / demand spikes)
                is_retryable = (
                    status_code in (429, 503)
                    or "RESOURCE_EXHAUSTED" in err_msg
                    or "UNAVAILABLE" in err_msg
                    or "experiencing high demand" in err_msg
                )
                
                if is_retryable and attempt < 2:
                    sleep_time = 1.5 * (attempt + 1)
                    log.warning(
                        "Temporary Gemini error (%s) on model %s. Retrying in %.1fs (attempt %d/3)...",
                        err_msg,
                        model,
                        sleep_time,
                        attempt + 1,
                    )
                    time.sleep(sleep_time)
                    continue
                else:
                    log.error("API Error on model %s: %s", model, err_msg)
                    # Proceed to next model in fallback list
                    break
            except Exception as e:  # noqa: BLE001
                last_error = e
                log.exception("Unexpected exception on model %s", model)
                # Proceed to next model in fallback list
                break
                
    raise GeminiError(
        f"Gemini generation failed on all attempted models. Last error: {last_error}"
    )

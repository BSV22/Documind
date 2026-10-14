from abc import ABC, abstractmethod
import os
import random
import time
import logging
from google import genai
from google.genai.errors import APIError
from google.genai import types

logger = logging.getLogger(__name__)
MAX_INLINE_RETRY_DELAY = 10


def _provider_retry_delay(error: APIError) -> float | None:
    """Read RetryInfo or Retry-After from the GenAI error, when supplied."""
    headers = getattr(getattr(error, "response", None), "headers", {}) or {}
    retry_after = headers.get("retry-after")
    if retry_after:
        try:
            return max(0.0, float(retry_after))
        except (TypeError, ValueError):
            pass

    response_details = getattr(error, "details", {}) or {}
    error_details = response_details.get("error", response_details)
    for detail in error_details.get("details", []):
        if str(detail.get("@type", "")).endswith("RetryInfo"):
            retry_delay = str(detail.get("retryDelay", ""))
            if retry_delay.endswith("s"):
                try:
                    return max(0.0, float(retry_delay[:-1]))
                except ValueError:
                    pass
    return None


class EmbeddingModel(ABC):

    @abstractmethod
    def embed(self, text: str):
        pass


client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


class GeminiEmbedding(EmbeddingModel):

    def __init__(self,
                 model="models/gemini-embedding-001",
                 batch_size=64,
                 max_retries=5):

        self.model = model
        self.batch_size = batch_size
        self.max_retries = max_retries

    def embed(self, text: str):
        return self.embed_many([text])[0]

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        """Embed a small batch in one API call, retrying transient rate limits."""
        if not texts:
            return []

        for attempt in range(self.max_retries):
            try:
                result = client.models.embed_content(
                    model=self.model,
                    contents=texts,
                    config=types.EmbedContentConfig(output_dimensionality=768)
                )
                vectors = [embedding.values for embedding in result.embeddings]
                if len(vectors) != len(texts):
                    raise RuntimeError(
                        f"Gemini returned {len(vectors)} embeddings for {len(texts)} input chunks"
                    )
                return vectors
            except APIError as error:
                retryable = error.code in {429, 500, 502, 503, 504}
                if not retryable or attempt == self.max_retries - 1:
                    raise

                provider_delay = _provider_retry_delay(error)
                if provider_delay is not None and provider_delay > MAX_INLINE_RETRY_DELAY:
                    logger.warning(
                        "Gemini requested a %.1f-second retry delay; returning instead "
                        "of holding the upload request open",
                        provider_delay,
                    )
                    raise

                backoff_seconds = max(provider_delay or 0, min(2 ** attempt, 30))
                backoff_seconds += random.uniform(0, 0.5)
                logger.warning(
                    "Gemini embedding request limited/unavailable (code %s); "
                    "retrying in %.1f seconds (attempt %s/%s)",
                    error.code,
                    backoff_seconds,
                    attempt + 1,
                    self.max_retries - 1,
                )
                time.sleep(backoff_seconds)

        raise RuntimeError("Gemini embedding retries exhausted")
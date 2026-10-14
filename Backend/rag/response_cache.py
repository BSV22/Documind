"""Small, process-local TTL/LRU cache for completed RAG responses."""

import os
import threading
import time
from collections import OrderedDict
from typing import Any


class ResponseCache:
    def __init__(self, max_entries: int = 256, ttl_seconds: int = 300):
        self.max_entries = max(1, max_entries)
        self.ttl_seconds = max(1, ttl_seconds)
        self._entries: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.RLock()

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None

            expires_at, value = entry
            if expires_at <= now:
                del self._entries[key]
                return None

            self._entries.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> None:
        if not value:
            return

        with self._lock:
            self._entries[key] = (time.monotonic() + self.ttl_seconds, value)
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)


response_cache = ResponseCache(
    max_entries=int(os.getenv("RAG_RESPONSE_CACHE_SIZE", "256")),
    ttl_seconds=int(os.getenv("RAG_RESPONSE_CACHE_TTL", "300")),
)
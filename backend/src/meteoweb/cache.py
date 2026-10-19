"""Tiny async TTL cache so every visitor shares one upstream request per key."""

import asyncio
import time
from collections.abc import Awaitable, Callable


class TTLCache[T]:
    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._entries: dict[str, tuple[float, T]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get(self, key: str, load: Callable[[], Awaitable[T]]) -> T:
        entry = self._entries.get(key)
        if entry and entry[0] > time.monotonic():
            return entry[1]
        # One loader per key: concurrent misses wait for the first one instead of stampeding.
        async with self._locks.setdefault(key, asyncio.Lock()):
            entry = self._entries.get(key)
            if entry and entry[0] > time.monotonic():
                return entry[1]
            value = await load()
            self._entries[key] = (time.monotonic() + self._ttl, value)
            return value

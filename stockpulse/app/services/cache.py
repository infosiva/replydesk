import json
import logging

from upstash_redis import Redis

from app.config import settings

logger = logging.getLogger(__name__)

# TTL values in seconds
TTL_PRICE = 300         # 5 minutes (increased from 60s for better performance)
TTL_FUNDAMENTALS = 3600  # 1 hour
TTL_FINANCIALS = 86400   # 24 hours
TTL_SESSION = 1800       # 30 minutes for conversation cache


class RedisCache:
    def __init__(self):
        self._client: Redis | None = None

    def initialize(self):
        if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
            self._client = Redis(
                url=settings.upstash_redis_rest_url,
                token=settings.upstash_redis_rest_token,
            )
            logger.info("Upstash Redis initialized")

    @property
    def available(self) -> bool:
        return self._client is not None

    def get(self, key: str) -> dict | list | None:
        if not self._client:
            return None
        try:
            val = self._client.get(key)
            if val is None:
                return None
            if isinstance(val, str):
                return json.loads(val)
            return val
        except Exception:
            logger.exception("Redis GET error for key=%s", key)
            return None

    def set(self, key: str, value, ttl: int = TTL_FUNDAMENTALS):
        if not self._client:
            return
        try:
            self._client.set(key, json.dumps(value, default=str), ex=ttl)
        except Exception:
            logger.exception("Redis SET error for key=%s", key)

    def delete(self, key: str):
        if not self._client:
            return
        try:
            self._client.delete(key)
        except Exception:
            logger.exception("Redis DELETE error for key=%s", key)


redis_cache = RedisCache()

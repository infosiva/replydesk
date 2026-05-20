import logging

from fastapi import APIRouter, HTTPException

from app.services import market_data, supabase_client
from app.services.cache import TTL_FINANCIALS, TTL_FUNDAMENTALS, TTL_PRICE, redis_cache

logger = logging.getLogger(__name__)
router = APIRouter()


async def _cached(cache_key: str, ttl: int, fetcher, db_field: str | None = None, symbol: str | None = None):
    """
    Three-tier caching: Redis → stock_cache DB → yfinance (live).

    Args:
        cache_key: Redis cache key
        ttl: Redis TTL in seconds
        fetcher: Async function to fetch live data
        db_field: Field name in stock_cache table (price_data, info_data, etc.)
        symbol: Stock symbol for DB lookup
    """
    # Layer 1: Redis cache (fastest)
    cached = redis_cache.get(cache_key)
    if cached is not None:
        return cached

    # Layer 2: Supabase stock_cache table (prefetched by n8n)
    if db_field and symbol:
        db_cache = supabase_client.get_stock_cache(symbol)
        if db_cache and db_cache.get(db_field):
            logger.debug("stock_cache hit for %s:%s", symbol, db_field)
            result = db_cache[db_field]
            # Populate Redis for subsequent requests
            redis_cache.set(cache_key, result, ttl=ttl)
            return result

    # Layer 3: Live fetch from yfinance
    try:
        result = await fetcher()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Market data error: {exc}") from exc
    redis_cache.set(cache_key, result, ttl=ttl)
    return result


@router.get("/price/{symbol}")
async def price(symbol: str):
    return await _cached(
        f"price:{symbol.upper()}",
        TTL_PRICE,
        lambda: market_data.get_stock_price(symbol),
        db_field="price_data",
        symbol=symbol,
    )


@router.get("/history/{symbol}")
async def history(symbol: str, period: str = "1mo", interval: str = "1d"):
    # History not prefetched (too much data variance), just Redis + live
    return await _cached(
        f"history:{symbol.upper()}:{period}:{interval}",
        TTL_FUNDAMENTALS,
        lambda: market_data.get_stock_history(symbol, period, interval),
    )


@router.get("/info/{symbol}")
async def info(symbol: str):
    return await _cached(
        f"info:{symbol.upper()}",
        TTL_FUNDAMENTALS,
        lambda: market_data.get_company_info(symbol),
        db_field="info_data",
        symbol=symbol,
    )


@router.get("/financials/{symbol}")
async def financials(symbol: str):
    # Financials not prefetched (large data, rarely changes), just Redis + live
    return await _cached(
        f"financials:{symbol.upper()}",
        TTL_FINANCIALS,
        lambda: market_data.get_financial_statements(symbol),
    )


@router.get("/recommendations/{symbol}")
async def recommendations(symbol: str):
    return await _cached(
        f"recommendations:{symbol.upper()}",
        TTL_FUNDAMENTALS,
        lambda: market_data.get_analyst_recommendations(symbol),
        db_field="recommendations_data",
        symbol=symbol,
    )


@router.get("/news/{symbol}")
async def news(symbol: str):
    return await _cached(
        f"news:{symbol.upper()}",
        TTL_PRICE,
        lambda: market_data.get_stock_news(symbol),
        db_field="news_data",
        symbol=symbol,
    )

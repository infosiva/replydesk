import asyncio
import logging
from datetime import datetime, timedelta

import yfinance as yf

from app.services import supabase_client
from app.services.cache import redis_cache

logger = logging.getLogger(__name__)

# yfinance uses httpx HTTP/2 internally which is not thread-safe under concurrent
# asyncio.to_thread calls — serialize all yfinance fetches with a semaphore.
_yf_semaphore = asyncio.Semaphore(1)


def get_price_from_stock_cache(symbol: str) -> dict | None:
    """Try to get price data from the prefetched stock_cache table."""
    try:
        cached = supabase_client.get_stock_cache(symbol)
        if cached and cached.get("price_data"):
            price_data = cached["price_data"]
            # Calculate change from price_data
            price = price_data.get("price")
            prev_close = price_data.get("previous_close")
            if price and prev_close and prev_close != 0:
                change = price - prev_close
                change_pct = (change / prev_close) * 100
                return {
                    "symbol": symbol,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                }
    except Exception:
        logger.debug("stock_cache miss for %s", symbol)
    return None


def get_prices_from_stock_cache(symbols: list[str]) -> dict[str, dict]:
    """Get prices for multiple symbols from stock_cache table."""
    results = {}
    for symbol in symbols:
        data = get_price_from_stock_cache(symbol)
        if data:
            results[symbol] = data
    return results

# Market indices
INDICES = {
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones",
    "^IXIC": "Nasdaq",
    "^RUT": "Russell 2000",
    "^VIX": "VIX",
}

# Sector ETFs
SECTOR_ETFS = {
    "XLK": "Technology",
    "XLF": "Financials",
    "XLE": "Energy",
    "XLV": "Healthcare",
    "XLY": "Consumer Disc.",
    "XLP": "Consumer Staples",
    "XLI": "Industrials",
    "XLB": "Materials",
    "XLU": "Utilities",
    "XLRE": "Real Estate",
    "XLC": "Communication",
}

# Stock sectors for filtering (simplified mapping)
STOCK_SECTORS = {
    "all": "All Sectors",
    "Technology": "Technology",
    "Financial Services": "Financials",
    "Energy": "Energy",
    "Healthcare": "Healthcare",
    "Consumer Cyclical": "Consumer Disc.",
    "Consumer Defensive": "Consumer Staples",
    "Industrials": "Industrials",
    "Basic Materials": "Materials",
    "Utilities": "Utilities",
    "Real Estate": "Real Estate",
    "Communication Services": "Communication",
}

# Market cap categories
MARKET_CAP_CATEGORIES = {
    "all": "All Caps",
    "large": "Large Cap (>$10B)",
    "mid": "Mid Cap ($2B-$10B)",
    "small": "Small Cap (<$2B)",
}

# Popular stocks watchlist for top movers (reduced for performance)
WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V",
    "UNH", "HD", "JNJ", "XOM", "BAC", "KO", "PFE", "MRK", "PEP", "AVGO",
    "WMT", "CSCO", "AMD", "CRM", "ORCL", "NFLX", "DIS",
]

# Cache TTLs in seconds (longer = less API calls = faster response)
TTL_PRICES = 600       # 10 minutes
TTL_SECTORS = 900      # 15 minutes
TTL_NEWS = 3600        # 1 hour
TTL_CHART = 600        # 10 minutes
TTL_RATINGS = 14400    # 4 hours
TTL_DIVIDENDS = 14400  # 4 hours
TTL_EARNINGS = 14400   # 4 hours
TTL_EXTENDED = 900     # 15 minutes for pre/post market

# Period mappings for chart data
PERIOD_MAP = {
    "1D": ("1d", "5m"),
    "1W": ("5d", "30m"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "YTD": ("ytd", "1d"),
    "1Y": ("1y", "1d"),
}


def _safe_value(val):
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if val is None:
        return None
    if hasattr(val, "item"):
        return val.item()
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def get_batch_prices_sync(symbols: list[str]) -> dict[str, dict]:
    """
    Fetch prices for multiple symbols.
    First checks stock_cache (prefetched by n8n), then falls back to yfinance.
    """
    if not symbols:
        return {}

    # First, try to get prices from stock_cache (fast)
    results = get_prices_from_stock_cache(symbols)

    # Find symbols not in cache
    missing_symbols = [s for s in symbols if s not in results]

    if not missing_symbols:
        logger.debug("All %d symbols found in stock_cache", len(symbols))
        return results

    logger.debug("Fetching %d missing symbols from yfinance: %s", len(missing_symbols), missing_symbols)

    # Fall back to yfinance for missing symbols
    try:
        df = yf.download(
            tickers=missing_symbols,
            period="2d",
            interval="1d",
            group_by="ticker",
            threads=True,
            progress=False,
        )

        for symbol in missing_symbols:
            try:
                if len(missing_symbols) == 1:
                    ticker_df = df
                else:
                    if symbol not in df.columns.get_level_values(0):
                        continue
                    ticker_df = df[symbol]

                if ticker_df.empty or len(ticker_df) < 1:
                    continue

                close_col = "Close" if "Close" in ticker_df.columns else "Adj Close"
                closes = ticker_df[close_col].dropna()

                if len(closes) < 1:
                    continue

                current_price = _safe_value(closes.iloc[-1])
                prev_close = _safe_value(closes.iloc[-2]) if len(closes) >= 2 else current_price

                if current_price and prev_close and prev_close != 0:
                    change = current_price - prev_close
                    change_pct = (change / prev_close) * 100
                else:
                    change = 0
                    change_pct = 0

                results[symbol] = {
                    "symbol": symbol,
                    "price": current_price,
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                }
            except Exception:
                logger.debug("Error processing %s", symbol, exc_info=True)
                continue

    except Exception:
        logger.exception("Batch price fetch failed for missing symbols")

    return results


def get_market_indices_sync() -> list[dict]:
    """Fetch market index prices and changes."""
    symbols = list(INDICES.keys())
    prices = get_batch_prices_sync(symbols)

    results = []
    for symbol, name in INDICES.items():
        data = prices.get(symbol)
        if data:
            results.append({
                "symbol": symbol,
                "name": name,
                "price": data["price"],
                "change": data["change"],
                "change_pct": data["change_pct"],
            })
        else:
            results.append({
                "symbol": symbol,
                "name": name,
                "price": None,
                "change": None,
                "change_pct": None,
            })

    return results


def get_stock_sector_sync(symbol: str) -> str | None:
    """Get sector for a stock symbol. Returns None if not found."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return info.get("sector")
    except Exception:
        return None


def get_stock_market_cap_sync(symbol: str) -> tuple[float | None, str | None]:
    """Get market cap and category for a stock symbol."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        market_cap = info.get("marketCap")
        if market_cap is None:
            return None, None

        # Classify market cap
        if market_cap >= 10_000_000_000:  # $10B+
            category = "large"
        elif market_cap >= 2_000_000_000:  # $2B-$10B
            category = "mid"
        else:
            category = "small"

        return market_cap, category
    except Exception:
        return None, None


def classify_market_cap(market_cap: float | None) -> str | None:
    """Classify market cap into category."""
    if market_cap is None:
        return None
    if market_cap >= 10_000_000_000:
        return "large"
    elif market_cap >= 2_000_000_000:
        return "mid"
    else:
        return "small"


def validate_symbol_sync(symbol: str) -> dict:
    """Validate a stock symbol and return info."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        name = info.get("shortName") or info.get("longName")
        if name:
            return {
                "valid": True,
                "symbol": symbol,
                "name": name,
                "sector": info.get("sector"),
                "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            }
        return {"valid": False, "symbol": symbol}
    except Exception:
        return {"valid": False, "symbol": symbol}


async def validate_symbol(symbol: str) -> dict:
    """Async wrapper for symbol validation."""
    return await asyncio.to_thread(validate_symbol_sync, symbol)


def get_top_movers_sync(
    n: int = 10,
    sector: str | None = None,
    market_cap: str | None = None,
) -> dict[str, list[dict]]:
    """Get top gainers and losers from watchlist, optionally filtered by sector and market cap."""
    symbols_to_check = WATCHLIST

    # Apply filters if specified
    if (sector and sector != "all") or (market_cap and market_cap != "all"):
        filtered_symbols = []
        for symbol in WATCHLIST:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info

                # Check sector filter
                if sector and sector != "all":
                    stock_sector = info.get("sector")
                    if stock_sector != sector:
                        continue

                # Check market cap filter
                if market_cap and market_cap != "all":
                    mc = info.get("marketCap")
                    mc_category = classify_market_cap(mc)
                    if mc_category != market_cap:
                        continue

                filtered_symbols.append(symbol)
            except Exception:
                continue

        symbols_to_check = filtered_symbols if filtered_symbols else WATCHLIST[:10]

    prices = get_batch_prices_sync(symbols_to_check)

    if not prices:
        return {"gainers": [], "losers": []}

    stocks = list(prices.values())
    valid_stocks = [s for s in stocks if s.get("change_pct") is not None]

    sorted_by_change = sorted(valid_stocks, key=lambda x: x["change_pct"], reverse=True)

    return {
        "gainers": sorted_by_change[:n],
        "losers": sorted_by_change[-n:][::-1] if len(sorted_by_change) >= n else [],
    }


def get_sector_performance_sync() -> list[dict]:
    """Get sector ETF performance sorted by change."""
    symbols = list(SECTOR_ETFS.keys())
    prices = get_batch_prices_sync(symbols)

    results = []
    for symbol, sector in SECTOR_ETFS.items():
        data = prices.get(symbol)
        if data:
            results.append({
                "symbol": symbol,
                "sector": sector,
                "price": data["price"],
                "change": data["change"],
                "change_pct": data["change_pct"],
            })

    results.sort(key=lambda x: x.get("change_pct") or 0, reverse=True)
    return results


def get_chart_data_sync(
    symbol: str = "^GSPC", period: str = "1M", include_indicators: bool = True
) -> dict:
    """Get price history for charting with optional technical indicators."""
    from app.services.indicators import calculate_macd, calculate_rsi, calculate_sma

    period_info = PERIOD_MAP.get(period, ("1mo", "1d"))
    yf_period, interval = period_info

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=yf_period, interval=interval)

        if df.empty:
            return {"labels": [], "prices": [], "symbol": symbol, "period": period}

        labels = []
        prices = []
        volumes = []

        for date, row in df.iterrows():
            if period == "1D":
                labels.append(date.strftime("%H:%M"))
            elif period == "1W":
                labels.append(date.strftime("%a %H:%M"))
            else:
                labels.append(date.strftime("%b %d"))
            prices.append(round(_safe_value(row["Close"]), 2))
            volumes.append(int(_safe_value(row["Volume"])) if row.get("Volume") else 0)

        result = {
            "labels": labels,
            "prices": prices,
            "volumes": volumes,
            "symbol": symbol,
            "period": period,
            "name": INDICES.get(symbol, symbol),
        }

        # Add technical indicators for longer periods
        if include_indicators and len(prices) >= 20:
            result["sma_20"] = calculate_sma(prices, 20)
            if len(prices) >= 50:
                result["sma_50"] = calculate_sma(prices, 50)
            result["rsi"] = calculate_rsi(prices, 14)
            result["macd"] = calculate_macd(prices)

        return result
    except Exception:
        logger.exception("Chart data fetch failed for %s", symbol)
        return {"labels": [], "prices": [], "symbol": symbol, "period": period}


def get_movers_by_sector_sync(sector: str | None = None, n: int = 10) -> dict[str, list[dict]]:
    """Get top gainers and losers, optionally filtered by sector."""
    if not sector or sector == "all":
        return get_top_movers_sync(n)

    # Get stocks in the sector
    sector_stocks = []
    for symbol in WATCHLIST:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            if info.get("sector", "").lower() == sector.lower():
                sector_stocks.append(symbol)
        except Exception:
            continue

    if not sector_stocks:
        return {"gainers": [], "losers": []}

    prices = get_batch_prices_sync(sector_stocks)
    if not prices:
        return {"gainers": [], "losers": []}

    stocks = list(prices.values())
    valid_stocks = [s for s in stocks if s.get("change_pct") is not None]
    sorted_by_change = sorted(valid_stocks, key=lambda x: x["change_pct"], reverse=True)

    return {
        "gainers": sorted_by_change[:n],
        "losers": sorted_by_change[-n:][::-1] if len(sorted_by_change) >= n else [],
    }


def get_extended_hours_sync(symbols: list[str] | None = None) -> dict[str, dict]:
    """Get pre-market and after-hours prices for symbols."""
    if symbols is None:
        symbols = WATCHLIST[:5]

    results = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            pre_price = info.get("preMarketPrice")
            pre_change = info.get("preMarketChange")
            pre_change_pct = info.get("preMarketChangePercent")

            post_price = info.get("postMarketPrice")
            post_change = info.get("postMarketChange")
            post_change_pct = info.get("postMarketChangePercent")

            regular_price = info.get("regularMarketPrice") or info.get("currentPrice")

            if pre_price or post_price:
                pre_pct = round(_safe_value(pre_change_pct) * 100, 2) if pre_change_pct else None
                post_pct = round(_safe_value(post_change_pct) * 100, 2) if post_change_pct else None
                results[symbol] = {
                    "symbol": symbol,
                    "regular_price": _safe_value(regular_price),
                    "pre_market": {
                        "price": _safe_value(pre_price),
                        "change": _safe_value(pre_change),
                        "change_pct": pre_pct,
                    } if pre_price else None,
                    "post_market": {
                        "price": _safe_value(post_price),
                        "change": _safe_value(post_change),
                        "change_pct": post_pct,
                    } if post_price else None,
                }
        except Exception:
            logger.debug("Error fetching extended hours for %s", symbol, exc_info=True)
            continue

    return results


def get_analyst_ratings_sync(symbols: list[str] | None = None) -> list[dict]:
    """Get analyst recommendations for symbols."""
    if symbols is None:
        symbols = WATCHLIST[:10]

    results = []
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            rating = info.get("recommendationKey")
            target = info.get("targetMeanPrice")
            current = info.get("currentPrice") or info.get("regularMarketPrice")

            # Get recommendation breakdown
            recs = ticker.recommendations
            if recs is not None and not recs.empty:
                # Get most recent recommendations (last 3 months)
                recent = recs.tail(10)
                grade_col = recent["To Grade"].str
                buy = grade_col.contains(
                    "Buy|Overweight|Outperform", case=False, na=False
                ).sum()
                hold = grade_col.contains(
                    "Hold|Neutral|Equal", case=False, na=False
                ).sum()
                sell = grade_col.contains(
                    "Sell|Underweight|Underperform", case=False, na=False
                ).sum()
            else:
                buy, hold, sell = 0, 0, 0

            if rating or target:
                upside = None
                if target and current and current > 0:
                    upside = round(((target - current) / current) * 100, 1)

                results.append({
                    "symbol": symbol,
                    "name": info.get("shortName", symbol),
                    "rating": rating,
                    "target_price": _safe_value(target),
                    "current_price": _safe_value(current),
                    "upside_pct": upside,
                    "buy": buy,
                    "hold": hold,
                    "sell": sell,
                })
        except Exception:
            logger.debug("Error fetching ratings for %s", symbol, exc_info=True)
            continue

    # Sort by upside potential
    results.sort(key=lambda x: x.get("upside_pct") or 0, reverse=True)
    return results[:10]


def get_dividend_stocks_sync() -> list[dict]:
    """Get high dividend yield stocks from watchlist."""
    results = []
    for symbol in WATCHLIST:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            div_yield = info.get("dividendYield")
            if div_yield and div_yield > 0:
                payout = info.get("payoutRatio")
                payout_pct = round(payout * 100, 1) if payout else None
                price = info.get("currentPrice") or info.get("regularMarketPrice")
                results.append({
                    "symbol": symbol,
                    "name": info.get("shortName", symbol),
                    "yield_pct": round(div_yield * 100, 2),
                    "dividend_rate": _safe_value(info.get("dividendRate")),
                    "ex_date": info.get("exDividendDate"),
                    "payout_ratio": payout_pct,
                    "price": _safe_value(price),
                })
        except Exception:
            logger.debug("Error fetching dividend for %s", symbol, exc_info=True)
            continue

    # Sort by yield descending
    results.sort(key=lambda x: x.get("yield_pct") or 0, reverse=True)
    return results[:10]


def get_upcoming_earnings_sync(symbols: list[str] | None = None) -> list[dict]:
    """Get upcoming earnings dates for stocks."""
    if symbols is None:
        symbols = WATCHLIST[:15]

    results = []
    now = datetime.now()
    week_ahead = now + timedelta(days=14)

    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            calendar = ticker.calendar

            if calendar is not None:
                # calendar can be a dict or DataFrame
                if hasattr(calendar, "to_dict"):
                    calendar = calendar.to_dict()

                earnings_date = None
                if isinstance(calendar, dict):
                    # Check for earnings date
                    ed = calendar.get("Earnings Date")
                    if ed:
                        if isinstance(ed, list) and len(ed) > 0:
                            earnings_date = ed[0]
                        else:
                            earnings_date = ed

                if earnings_date:
                    # Convert to datetime if needed
                    if hasattr(earnings_date, "to_pydatetime"):
                        earnings_date = earnings_date.to_pydatetime()
                    elif isinstance(earnings_date, str):
                        try:
                            ed_str = earnings_date.replace("Z", "+00:00")
                            earnings_date = datetime.fromisoformat(ed_str)
                        except ValueError:
                            continue

                    # Check if within next 2 weeks
                    if isinstance(earnings_date, datetime):
                        if earnings_date.tzinfo:
                            earnings_date = earnings_date.replace(tzinfo=None)
                        if now <= earnings_date <= week_ahead:
                            info = ticker.info
                            price = info.get("currentPrice")
                            price = price or info.get("regularMarketPrice")
                            results.append({
                                "symbol": symbol,
                                "name": info.get("shortName", symbol),
                                "earnings_date": earnings_date.strftime("%Y-%m-%d"),
                                "days_until": (earnings_date - now).days,
                                "price": _safe_value(price),
                            })
        except Exception:
            logger.debug("Error fetching earnings for %s", symbol, exc_info=True)
            continue

    # Sort by earnings date
    results.sort(key=lambda x: x.get("earnings_date") or "9999-99-99")
    return results[:10]


def get_market_news_sync() -> list[dict]:
    """Aggregate news from major tickers."""
    news_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "^GSPC"]
    all_news = []
    seen_titles = set()

    for symbol in news_tickers:
        try:
            ticker = yf.Ticker(symbol)
            news = ticker.news or []
            for item in news[:5]:
                title = item.get("title", "")
                if title and title not in seen_titles:
                    seen_titles.add(title)
                    all_news.append({
                        "title": title,
                        "publisher": item.get("publisher"),
                        "link": item.get("link"),
                        "published": item.get("providerPublishTime"),
                        "related": symbol,
                    })
        except Exception:
            logger.debug("Error fetching news for %s", symbol, exc_info=True)
            continue

    all_news.sort(key=lambda x: x.get("published") or 0, reverse=True)
    return all_news[:20]


async def get_chart_data(symbol: str = "^GSPC", period: str = "1M") -> dict:
    """Async wrapper for chart data with caching."""
    cache_key = f"dashboard:chart:{symbol}:{period}"
    cached = redis_cache.get(cache_key)
    if cached:
        return cached

    data = await asyncio.to_thread(get_chart_data_sync, symbol, period)
    redis_cache.set(cache_key, data, ttl=TTL_CHART)
    return data


async def get_extended_hours() -> dict:
    """Async wrapper for extended hours data."""
    cache_key = "dashboard:extended_hours"
    cached = redis_cache.get(cache_key)
    if cached:
        return cached
    data = await asyncio.to_thread(get_extended_hours_sync)
    redis_cache.set(cache_key, data, ttl=TTL_EXTENDED)
    return data


async def get_analyst_ratings() -> list[dict]:
    """Async wrapper for analyst ratings."""
    cache_key = "dashboard:ratings"
    cached = redis_cache.get(cache_key)
    if cached:
        return cached
    data = await asyncio.to_thread(get_analyst_ratings_sync)
    redis_cache.set(cache_key, data, ttl=TTL_RATINGS)
    return data


async def get_dividend_stocks() -> list[dict]:
    """Async wrapper for dividend stocks."""
    cache_key = "dashboard:dividends"
    cached = redis_cache.get(cache_key)
    if cached:
        return cached
    data = await asyncio.to_thread(get_dividend_stocks_sync)
    redis_cache.set(cache_key, data, ttl=TTL_DIVIDENDS)
    return data


async def get_upcoming_earnings() -> list[dict]:
    """Async wrapper for upcoming earnings."""
    cache_key = "dashboard:earnings"
    cached = redis_cache.get(cache_key)
    if cached:
        return cached
    data = await asyncio.to_thread(get_upcoming_earnings_sync)
    redis_cache.set(cache_key, data, ttl=TTL_EARNINGS)
    return data


async def get_dashboard_data(sector: str = "all", market_cap: str = "all") -> dict:
    """
    Aggregate all dashboard data with caching.
    Returns dict with indices, movers, sectors, news, and updated_at.
    """
    # Try cache first
    movers_cache_key = f"dashboard:movers:{sector}:{market_cap}"
    cache_keys = {
        "indices": "dashboard:indices",
        "movers": movers_cache_key,
        "sectors": "dashboard:sectors",
        "news": "dashboard:news",
        "extended_hours": "dashboard:extended_hours",
        "ratings": "dashboard:ratings",
        "dividends": "dashboard:dividends",
        "earnings": "dashboard:earnings",
    }

    cached = {}
    for key, cache_key in cache_keys.items():
        data = redis_cache.get(cache_key)
        if data is not None:
            cached[key] = data

    # Fetch missing data
    to_fetch = []

    if "indices" not in cached:
        to_fetch.append(("indices", asyncio.to_thread(get_market_indices_sync), TTL_PRICES))

    if "movers" not in cached:
        movers_coro = asyncio.to_thread(get_top_movers_sync, 10, sector, market_cap)
        to_fetch.append(("movers", movers_coro, TTL_PRICES))

    if "sectors" not in cached:
        to_fetch.append(
            ("sectors", asyncio.to_thread(get_sector_performance_sync), TTL_SECTORS)
        )

    if "news" not in cached:
        to_fetch.append(("news", asyncio.to_thread(get_market_news_sync), TTL_NEWS))

    if "extended_hours" not in cached:
        extended_coro = asyncio.to_thread(get_extended_hours_sync)
        to_fetch.append(("extended_hours", extended_coro, TTL_EXTENDED))

    if "ratings" not in cached:
        to_fetch.append(("ratings", asyncio.to_thread(get_analyst_ratings_sync), TTL_RATINGS))

    if "dividends" not in cached:
        to_fetch.append(("dividends", asyncio.to_thread(get_dividend_stocks_sync), TTL_DIVIDENDS))

    if "earnings" not in cached:
        to_fetch.append(("earnings", asyncio.to_thread(get_upcoming_earnings_sync), TTL_EARNINGS))

    # Track when data was actually fetched
    fetch_time_key = "dashboard:last_fetch_time"

    if to_fetch:
        async def _guarded(coro):
            async with _yf_semaphore:
                return await coro

        results = await asyncio.gather(*[_guarded(t[1]) for t in to_fetch], return_exceptions=True)

        for (key, _, ttl), result in zip(to_fetch, results):
            if isinstance(result, Exception):
                logger.error("Failed to fetch %s: %s", key, result)
                if key == "movers":
                    cached[key] = {"gainers": [], "losers": []}
                elif key in ("news", "ratings", "dividends", "earnings"):
                    cached[key] = []
                elif key == "extended_hours":
                    cached[key] = {}
                else:
                    cached[key] = []
            else:
                cached[key] = result
                redis_cache.set(cache_keys[key], result, ttl=ttl)

        # Store the actual fetch time
        fetch_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        redis_cache.set(fetch_time_key, fetch_time, ttl=TTL_PRICES)

    # Get the cached fetch time (when data was actually fetched)
    last_fetch_time = redis_cache.get(fetch_time_key)
    if not last_fetch_time:
        last_fetch_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return {
        "indices": cached.get("indices", []),
        "gainers": cached.get("movers", {}).get("gainers", []),
        "losers": cached.get("movers", {}).get("losers", []),
        "sectors": cached.get("sectors", []),
        "news": cached.get("news", []),
        "extended_hours": cached.get("extended_hours", {}),
        "analyst_ratings": cached.get("ratings", []),
        "dividend_stocks": cached.get("dividends", []),
        "upcoming_earnings": cached.get("earnings", []),
        "updated_at": last_fetch_time,
    }

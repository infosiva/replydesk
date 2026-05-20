import asyncio
import logging

from app.services import market_data, supabase_client
from app.services.cache import TTL_FINANCIALS, TTL_FUNDAMENTALS, TTL_PRICE, redis_cache
from app.services.chart_analysis import analyze_chart
from app.services.portfolio_analysis import (
    analyze_portfolio,
    compare_stocks,
    get_watchlist_data,
    get_watchlist_news,
)

logger = logging.getLogger(__name__)


async def _cached(cache_key: str, ttl: int, fetcher, db_field: str | None = None, symbol: str | None = None):
    """Three-tier caching for AI tools: Redis → stock_cache DB → yfinance."""
    # Layer 1: Redis cache
    cached = redis_cache.get(cache_key)
    if cached is not None:
        logger.debug("Redis hit for %s", cache_key)
        return cached

    # Layer 2: Supabase stock_cache table
    if db_field and symbol:
        db_cache = supabase_client.get_stock_cache(symbol)
        if db_cache and db_cache.get(db_field):
            logger.debug("DB cache hit for %s:%s", symbol, db_field)
            result = db_cache[db_field]
            redis_cache.set(cache_key, result, ttl=ttl)
            return result

    # Layer 3: Live fetch
    result = await fetcher()
    redis_cache.set(cache_key, result, ttl=ttl)
    return result


async def _get_stock_price_cached(symbol: str) -> dict:
    return await _cached(
        f"price:{symbol.upper()}", TTL_PRICE,
        lambda: market_data.get_stock_price(symbol),
        db_field="price_data", symbol=symbol
    )


async def _get_company_info_cached(symbol: str) -> dict:
    return await _cached(
        f"info:{symbol.upper()}", TTL_FUNDAMENTALS,
        lambda: market_data.get_company_info(symbol),
        db_field="info_data", symbol=symbol
    )


async def _get_stock_news_cached(symbol: str) -> dict:
    return await _cached(
        f"news:{symbol.upper()}", TTL_PRICE,
        lambda: market_data.get_stock_news(symbol),
        db_field="news_data", symbol=symbol
    )


async def _get_recommendations_cached(symbol: str) -> dict:
    return await _cached(
        f"recommendations:{symbol.upper()}", TTL_FUNDAMENTALS,
        lambda: market_data.get_analyst_recommendations(symbol),
        db_field="recommendations_data", symbol=symbol
    )


async def _get_history_cached(symbol: str, period: str, interval: str) -> dict:
    return await _cached(
        f"history:{symbol.upper()}:{period}:{interval}", TTL_FUNDAMENTALS,
        lambda: market_data.get_stock_history(symbol, period, interval)
    )


async def _get_financials_cached(symbol: str) -> dict:
    return await _cached(
        f"financials:{symbol.upper()}", TTL_FINANCIALS,
        lambda: market_data.get_financial_statements(symbol)
    )

# Claude tool schemas
TOOLS = [
    {
        "name": "get_stock_price",
        "description": (
            "Get the current stock price and basic trading data "
            "for a given ticker symbol."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g. AAPL, MSFT, GOOGL)",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_stock_history",
        "description": "Get historical OHLCV price data for a stock over a specified period.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                },
                "period": {
                    "type": "string",
                    "description": "Time period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max",
                    "default": "1mo",
                },
                "interval": {
                    "type": "string",
                    "description": (
                        "Data interval: 1m, 2m, 5m, 15m, 30m, "
                        "60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo"
                    ),
                    "default": "1d",
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_company_info",
        "description": (
            "Get company fundamentals including sector, industry, "
            "market cap, PE ratio, beta, 52-week range, "
            "and business description."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_financial_statements",
        "description": (
            "Get financial statements (income statement, "
            "balance sheet, cash flow) for a company."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_analyst_recommendations",
        "description": "Get recent analyst recommendations and ratings for a stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_stock_news",
        "description": "Get recent news articles related to a stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "analyze_chart",
        "description": (
            "Analyze a stock chart for patterns, trends, support/resistance levels, "
            "and technical indicator signals (RSI, MACD, Bollinger Bands). "
            "Returns trend analysis, chart patterns, and actionable signals."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                },
                "period": {
                    "type": "string",
                    "description": "Time period for analysis: 1mo, 3mo, 6mo, 1y, 2y",
                    "default": "3mo",
                },
                "interval": {
                    "type": "string",
                    "description": "Data interval: 1d, 1wk, 1mo",
                    "default": "1d",
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "analyze_portfolio",
        "description": (
            "Analyze the user's watchlist/portfolio for diversification, "
            "sector allocation, top movers, and personalized recommendations. "
            "Requires user_id to be passed in context."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_watchlist_insights",
        "description": (
            "Get insights on all stocks in the user's watchlist including "
            "current prices, daily changes, movers, and recent news."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "include_news": {
                    "type": "boolean",
                    "description": "Whether to include recent news for watchlist stocks",
                    "default": False,
                },
            },
            "required": [],
        },
    },
    {
        "name": "compare_stocks",
        "description": (
            "Compare 2-5 stocks side by side on price, fundamentals (P/E, market cap), "
            "and performance metrics. Returns comparison data and rankings."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of 2-5 stock ticker symbols to compare",
                    "minItems": 2,
                    "maxItems": 5,
                }
            },
            "required": ["symbols"],
        },
    },
    {
        "name": "get_earnings_calendar",
        "description": (
            "Get upcoming earnings dates for a stock. Includes expected EPS, "
            "previous EPS, and earnings date. Essential for earnings plays."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g. AAPL, MSFT, RELIANCE.NS)",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_india_stock",
        "description": (
            "Get data for Indian stocks on NSE (National Stock Exchange) or BSE. "
            "Append .NS for NSE (e.g. RELIANCE.NS, TCS.NS, INFY.NS) or .BO for BSE. "
            "Use this for any query about Indian companies, Nifty, Sensex stocks."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "NSE/BSE ticker. NSE: append .NS (RELIANCE.NS). BSE: append .BO",
                }
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_market_movers",
        "description": (
            "Get top gainers and losers for today across US markets or Indian markets. "
            "Returns the biggest percentage movers with price and volume data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "market": {
                    "type": "string",
                    "enum": ["us", "india"],
                    "description": "Which market to check: 'us' for S&P500 movers, 'india' for Nifty50 movers",
                }
            },
            "required": ["market"],
        },
    },
    {
        "name": "get_sector_performance",
        "description": (
            "Get today's performance across all major market sectors. "
            "Shows which sectors are up/down — like a market heatmap summary."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]

# Tool name → async handler mapping (simple tools without user context)
# Now using cached versions for better performance
async def _get_earnings_calendar(symbol: str) -> dict:
    """Get upcoming earnings date and estimates via yfinance."""
    import yfinance as yf
    try:
        tk = yf.Ticker(symbol.upper())
        cal = tk.calendar
        if cal is None or cal.empty:
            return {"symbol": symbol, "earnings": "No upcoming earnings data found"}
        result = {}
        for col in cal.columns:
            for idx in cal.index:
                val = cal.loc[idx, col]
                key = f"{idx}_{col}" if len(cal.columns) > 1 else str(idx)
                result[key] = str(val) if val is not None else None
        return {"symbol": symbol, "calendar": result}
    except Exception as e:
        return {"symbol": symbol, "error": str(e)}


async def _get_india_stock(symbol: str) -> dict:
    """Get NSE/BSE stock data. Supports .NS and .BO suffixes."""
    sym = symbol.upper()
    if not sym.endswith(".NS") and not sym.endswith(".BO"):
        sym = sym + ".NS"  # default to NSE
    return await _get_stock_price_cached(sym)


async def _get_market_movers(market: str) -> dict:
    """Get top gainers/losers for US or India markets."""
    import yfinance as yf
    import asyncio

    if market == "india":
        symbols = [
            "RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFOSYS.NS","HINDUNILVR.NS",
            "ICICIBANK.NS","KOTAKBANK.NS","BHARTIARTL.NS","ITC.NS","LT.NS",
            "AXISBANK.NS","WIPRO.NS","ONGC.NS","NTPC.NS","POWERGRID.NS",
        ]
    else:
        symbols = [
            "AAPL","MSFT","NVDA","GOOGL","META","AMZN","TSLA","AMD","NFLX",
            "JPM","BAC","V","MA","JNJ","XOM","CVX","SPY","QQQ",
        ]

    async def fetch_one(sym: str):
        try:
            tk = yf.Ticker(sym)
            info = tk.fast_info
            return {
                "symbol": sym,
                "price": round(float(info.last_price or 0), 2),
                "change_pct": round(float(((info.last_price or 0) - (info.previous_close or 1)) / (info.previous_close or 1) * 100), 2),
            }
        except Exception:
            return None

    results = await asyncio.gather(*[fetch_one(s) for s in symbols])
    valid = [r for r in results if r and r["price"] > 0]
    valid.sort(key=lambda x: x["change_pct"], reverse=True)

    return {
        "market": market,
        "gainers": valid[:5],
        "losers": valid[-5:][::-1],
        "updated": "live",
    }


async def _get_sector_performance() -> dict:
    """Get performance of major sector ETFs as a heatmap proxy."""
    import yfinance as yf
    import asyncio

    sector_etfs = {
        "Technology": "XLK",
        "Healthcare": "XLV",
        "Financials": "XLF",
        "Energy": "XLE",
        "Consumer Disc.": "XLY",
        "Consumer Staples": "XLP",
        "Industrials": "XLI",
        "Materials": "XLB",
        "Real Estate": "XLRE",
        "Utilities": "XLU",
        "Communication": "XLC",
    }

    async def fetch_sector(name: str, etf: str):
        try:
            tk = yf.Ticker(etf)
            info = tk.fast_info
            prev = info.previous_close or 1
            last = info.last_price or prev
            chg = round((last - prev) / prev * 100, 2)
            return {"sector": name, "etf": etf, "change_pct": chg, "price": round(last, 2)}
        except Exception:
            return {"sector": name, "etf": etf, "change_pct": 0, "price": 0}

    results = await asyncio.gather(*[fetch_sector(n, e) for n, e in sector_etfs.items()])
    results.sort(key=lambda x: x["change_pct"], reverse=True)
    return {"sectors": results, "best": results[0]["sector"], "worst": results[-1]["sector"]}


TOOL_HANDLERS = {
    "get_stock_price": lambda args, _: _get_stock_price_cached(args["symbol"]),
    "get_stock_history": lambda args, _: _get_history_cached(
        args["symbol"],
        args.get("period", "1mo"),
        args.get("interval", "1d"),
    ),
    "get_company_info": lambda args, _: _get_company_info_cached(args["symbol"]),
    "get_financial_statements": lambda args, _: _get_financials_cached(args["symbol"]),
    "get_analyst_recommendations": lambda args, _: _get_recommendations_cached(args["symbol"]),
    "get_stock_news": lambda args, _: _get_stock_news_cached(args["symbol"]),
    "analyze_chart": lambda args, _: asyncio.to_thread(
        analyze_chart,
        args["symbol"],
        args.get("period", "3mo"),
        args.get("interval", "1d"),
    ),
    "compare_stocks": lambda args, _: asyncio.to_thread(
        compare_stocks,
        args["symbols"],
    ),
    "get_earnings_calendar": lambda args, _: _get_earnings_calendar(args["symbol"]),
    "get_india_stock": lambda args, _: _get_india_stock(args["symbol"]),
    "get_market_movers": lambda args, _: _get_market_movers(args.get("market", "us")),
    "get_sector_performance": lambda args, _: _get_sector_performance(),
}


# Tools that require user context
def _analyze_portfolio_handler(args: dict, user_id: str | None):
    if not user_id:
        return {"error": "User context required for portfolio analysis"}
    return asyncio.to_thread(analyze_portfolio, user_id)


def _watchlist_insights_handler(args: dict, user_id: str | None):
    if not user_id:
        return {"error": "User context required for watchlist insights"}

    def _get_insights():
        data = get_watchlist_data(user_id)
        result = {"positions": data}
        if args.get("include_news", False):
            result["news"] = get_watchlist_news(user_id)
        return result

    return asyncio.to_thread(_get_insights)


USER_CONTEXT_HANDLERS = {
    "analyze_portfolio": _analyze_portfolio_handler,
    "get_watchlist_insights": _watchlist_insights_handler,
}


async def execute_tool(name: str, arguments: dict, user_id: str | None = None) -> dict:
    """Execute a tool by name and return the result."""
    # Check if tool requires user context
    if name in USER_CONTEXT_HANDLERS:
        handler = USER_CONTEXT_HANDLERS[name]
        try:
            return await handler(arguments, user_id)
        except Exception as exc:
            return {"error": f"Tool execution failed: {exc}"}

    # Standard tools
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return await handler(arguments, user_id)
    except Exception as exc:
        return {"error": f"Tool execution failed: {exc}"}

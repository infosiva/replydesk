import asyncio
from datetime import datetime

import yfinance as yf

# yfinance/httpx HTTP2 is not thread-safe under concurrent asyncio.to_thread calls
_yf_semaphore = asyncio.Semaphore(1)


def _get_ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol)


def _safe_value(val):
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if val is None:
        return None
    if hasattr(val, "item"):
        return val.item()
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def _safe_dict(d: dict | None) -> dict:
    if not d:
        return {}
    return {k: _safe_value(v) for k, v in d.items()}


def get_stock_price_sync(symbol: str) -> dict:
    ticker = _get_ticker(symbol)
    info = ticker.fast_info
    return {
        "symbol": symbol.upper(),
        "price": _safe_value(info.last_price),
        "previous_close": _safe_value(info.previous_close),
        "open": _safe_value(info.open),
        "day_high": _safe_value(info.day_high),
        "day_low": _safe_value(info.day_low),
        "volume": _safe_value(info.last_volume),
        "market_cap": _safe_value(info.market_cap),
        "currency": info.currency,
    }


def get_stock_history_sync(
    symbol: str, period: str = "1mo", interval: str = "1d"
) -> dict:
    ticker = _get_ticker(symbol)
    df = ticker.history(period=period, interval=interval)
    if df.empty:
        return {"symbol": symbol.upper(), "period": period, "interval": interval, "data": []}

    records = []
    for date, row in df.iterrows():
        records.append({
            "date": date.isoformat(),
            "open": _safe_value(row.get("Open")),
            "high": _safe_value(row.get("High")),
            "low": _safe_value(row.get("Low")),
            "close": _safe_value(row.get("Close")),
            "volume": _safe_value(row.get("Volume")),
        })
    return {
        "symbol": symbol.upper(),
        "period": period,
        "interval": interval,
        "data": records,
    }


def get_company_info_sync(symbol: str) -> dict:
    ticker = _get_ticker(symbol)
    info = ticker.info
    keys = [
        "shortName", "longName", "sector", "industry", "country", "website",
        "longBusinessSummary", "fullTimeEmployees", "marketCap", "trailingPE",
        "forwardPE", "dividendYield", "beta", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
        "averageVolume", "currency",
    ]
    result = {"symbol": symbol.upper()}
    for k in keys:
        result[k] = _safe_value(info.get(k))
    return result


def get_financial_statements_sync(symbol: str) -> dict:
    ticker = _get_ticker(symbol)

    def df_to_records(df):
        if df is None or df.empty:
            return []
        records = []
        for date in df.columns:
            entry = {"date": date.isoformat()}
            for idx in df.index:
                entry[str(idx)] = _safe_value(df.loc[idx, date])
            records.append(entry)
        return records

    return {
        "symbol": symbol.upper(),
        "income_statement": df_to_records(ticker.income_stmt),
        "balance_sheet": df_to_records(ticker.balance_sheet),
        "cash_flow": df_to_records(ticker.cashflow),
    }


def get_analyst_recommendations_sync(symbol: str) -> dict:
    ticker = _get_ticker(symbol)
    rec = ticker.recommendations
    if rec is None or rec.empty:
        return {"symbol": symbol.upper(), "recommendations": []}

    records = []
    for date, row in rec.tail(10).iterrows():
        entry = {"date": date.isoformat() if hasattr(date, "isoformat") else str(date)}
        for col in rec.columns:
            entry[col] = _safe_value(row[col])
        records.append(entry)
    return {"symbol": symbol.upper(), "recommendations": records}


def get_stock_news_sync(symbol: str) -> dict:
    ticker = _get_ticker(symbol)
    news = ticker.news or []
    items = []
    for item in news[:10]:
        items.append({
            "title": item.get("title"),
            "publisher": item.get("publisher"),
            "link": item.get("link"),
            "published": item.get("providerPublishTime"),
            "type": item.get("type"),
        })
    return {"symbol": symbol.upper(), "news": items}


# Async wrappers

async def get_stock_price(symbol: str) -> dict:
    async with _yf_semaphore:
        return await asyncio.to_thread(get_stock_price_sync, symbol)


async def get_stock_history(
    symbol: str, period: str = "1mo", interval: str = "1d"
) -> dict:
    async with _yf_semaphore:
        return await asyncio.to_thread(get_stock_history_sync, symbol, period, interval)


async def get_company_info(symbol: str) -> dict:
    async with _yf_semaphore:
        return await asyncio.to_thread(get_company_info_sync, symbol)


async def get_financial_statements(symbol: str) -> dict:
    async with _yf_semaphore:
        return await asyncio.to_thread(get_financial_statements_sync, symbol)


async def get_analyst_recommendations(symbol: str) -> dict:
    async with _yf_semaphore:
        return await asyncio.to_thread(get_analyst_recommendations_sync, symbol)


async def get_stock_news(symbol: str) -> dict:
    async with _yf_semaphore:
        return await asyncio.to_thread(get_stock_news_sync, symbol)

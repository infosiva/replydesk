"""Stock comparison endpoint."""

import asyncio
import logging
from pathlib import Path

import yfinance as yf
from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.services.dashboard_data import PERIOD_MAP, _safe_value

logger = logging.getLogger(__name__)

router = APIRouter()

templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))


def get_stock_comparison_data(symbols: list[str]) -> list[dict]:
    """Get comparison data for multiple stocks."""
    results = []
    for symbol in symbols[:5]:  # Limit to 5 stocks
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            results.append({
                "symbol": symbol,
                "name": info.get("shortName") or info.get("longName", symbol),
                "price": _safe_value(info.get("currentPrice") or info.get("regularMarketPrice")),
                "change_pct": _safe_value(info.get("regularMarketChangePercent")),
                "market_cap": _safe_value(info.get("marketCap")),
                "pe_ratio": _safe_value(info.get("trailingPE")),
                "forward_pe": _safe_value(info.get("forwardPE")),
                "peg_ratio": _safe_value(info.get("pegRatio")),
                "dividend_yield": round(_safe_value(info.get("dividendYield") or 0) * 100, 2),
                "beta": _safe_value(info.get("beta")),
                "fifty_two_week_high": _safe_value(info.get("fiftyTwoWeekHigh")),
                "fifty_two_week_low": _safe_value(info.get("fiftyTwoWeekLow")),
                "avg_volume": _safe_value(info.get("averageVolume")),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
            })
        except Exception:
            logger.debug("Error fetching comparison data for %s", symbol, exc_info=True)
            results.append({"symbol": symbol, "error": "Failed to fetch data"})

    return results


def get_comparison_chart_data(symbols: list[str], period: str = "1M") -> dict:
    """Get normalized price history for comparison chart."""
    period_info = PERIOD_MAP.get(period, ("1mo", "1d"))
    yf_period, interval = period_info

    all_data = {}
    labels = []

    for symbol in symbols[:5]:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=yf_period, interval=interval)

            if df.empty:
                continue

            # Normalize to percentage change from first price
            first_price = df["Close"].iloc[0]
            normalized = ((df["Close"] - first_price) / first_price * 100).round(2)

            if not labels:
                for date in df.index:
                    if period == "1D":
                        labels.append(date.strftime("%H:%M"))
                    elif period == "1W":
                        labels.append(date.strftime("%a %H:%M"))
                    else:
                        labels.append(date.strftime("%b %d"))

            all_data[symbol] = [_safe_value(v) for v in normalized.tolist()]
        except Exception:
            logger.debug("Error fetching chart data for %s", symbol, exc_info=True)
            continue

    return {"labels": labels, "datasets": all_data}


@router.get("/compare", response_class=HTMLResponse)
async def compare_stocks(
    request: Request,
    symbols: str = Query("AAPL,MSFT,GOOGL", description="Comma-separated symbols"),
    period: str = Query("1M", description="Chart period"),
):
    """Render stock comparison page."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:5]

    try:
        # Fetch data in parallel
        comparison_data, chart_data = await asyncio.gather(
            asyncio.to_thread(get_stock_comparison_data, symbol_list),
            asyncio.to_thread(get_comparison_chart_data, symbol_list, period),
        )

        return templates.TemplateResponse(
            request,
            "compare.html",
            {
                "stocks": comparison_data,
                "chart_data": chart_data,
                "symbols": ",".join(symbol_list),
                "current_period": period,
                "periods": list(PERIOD_MAP.keys()),
            },
        )
    except Exception:
        logger.exception("Comparison page failed")
        return templates.TemplateResponse(
            request,
            "compare.html",
            {
                "stocks": [],
                "chart_data": {"labels": [], "datasets": {}},
                "symbols": symbols,
                "current_period": period,
                "periods": list(PERIOD_MAP.keys()),
                "error": "Failed to load comparison data",
            },
        )

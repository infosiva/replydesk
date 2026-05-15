import logging
from pathlib import Path

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.services.dashboard_data import (
    INDICES,
    MARKET_CAP_CATEGORIES,
    PERIOD_MAP,
    SECTOR_ETFS,
    STOCK_SECTORS,
    get_chart_data,
    get_dashboard_data,
    validate_symbol,
)

logger = logging.getLogger(__name__)

router = APIRouter()

templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))


@router.get("/", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    period: str = Query("1D", description="Chart period"),
    chart_symbol: str = Query("^GSPC", description="Symbol for chart"),
    sector: str = Query("all", description="Filter movers by sector"),
    market_cap: str = Query("all", description="Filter movers by market cap"),
):
    """Render the market dashboard landing page."""
    try:
        data = await get_dashboard_data(sector=sector, market_cap=market_cap)
        chart_data = await get_chart_data(chart_symbol, period)

        return templates.TemplateResponse(
            request,
            "dashboard.html",
            {
                **data,
                "chart_data": chart_data,
                "current_period": period,
                "current_chart_symbol": chart_symbol,
                "current_sector": sector,
                "current_market_cap": market_cap,
                "periods": list(PERIOD_MAP.keys()),
                "chart_indices": INDICES,
                "sector_list": SECTOR_ETFS,
                "stock_sectors": STOCK_SECTORS,
                "market_cap_categories": MARKET_CAP_CATEGORIES,
            },
        )
    except Exception:
        logger.exception("Dashboard data fetch failed")
        return templates.TemplateResponse(
            request,
            "dashboard.html",
            {
                "indices": [],
                "gainers": [],
                "losers": [],
                "sectors": [],
                "news": [],
                "analyst_ratings": [],
                "dividend_stocks": [],
                "upcoming_earnings": [],
                "extended_hours": {},
                "updated_at": None,
                "error": "Failed to load market data. Please try again later.",
                "chart_data": {"labels": [], "prices": []},
                "current_period": "1D",
                "current_chart_symbol": "^GSPC",
                "current_sector": "all",
                "current_market_cap": "all",
                "periods": list(PERIOD_MAP.keys()),
                "chart_indices": INDICES,
                "sector_list": SECTOR_ETFS,
                "stock_sectors": STOCK_SECTORS,
                "market_cap_categories": MARKET_CAP_CATEGORIES,
            },
        )


@router.get("/api/chart")
async def chart_api(
    symbol: str = Query("^GSPC", description="Symbol for chart"),
    period: str = Query("1D", description="Chart period"),
):
    """API endpoint for chart data (for dynamic updates)."""
    try:
        data = await get_chart_data(symbol, period)
        return JSONResponse(data)
    except Exception:
        logger.exception("Chart API failed")
        return JSONResponse({"labels": [], "prices": [], "error": "Failed to load chart data"})


@router.get("/api/search")
async def search_symbol(
    q: str = Query(..., description="Symbol or company name to search"),
):
    """Validate and search for a stock symbol."""
    try:
        result = await validate_symbol(q.upper().strip())
        return JSONResponse(result)
    except Exception:
        logger.exception("Symbol search failed")
        return JSONResponse({"valid": False, "error": "Search failed"})

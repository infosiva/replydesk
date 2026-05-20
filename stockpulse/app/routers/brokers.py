"""Broker referral page and affiliate redirects."""

import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.services.cache import redis_cache

logger = logging.getLogger(__name__)
router = APIRouter()

templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))

# Affiliate links configuration
# Replace these with your actual affiliate links when you sign up for each program
AFFILIATE_LINKS = {
    "robinhood": "https://join.robinhood.com/YOUR_REFERRAL_CODE",
    "webull": "https://a.]webull.com/YOUR_AFFILIATE_ID",
    "fidelity": "https://www.fidelity.com/?ccsource=YOUR_AFFILIATE_ID",
    "schwab": "https://www.schwab.com/?src=YOUR_AFFILIATE_ID",
    "ibkr": "https://www.interactivebrokers.com/?src=stockpulse",
    "etrade": "https://us.etrade.com/home?sr_id=YOUR_AFFILIATE_ID",
}

# Fallback URLs (non-affiliate) - used until you set up affiliate accounts
FALLBACK_URLS = {
    "robinhood": "https://robinhood.com",
    "webull": "https://webull.com",
    "fidelity": "https://fidelity.com",
    "schwab": "https://schwab.com",
    "ibkr": "https://interactivebrokers.com",
    "etrade": "https://etrade.com",
}


@router.get("/brokers", response_class=HTMLResponse)
async def brokers_page(request: Request):
    """Render the broker comparison page."""
    return templates.TemplateResponse(request, "brokers.html", {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M UTC")
    })


@router.get("/go/{broker}")
async def affiliate_redirect(broker: str, request: Request):
    """Redirect to broker affiliate link and track the click."""
    broker = broker.lower()

    # Track click count in Redis
    cache_key = f"affiliate_clicks:{broker}"
    try:
        current = redis_cache.get(cache_key) or 0
        redis_cache.set(cache_key, current + 1, ttl=86400 * 365)  # Keep for 1 year
    except Exception:
        pass  # Don't fail redirect if tracking fails

    # Log the click
    logger.info("Affiliate click: %s from %s", broker, request.client.host if request.client else "unknown")

    # Get affiliate link or fallback
    # Use fallback until you configure your real affiliate links
    affiliate_url = FALLBACK_URLS.get(broker)

    # Check if we have a real affiliate link configured (not placeholder)
    configured_link = AFFILIATE_LINKS.get(broker, "")
    if configured_link and "YOUR_" not in configured_link:
        affiliate_url = configured_link

    if not affiliate_url:
        affiliate_url = "https://stockpulse.news/brokers"

    return RedirectResponse(url=affiliate_url, status_code=302)

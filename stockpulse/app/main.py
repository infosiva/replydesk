from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.routers import (
    affiliates,
    alerts,
    auth,
    brokers,
    chat,
    compare,
    dashboard,
    internal,
    market,
    watchlist,
    webhooks,
)
from app.services.cache import redis_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize Redis connection if configured
    if settings.upstash_redis_rest_url:
        redis_cache.initialize()
    yield
    # Shutdown: nothing to clean up (Upstash Redis is HTTP-based)


app = FastAPI(
    title="StockPulse",
    description="AI-powered stock market dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

# Mount static files
static_dir = Path(__file__).parent / "static"
templates_dir = Path(__file__).parent / "templates"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
_templates = Jinja2Templates(directory=str(templates_dir))

# Routers
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(compare.router, prefix="/dashboard", tags=["compare"])
app.include_router(brokers.router, prefix="", tags=["brokers"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(market.router, prefix="/api/v1/market", tags=["market"])
app.include_router(watchlist.router, prefix="/api/v1/watchlist", tags=["watchlist"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])
app.include_router(internal.router, prefix="/api/v1/internal", tags=["internal"])
app.include_router(affiliates.router, prefix="/api/v1/affiliates", tags=["affiliates"])


@app.get("/", response_class=HTMLResponse)
async def landing(request: Request):
    """Content-rich landing page for SEO and AdSense."""
    return _templates.TemplateResponse(request, "landing.html", {})


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ads.txt")
async def ads_txt():
    """Serve ads.txt for Google AdSense verification."""
    return FileResponse(str(static_dir / "ads.txt"), media_type="text/plain")

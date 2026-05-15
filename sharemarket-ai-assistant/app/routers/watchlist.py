"""Watchlist API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user
from app.services.dashboard_data import get_batch_prices_sync
from app.services.watchlist import (
    add_to_watchlist,
    get_user_watchlist,
    remove_from_watchlist,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class WatchlistAdd(BaseModel):
    symbol: str


@router.get("")
async def list_watchlist(user: dict = Depends(get_current_user)):
    """Get user's watchlist with current prices."""
    watchlist = get_user_watchlist(user["id"])
    symbols = [item["symbol"] for item in watchlist]

    if symbols:
        prices = get_batch_prices_sync(symbols)
        for item in watchlist:
            price_data = prices.get(item["symbol"], {})
            item["price"] = price_data.get("price")
            item["change"] = price_data.get("change")
            item["change_pct"] = price_data.get("change_pct")

    return {"watchlist": watchlist}


@router.post("")
async def add_stock(
    body: WatchlistAdd,
    user: dict = Depends(get_current_user),
):
    """Add a stock to watchlist."""
    result = add_to_watchlist(user["id"], body.symbol)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to add"))
    return result


@router.delete("/{symbol}")
async def remove_stock(
    symbol: str,
    user: dict = Depends(get_current_user),
):
    """Remove a stock from watchlist."""
    result = remove_from_watchlist(user["id"], symbol)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to remove"))
    return result

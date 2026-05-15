"""Watchlist service for managing user stock watchlists."""

import logging

from app.services.supabase_client import get_supabase_service_client

logger = logging.getLogger(__name__)


def get_user_watchlist(user_id: str) -> list[dict]:
    """Get all stocks in user's watchlist."""
    client = get_supabase_service_client()
    result = (
        client.table("watchlists")
        .select("*")
        .eq("user_id", user_id)
        .order("added_at", desc=True)
        .execute()
    )
    return result.data or []


def add_to_watchlist(user_id: str, symbol: str) -> dict:
    """Add a stock to user's watchlist."""
    client = get_supabase_service_client()
    try:
        result = (
            client.table("watchlists")
            .insert({
                "user_id": user_id,
                "symbol": symbol.upper(),
            })
            .execute()
        )
        return {"success": True, "data": result.data[0] if result.data else None}
    except Exception as e:
        if "duplicate" in str(e).lower():
            return {"success": False, "error": "Stock already in watchlist"}
        logger.exception("Failed to add to watchlist")
        return {"success": False, "error": str(e)}


def remove_from_watchlist(user_id: str, symbol: str) -> dict:
    """Remove a stock from user's watchlist."""
    client = get_supabase_service_client()
    try:
        result = (
            client.table("watchlists")
            .delete()
            .eq("user_id", user_id)
            .eq("symbol", symbol.upper())
            .execute()
        )
        return {"success": True, "deleted": len(result.data) if result.data else 0}
    except Exception as e:
        logger.exception("Failed to remove from watchlist")
        return {"success": False, "error": str(e)}


def is_in_watchlist(user_id: str, symbol: str) -> bool:
    """Check if a stock is in user's watchlist."""
    client = get_supabase_service_client()
    result = (
        client.table("watchlists")
        .select("id")
        .eq("user_id", user_id)
        .eq("symbol", symbol.upper())
        .maybe_single()
        .execute()
    )
    return result.data is not None

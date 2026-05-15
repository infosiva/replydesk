"""Alerts service for managing user price alerts."""

import logging
from datetime import UTC, datetime
from typing import Literal

from app.services.supabase_client import get_supabase_service_client

logger = logging.getLogger(__name__)

AlertType = Literal["price", "percent_change", "volume", "rsi", "macd_cross"]
Direction = Literal["above", "below"]


def get_user_alerts(user_id: str, active_only: bool = True) -> list[dict]:
    """Get all alerts for a user."""
    client = get_supabase_service_client()
    query = (
        client.table("alerts")
        .select("*")
        .eq("user_id", user_id)
    )
    if active_only:
        query = query.eq("active", True)
    result = query.order("created_at", desc=True).execute()
    return result.data or []


def create_alert(
    user_id: str,
    symbol: str,
    threshold: float,
    direction: Direction,
    alert_type: AlertType = "price",
    time_frame: str = "1d",
    notification_channels: list[str] | None = None,
) -> dict:
    """Create a new price alert."""
    client = get_supabase_service_client()
    channels = notification_channels or ["in_app"]
    try:
        result = (
            client.table("alerts")
            .insert({
                "user_id": user_id,
                "symbol": symbol.upper(),
                "threshold": threshold,
                "direction": direction,
                "alert_type": alert_type,
                "time_frame": time_frame,
                "notification_channels": channels,
                "active": True,
            })
            .execute()
        )
        return {"success": True, "data": result.data[0] if result.data else None}
    except Exception as e:
        logger.exception("Failed to create alert")
        return {"success": False, "error": str(e)}


def delete_alert(user_id: str, alert_id: str) -> dict:
    """Delete an alert."""
    client = get_supabase_service_client()
    try:
        result = (
            client.table("alerts")
            .delete()
            .eq("id", alert_id)
            .eq("user_id", user_id)
            .execute()
        )
        return {"success": True, "deleted": len(result.data) if result.data else 0}
    except Exception as e:
        logger.exception("Failed to delete alert")
        return {"success": False, "error": str(e)}


def deactivate_alert(alert_id: str) -> dict:
    """Deactivate an alert (used when triggered)."""
    client = get_supabase_service_client()
    try:
        (
            client.table("alerts")
            .update({"active": False})
            .eq("id", alert_id)
            .execute()
        )
        return {"success": True}
    except Exception as e:
        logger.exception("Failed to deactivate alert")
        return {"success": False, "error": str(e)}


def get_all_active_alerts() -> list[dict]:
    """Get all active alerts (for checking by n8n/cron)."""
    client = get_supabase_service_client()
    result = (
        client.table("alerts")
        .select("*")
        .eq("active", True)
        .execute()
    )
    return result.data or []


def log_alert_trigger(
    alert_id: str,
    user_id: str,
    symbol: str,
    alert_type: str,
    condition_met: str,
    price_at_trigger: float | None = None,
) -> dict:
    """Log an alert trigger to the alert_history table."""
    client = get_supabase_service_client()
    try:
        result = (
            client.table("alert_history")
            .insert({
                "alert_id": alert_id,
                "user_id": user_id,
                "symbol": symbol.upper(),
                "alert_type": alert_type,
                "condition_met": condition_met,
                "price_at_trigger": price_at_trigger,
            })
            .execute()
        )
        return {"success": True, "data": result.data[0] if result.data else None}
    except Exception as e:
        logger.exception("Failed to log alert trigger")
        return {"success": False, "error": str(e)}


def get_user_alert_history(user_id: str, limit: int = 50) -> list[dict]:
    """Get alert trigger history for a user."""
    client = get_supabase_service_client()
    result = (
        client.table("alert_history")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def mark_alert_triggered(alert_id: str) -> dict:
    """Mark an alert as triggered and update triggered_at timestamp."""
    client = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    try:
        client.table("alerts").update({
            "triggered_at": now,
        }).eq("id", alert_id).execute()
        return {"success": True}
    except Exception as e:
        logger.exception("Failed to mark alert triggered")
        return {"success": False, "error": str(e)}

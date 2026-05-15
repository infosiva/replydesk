"""Price alerts API endpoints."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user
from app.services.alerts import (
    create_alert,
    delete_alert,
    get_user_alert_history,
    get_user_alerts,
)

logger = logging.getLogger(__name__)

router = APIRouter()

AlertType = Literal["price", "percent_change", "volume", "rsi", "macd_cross"]


class AlertCreate(BaseModel):
    symbol: str
    threshold: float
    direction: Literal["above", "below"]
    alert_type: AlertType = "price"
    time_frame: str = "1d"
    notification_channels: list[str] = ["in_app"]


class AlertHistoryItem(BaseModel):
    id: str
    alert_id: str | None
    symbol: str
    alert_type: str
    condition_met: str
    price_at_trigger: float | None
    created_at: str


@router.get("")
async def list_alerts(
    active_only: bool = True,
    user: dict = Depends(get_current_user),
):
    """Get user's price alerts."""
    alerts = get_user_alerts(user["id"], active_only=active_only)
    return {"alerts": alerts}


@router.get("/history")
async def get_alert_history(
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """Get alert trigger history for the user."""
    history = get_user_alert_history(user["id"], limit=limit)
    return {"history": history}


@router.post("")
async def create_new_alert(
    body: AlertCreate,
    user: dict = Depends(get_current_user),
):
    """Create a new price alert."""
    result = create_alert(
        user_id=user["id"],
        symbol=body.symbol,
        threshold=body.threshold,
        direction=body.direction,
        alert_type=body.alert_type,
        time_frame=body.time_frame,
        notification_channels=body.notification_channels,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create alert"))
    return result


@router.delete("/{alert_id}")
async def remove_alert(
    alert_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a price alert."""
    result = delete_alert(user["id"], alert_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to delete alert"))
    return result

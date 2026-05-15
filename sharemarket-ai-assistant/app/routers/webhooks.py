import json
import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.notifications import send_alert_notification
from app.services.supabase_client import get_user_device_tokens, get_user_email

logger = logging.getLogger(__name__)

router = APIRouter()


class AlertWebhook(BaseModel):
    symbol: str
    price: float
    threshold: float
    direction: str  # "above" or "below"
    message: str | None = None


class EnhancedAlertWebhook(BaseModel):
    alert_id: str
    user_id: str
    symbol: str
    alert_type: str
    condition_met: str
    current_value: float
    threshold: float
    notification_channels: str  # JSON string of channels


@router.post("/n8n/alert")
async def n8n_alert(
    payload: AlertWebhook,
    x_webhook_secret: str = Header(...),
):
    """Receive alert notifications from n8n workflows (legacy)."""
    if x_webhook_secret != settings.n8n_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    # Process the alert (log it, could extend to push notifications, etc.)
    return {
        "status": "received",
        "symbol": payload.symbol,
        "price": payload.price,
        "alert": f"Price {payload.direction} {payload.threshold}",
    }


@router.post("/n8n/enhanced-alert")
async def n8n_enhanced_alert(
    payload: EnhancedAlertWebhook,
    x_webhook_secret: str = Header(...),
):
    """Receive enhanced alert notifications from n8n and send to users."""
    if x_webhook_secret != settings.n8n_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    # Parse notification channels
    try:
        channels = json.loads(payload.notification_channels)
    except json.JSONDecodeError:
        channels = ["in_app"]

    # Get user email and device tokens
    user_email = get_user_email(payload.user_id)
    device_tokens = get_user_device_tokens(payload.user_id)

    # Send notifications
    results = {}
    if user_email:
        results = await send_alert_notification(
            user_email=user_email,
            symbol=payload.symbol,
            alert_type=payload.alert_type,
            condition=payload.condition_met,
            current_value=payload.current_value,
            channels=channels,
            device_token=device_tokens[0] if device_tokens else None,
        )
    else:
        logger.warning("Could not find email for user %s", payload.user_id)

    return {
        "status": "processed",
        "alert_id": payload.alert_id,
        "symbol": payload.symbol,
        "notification_results": results,
    }

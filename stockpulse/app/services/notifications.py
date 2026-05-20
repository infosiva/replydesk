"""Notification service for email (SMTP) and push (Firebase) notifications."""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> dict:
    """Send an email via SMTP."""
    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP not configured, skipping email")
        return {"success": False, "error": "SMTP not configured"}

    def _send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.email_from or settings.smtp_user
        msg["To"] = to_email

        # Attach text version
        part1 = MIMEText(body_text, "plain")
        msg.attach(part1)

        # Attach HTML version if provided
        if body_html:
            part2 = MIMEText(body_html, "html")
            msg.attach(part2)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], [to_email], msg.as_string())

    try:
        await asyncio.to_thread(_send)
        logger.info("Email sent to %s: %s", to_email, subject)
        return {"success": True}
    except Exception as e:
        logger.exception("Failed to send email to %s", to_email)
        return {"success": False, "error": str(e)}


async def send_push_notification(
    device_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> dict:
    """Send a push notification via Firebase Cloud Messaging."""
    if not settings.fcm_server_key:
        logger.warning("FCM not configured, skipping push notification")
        return {"success": False, "error": "FCM not configured"}

    fcm_url = "https://fcm.googleapis.com/fcm/send"
    headers = {
        "Authorization": f"key={settings.fcm_server_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "to": device_token,
        "notification": {
            "title": title,
            "body": body,
        },
    }
    if data:
        payload["data"] = data

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(fcm_url, json=payload, headers=headers)
            if response.status_code == 200:
                logger.info("Push notification sent to %s", device_token[:20] + "...")
                return {"success": True}
            else:
                logger.error("FCM error: %s", response.text)
                return {"success": False, "error": response.text}
    except Exception as e:
        logger.exception("Failed to send push notification")
        return {"success": False, "error": str(e)}


async def send_alert_notification(
    user_email: str,
    symbol: str,
    alert_type: str,
    condition: str,
    current_value: float,
    channels: list[str] | None = None,
    device_token: str | None = None,
) -> dict:
    """Send an alert notification through configured channels."""
    channels = channels or ["in_app"]
    results = {}

    title = f"Alert: {symbol} {alert_type}"
    body = f"{symbol} {condition}. Current value: {current_value}"

    if "email" in channels and user_email:
        html_body = f"""
        <html>
        <body>
            <h2>Stock Alert Triggered</h2>
            <p><strong>Symbol:</strong> {symbol}</p>
            <p><strong>Alert Type:</strong> {alert_type}</p>
            <p><strong>Condition:</strong> {condition}</p>
            <p><strong>Current Value:</strong> {current_value}</p>
            <hr>
            <p><small>You received this alert because you set up an alert on StockPulse.</small></p>
        </body>
        </html>
        """
        results["email"] = await send_email(user_email, title, body, html_body)

    if "push" in channels and device_token:
        results["push"] = await send_push_notification(
            device_token,
            title,
            body,
            data={"symbol": symbol, "alert_type": alert_type},
        )

    # in_app notifications are stored in the alert_history table
    results["in_app"] = {"success": True, "note": "Stored in alert_history"}

    return results

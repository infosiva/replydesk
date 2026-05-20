"""Affiliate system API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.deps import get_current_user
from app.schemas.affiliates import (
    ReferralCodeResponse,
    ReferralListResponse,
    ReferralStats,
    RewardListResponse,
)
from app.services.affiliates import (
    get_or_create_referral_code,
    get_referral_stats,
    get_user_referrals,
    get_user_rewards,
)
from app.services.cache import redis_cache

logger = logging.getLogger(__name__)

router = APIRouter()


class TrackClickRequest(BaseModel):
    broker: str
    source: str = "unknown"


class ClickStats(BaseModel):
    broker: str
    clicks: int


@router.post("/track")
async def track_affiliate_click(req: TrackClickRequest, request: Request):
    """Track an affiliate link click (called from frontend)."""
    broker = req.broker.lower()
    cache_key = f"affiliate_clicks:{broker}"

    try:
        current = redis_cache.get(cache_key) or 0
        redis_cache.set(cache_key, current + 1, ttl=86400 * 365)
    except Exception as e:
        logger.warning("Failed to track click: %s", e)

    logger.info("Tracked click: %s from %s (source: %s)",
                broker, request.client.host if request.client else "unknown", req.source)

    return {"status": "ok"}


@router.get("/clicks")
async def get_click_stats():
    """Get affiliate click statistics (public endpoint for dashboard)."""
    brokers = ["robinhood", "webull", "fidelity", "schwab", "ibkr", "etrade"]
    stats = []

    for broker in brokers:
        cache_key = f"affiliate_clicks:{broker}"
        clicks = redis_cache.get(cache_key) or 0
        stats.append({"broker": broker, "clicks": clicks})

    # Sort by clicks descending
    stats.sort(key=lambda x: x["clicks"], reverse=True)

    total = sum(s["clicks"] for s in stats)
    return {"total_clicks": total, "by_broker": stats}


@router.get("/code", response_model=ReferralCodeResponse)
async def get_referral_code(user: dict = Depends(get_current_user)):
    """Get or generate the user's referral code."""
    result = get_or_create_referral_code(user["id"])
    if not result["success"]:
        error_msg = result.get("error", "Failed to get referral code")
        raise HTTPException(status_code=400, detail=error_msg)
    return ReferralCodeResponse(
        code=result["data"]["code"],
        created_at=result["data"].get("created_at"),
    )


@router.get("/stats", response_model=ReferralStats)
async def get_stats(user: dict = Depends(get_current_user)):
    """Get referral statistics for the current user."""
    stats = get_referral_stats(user["id"])
    return ReferralStats(**stats)


@router.get("/referrals", response_model=ReferralListResponse)
async def list_referrals(user: dict = Depends(get_current_user)):
    """Get all referrals made by the current user."""
    referrals = get_user_referrals(user["id"])
    formatted = []
    for r in referrals:
        referred_info = r.get("referred")
        formatted.append({
            "id": r["id"],
            "referred_email": referred_info.get("email") if referred_info else None,
            "status": r["status"],
            "created_at": r["created_at"],
            "activated_at": r.get("activated_at"),
        })
    return ReferralListResponse(referrals=formatted)


@router.get("/rewards", response_model=RewardListResponse)
async def list_rewards(user: dict = Depends(get_current_user)):
    """Get reward history for the current user."""
    rewards = get_user_rewards(user["id"])
    total_pending = sum(r["amount"] for r in rewards if r["status"] == "pending")
    total_paid = sum(r["amount"] for r in rewards if r["status"] == "paid")

    formatted = [
        {
            "id": r["id"],
            "referral_id": r.get("referral_id"),
            "reward_type": r["reward_type"],
            "amount": r["amount"],
            "status": r["status"],
            "created_at": r["created_at"],
        }
        for r in rewards
    ]

    return RewardListResponse(
        rewards=formatted,
        total_pending=total_pending,
        total_paid=total_paid,
    )

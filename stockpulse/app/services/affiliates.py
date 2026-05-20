"""Affiliates service for managing referral codes, tracking, and rewards."""

import logging
import secrets
import string
from datetime import UTC, datetime

from app.config import settings
from app.services.supabase_client import get_supabase_service_client

logger = logging.getLogger(__name__)


def generate_referral_code(length: int = 8) -> str:
    """Generate a unique referral code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def get_or_create_referral_code(user_id: str) -> dict:
    """Get existing referral code or create a new one for the user."""
    client = get_supabase_service_client()

    # Check if user already has a referral code
    try:
        existing = (
            client.table("referral_codes")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.warning("Error checking existing referral code: %s", e)
        existing = None

    if existing and existing.data:
        return {"success": True, "data": existing.data}

    # Generate unique code
    for _ in range(10):  # Try up to 10 times to get a unique code
        code = generate_referral_code()
        try:
            result = (
                client.table("referral_codes")
                .insert({"user_id": user_id, "code": code})
                .execute()
            )
            return {"success": True, "data": result.data[0] if result.data else None}
        except Exception as e:
            if "duplicate" not in str(e).lower():
                logger.exception("Failed to create referral code")
                return {"success": False, "error": str(e)}

    return {"success": False, "error": "Could not generate unique code"}


def get_referral_code_by_code(code: str) -> dict | None:
    """Look up a referral code."""
    client = get_supabase_service_client()
    result = (
        client.table("referral_codes")
        .select("*")
        .eq("code", code.upper())
        .maybe_single()
        .execute()
    )
    return result.data


def create_referral(referrer_id: str, referred_id: str, referral_code: str) -> dict:
    """Create a new referral record when a user signs up with a referral code."""
    client = get_supabase_service_client()
    try:
        result = (
            client.table("referrals")
            .insert({
                "referrer_id": referrer_id,
                "referred_id": referred_id,
                "referral_code": referral_code.upper(),
                "status": "pending",
            })
            .execute()
        )
        return {"success": True, "data": result.data[0] if result.data else None}
    except Exception as e:
        if "duplicate" in str(e).lower():
            return {"success": False, "error": "User already referred"}
        logger.exception("Failed to create referral")
        return {"success": False, "error": str(e)}


def activate_referral(referred_id: str) -> dict:
    """Activate a referral when the referred user completes a qualifying action."""
    client = get_supabase_service_client()
    try:
        # Find the pending referral
        referral = (
            client.table("referrals")
            .select("*")
            .eq("referred_id", referred_id)
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not referral.data:
            return {"success": False, "error": "No pending referral found"}

        # Update referral to active
        now = datetime.now(UTC).isoformat()
        client.table("referrals").update({
            "status": "active",
            "activated_at": now,
        }).eq("id", referral.data["id"]).execute()

        # Create reward for the referrer
        commission_amount = settings.affiliate_commission_percent
        client.table("affiliate_rewards").insert({
            "user_id": referral.data["referrer_id"],
            "referral_id": referral.data["id"],
            "reward_type": "commission",
            "amount": commission_amount,
            "status": "pending",
        }).execute()

        return {"success": True, "referral_id": referral.data["id"]}
    except Exception as e:
        logger.exception("Failed to activate referral")
        return {"success": False, "error": str(e)}


def get_user_referrals(user_id: str) -> list[dict]:
    """Get all referrals made by a user."""
    client = get_supabase_service_client()
    result = (
        client.table("referrals")
        .select("*, referred:referred_id(email)")
        .eq("referrer_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_referral_stats(user_id: str) -> dict:
    """Get referral statistics for a user."""
    client = get_supabase_service_client()

    # Get referrals
    referrals = (
        client.table("referrals")
        .select("status")
        .eq("referrer_id", user_id)
        .execute()
    )

    referral_data = referrals.data or []
    total = len(referral_data)
    active = sum(1 for r in referral_data if r["status"] == "active")
    pending = sum(1 for r in referral_data if r["status"] == "pending")

    # Get rewards
    rewards = (
        client.table("affiliate_rewards")
        .select("amount, status")
        .eq("user_id", user_id)
        .execute()
    )

    reward_data = rewards.data or []
    total_earnings = sum(r["amount"] for r in reward_data if r["status"] == "paid")
    pending_earnings = sum(r["amount"] for r in reward_data if r["status"] == "pending")

    return {
        "total_referrals": total,
        "active_referrals": active,
        "pending_referrals": pending,
        "total_earnings": total_earnings,
        "pending_earnings": pending_earnings,
    }


def get_user_rewards(user_id: str) -> list[dict]:
    """Get all rewards for a user."""
    client = get_supabase_service_client()
    result = (
        client.table("affiliate_rewards")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def mark_reward_paid(reward_id: str) -> dict:
    """Mark a reward as paid (called after Stripe payout)."""
    client = get_supabase_service_client()
    try:
        client.table("affiliate_rewards").update({
            "status": "paid",
        }).eq("id", reward_id).execute()
        return {"success": True}
    except Exception as e:
        logger.exception("Failed to mark reward as paid")
        return {"success": False, "error": str(e)}

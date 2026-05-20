"""Pydantic models for affiliate system."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ReferralCodeResponse(BaseModel):
    code: str
    created_at: datetime | None = None


class ReferralStats(BaseModel):
    total_referrals: int
    active_referrals: int
    pending_referrals: int
    total_earnings: float
    pending_earnings: float


class Referral(BaseModel):
    id: str
    referred_email: str | None = None
    status: Literal["pending", "active", "rewarded"]
    created_at: datetime
    activated_at: datetime | None = None


class ReferralListResponse(BaseModel):
    referrals: list[Referral]


class Reward(BaseModel):
    id: str
    referral_id: str | None = None
    reward_type: Literal["signup_bonus", "commission", "milestone"]
    amount: float
    status: Literal["pending", "paid", "cancelled"]
    created_at: datetime


class RewardListResponse(BaseModel):
    rewards: list[Reward]
    total_pending: float
    total_paid: float

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, SignupRequest
from app.services import supabase_client as sb
from app.services.affiliates import create_referral, get_referral_code_by_code

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    try:
        result = sb.signup(req.email, req.password)
        session = result.session
        if session is None:
            # Supabase may require email confirmation
            raise HTTPException(
                status_code=200,
                detail="Check your email for a confirmation link",
            )

        # Track referral if a referral code was provided
        if req.referral_code:
            referral_code_data = get_referral_code_by_code(req.referral_code)
            if referral_code_data:
                # Don't let users refer themselves
                if referral_code_data["user_id"] != result.user.id:
                    create_result = create_referral(
                        referrer_id=referral_code_data["user_id"],
                        referred_id=result.user.id,
                        referral_code=req.referral_code,
                    )
                    if not create_result["success"]:
                        logger.warning("Failed to create referral: %s", create_result.get("error"))
            else:
                logger.warning("Invalid referral code used: %s", req.referral_code)

        return AuthResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            user_id=result.user.id,
            email=result.user.email,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    try:
        result = sb.login(req.email, req.password)
        session = result.session
        return AuthResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            user_id=result.user.id,
            email=result.user.email,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/refresh", response_model=AuthResponse)
async def refresh(req: RefreshRequest):
    try:
        result = sb.refresh_token(req.refresh_token)
        session = result.session
        return AuthResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            user_id=result.user.id,
            email=result.user.email,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.agent import run_agent
from app.services.cache import TTL_SESSION, redis_cache
from app.services.supabase_client import get_conversation, save_conversation

router = APIRouter()


class PublicChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class PublicChatResponse(BaseModel):
    response: str
    session_id: str


@router.post("/public", response_model=PublicChatResponse)
async def public_chat(req: PublicChatRequest):
    """Public chat endpoint for guests (no auth required)."""
    session_id = req.session_id or str(uuid.uuid4())

    # Load session history from cache
    history = None
    cache_key = f"public_chat:{session_id}"
    cached = redis_cache.get(cache_key)
    if cached:
        history = cached

    try:
        result = await run_agent(req.message, conversation_history=history)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}") from exc

    # Cache session for 30 minutes
    redis_cache.set(cache_key, result["messages"], ttl=1800)

    return PublicChatResponse(
        response=result["response"],
        session_id=session_id,
    )


def _serialize_messages(messages: list) -> list:
    """Convert messages to JSON-serializable format for storage."""
    serialized = []
    for msg in messages:
        if isinstance(msg.get("content"), list):
            # Handle content blocks (tool results or assistant content blocks)
            content_items = []
            for item in msg["content"]:
                if hasattr(item, "model_dump"):
                    content_items.append(item.model_dump())
                elif isinstance(item, dict):
                    content_items.append(item)
                else:
                    content_items.append(str(item))
            serialized.append({"role": msg["role"], "content": content_items})
        else:
            serialized.append(msg)
    return serialized


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    conversation_id = req.conversation_id or str(uuid.uuid4())

    # Load conversation history
    history = None
    if req.conversation_id:
        # Try cache first
        cache_key = f"conv:{conversation_id}"
        cached = redis_cache.get(cache_key)
        if cached:
            history = cached
        else:
            # Fall back to database
            conv = get_conversation(conversation_id)
            if conv and conv.get("user_id") == user["id"]:
                history = conv.get("messages", [])

    try:
        result = await run_agent(req.message, conversation_history=history, user_id=user["id"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}") from exc

    # Persist conversation
    serialized = _serialize_messages(result["messages"])

    # Cache for active session
    redis_cache.set(f"conv:{conversation_id}", serialized, ttl=TTL_SESSION)

    # Persist to database
    try:
        save_conversation(user["id"], conversation_id, serialized)
    except Exception:
        pass  # Don't fail the request if DB save fails

    return ChatResponse(
        response=result["response"],
        conversation_id=conversation_id,
    )

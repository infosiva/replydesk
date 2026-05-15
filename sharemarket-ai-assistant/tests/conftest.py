import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def mock_supabase(monkeypatch):
    """Mock Supabase client to avoid real API calls."""
    mock_module = MagicMock()
    mock_module.create_client.return_value = MagicMock()
    monkeypatch.setitem(sys.modules, "supabase", mock_module)

    # Also patch the service module's global clients
    import app.services.supabase_client as sb_mod

    monkeypatch.setattr(sb_mod, "_client", None)
    monkeypatch.setattr(sb_mod, "_service_client", None)

    with patch.object(sb_mod, "create_client", return_value=MagicMock()):
        yield


@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis cache to be a no-op."""
    from app.services.cache import redis_cache

    with (
        patch.object(redis_cache, "_client", None),
        patch.object(redis_cache, "get", return_value=None),
        patch.object(redis_cache, "set", return_value=None),
        patch.object(redis_cache, "delete", return_value=None),
    ):
        yield redis_cache


@pytest.fixture
def client():
    """FastAPI test client with mocked external services."""
    from app.main import app

    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Fake auth headers for protected endpoints."""
    return {"Authorization": "Bearer test-token-123"}

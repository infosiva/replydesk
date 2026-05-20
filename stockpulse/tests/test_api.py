from unittest.mock import patch


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@patch("app.routers.market.market_data.get_stock_price")
def test_market_price(mock_get_price, client):
    mock_get_price.return_value = {
        "symbol": "AAPL",
        "price": 150.0,
        "previous_close": 148.5,
        "open": 149.0,
        "day_high": 151.0,
        "day_low": 148.0,
        "volume": 1000000,
        "market_cap": 2500000000000,
        "currency": "USD",
    }

    response = client.get("/api/v1/market/price/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["price"] == 150.0


@patch("app.routers.market.market_data.get_company_info")
def test_market_info(mock_get_info, client):
    mock_get_info.return_value = {
        "symbol": "AAPL",
        "shortName": "Apple Inc.",
        "sector": "Technology",
    }

    response = client.get("/api/v1/market/info/AAPL")
    assert response.status_code == 200
    assert response.json()["shortName"] == "Apple Inc."


def test_chat_requires_auth(client):
    response = client.post("/api/v1/chat", json={"message": "hello"})
    assert response.status_code in (401, 403)  # No auth header


@patch("app.routers.webhooks.settings")
def test_webhook_requires_secret(mock_settings, client):
    mock_settings.n8n_webhook_secret = "correct-secret"

    # Wrong secret
    response = client.post(
        "/api/v1/webhooks/n8n/alert",
        json={
            "symbol": "AAPL",
            "price": 150.0,
            "threshold": 145.0,
            "direction": "above",
        },
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert response.status_code == 403


@patch("app.routers.webhooks.settings")
def test_webhook_valid(mock_settings, client):
    mock_settings.n8n_webhook_secret = "correct-secret"

    response = client.post(
        "/api/v1/webhooks/n8n/alert",
        json={
            "symbol": "AAPL",
            "price": 150.0,
            "threshold": 145.0,
            "direction": "above",
        },
        headers={"X-Webhook-Secret": "correct-secret"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "received"

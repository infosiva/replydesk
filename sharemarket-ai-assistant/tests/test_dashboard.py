from unittest.mock import AsyncMock, patch


@patch("app.routers.dashboard.get_dashboard_data", new_callable=AsyncMock)
def test_dashboard_returns_html(mock_get_data, client):
    """Test that dashboard endpoint returns HTML 200."""
    mock_get_data.return_value = {
        "indices": [
            {
                "symbol": "^GSPC", "name": "S&P 500",
                "price": 5000.0, "change": 50.0, "change_pct": 1.0,
            }
        ],
        "gainers": [{"symbol": "AAPL", "price": 180.0, "change": 5.0, "change_pct": 2.8}],
        "losers": [{"symbol": "TSLA", "price": 200.0, "change": -10.0, "change_pct": -4.8}],
        "sectors": [
            {
                "symbol": "XLK", "sector": "Technology",
                "price": 200.0, "change": 2.0, "change_pct": 1.0,
            }
        ],
        "news": [
            {
                "title": "Market Update", "publisher": "Reuters",
                "link": "https://example.com", "related": "AAPL",
            }
        ],
        "updated_at": "2024-01-01 12:00:00",
    }

    response = client.get("/dashboard/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "S&amp;P 500" in response.text or "S&P 500" in response.text
    assert "Market Indices" in response.text


@patch("app.routers.dashboard.get_dashboard_data", new_callable=AsyncMock)
def test_dashboard_graceful_error_handling(mock_get_data, client):
    """Test that dashboard handles errors gracefully."""
    mock_get_data.side_effect = Exception("API Error")

    response = client.get("/dashboard/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Failed to load market data" in response.text


@patch("app.routers.dashboard.get_dashboard_data", new_callable=AsyncMock)
def test_dashboard_with_empty_data(mock_get_data, client):
    """Test dashboard renders correctly with empty data."""
    mock_get_data.return_value = {
        "indices": [],
        "gainers": [],
        "losers": [],
        "sectors": [],
        "news": [],
        "updated_at": None,
    }

    response = client.get("/dashboard/")
    assert response.status_code == 200
    assert "No index data available" in response.text or "No data available" in response.text

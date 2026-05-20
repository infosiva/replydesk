from unittest.mock import patch

import pandas as pd


@patch("app.services.dashboard_data.yf.download")
def test_get_batch_prices_sync(mock_download):
    """Test batch price fetching."""
    from app.services.dashboard_data import get_batch_prices_sync

    # Create mock DataFrame with MultiIndex columns for multiple tickers
    dates = pd.date_range("2024-01-01", periods=2, freq="D")
    data = {
        ("AAPL", "Close"): [175.0, 180.0],
        ("MSFT", "Close"): [400.0, 405.0],
    }
    mock_df = pd.DataFrame(data, index=dates)
    mock_download.return_value = mock_df

    result = get_batch_prices_sync(["AAPL", "MSFT"])

    assert "AAPL" in result
    assert "MSFT" in result
    assert result["AAPL"]["price"] == 180.0
    assert result["AAPL"]["change_pct"] == round((180.0 - 175.0) / 175.0 * 100, 2)
    assert result["MSFT"]["price"] == 405.0


@patch("app.services.dashboard_data.yf.download")
def test_get_batch_prices_sync_empty_symbols(mock_download):
    """Test batch price fetching with empty symbol list."""
    from app.services.dashboard_data import get_batch_prices_sync

    result = get_batch_prices_sync([])
    assert result == {}
    mock_download.assert_not_called()


@patch("app.services.dashboard_data.yf.download")
def test_get_batch_prices_sync_handles_error(mock_download):
    """Test batch price fetching handles errors gracefully."""
    from app.services.dashboard_data import get_batch_prices_sync

    mock_download.side_effect = Exception("API Error")

    result = get_batch_prices_sync(["AAPL"])
    assert result == {}


@patch("app.services.dashboard_data.get_batch_prices_sync")
def test_get_top_movers_sync(mock_batch_prices):
    """Test top movers calculation."""
    from app.services.dashboard_data import get_top_movers_sync

    mock_batch_prices.return_value = {
        "AAPL": {"symbol": "AAPL", "price": 180.0, "change": 5.0, "change_pct": 2.8},
        "MSFT": {"symbol": "MSFT", "price": 400.0, "change": 10.0, "change_pct": 2.5},
        "TSLA": {"symbol": "TSLA", "price": 200.0, "change": -10.0, "change_pct": -4.8},
        "AMZN": {"symbol": "AMZN", "price": 150.0, "change": -5.0, "change_pct": -3.2},
    }

    result = get_top_movers_sync(n=2)

    assert len(result["gainers"]) == 2
    assert result["gainers"][0]["symbol"] == "AAPL"  # Highest gainer
    assert result["gainers"][1]["symbol"] == "MSFT"

    assert len(result["losers"]) == 2
    assert result["losers"][0]["symbol"] == "TSLA"  # Biggest loser
    assert result["losers"][1]["symbol"] == "AMZN"


@patch("app.services.dashboard_data.get_batch_prices_sync")
def test_get_top_movers_sync_empty(mock_batch_prices):
    """Test top movers with no data."""
    from app.services.dashboard_data import get_top_movers_sync

    mock_batch_prices.return_value = {}

    result = get_top_movers_sync()
    assert result == {"gainers": [], "losers": []}


@patch("app.services.dashboard_data.get_batch_prices_sync")
def test_get_market_indices_sync(mock_batch_prices):
    """Test market indices fetching."""
    from app.services.dashboard_data import INDICES, get_market_indices_sync

    mock_batch_prices.return_value = {
        "^GSPC": {"symbol": "^GSPC", "price": 5000.0, "change": 50.0, "change_pct": 1.0},
        "^DJI": {"symbol": "^DJI", "price": 38000.0, "change": 200.0, "change_pct": 0.5},
    }

    result = get_market_indices_sync()

    # Should return all indices, with data for found ones
    assert len(result) == len(INDICES)

    sp500 = next((i for i in result if i["symbol"] == "^GSPC"), None)
    assert sp500 is not None
    assert sp500["name"] == "S&P 500"
    assert sp500["price"] == 5000.0


@patch("app.services.dashboard_data.get_batch_prices_sync")
def test_get_sector_performance_sync(mock_batch_prices):
    """Test sector performance fetching."""
    from app.services.dashboard_data import get_sector_performance_sync

    mock_batch_prices.return_value = {
        "XLK": {"symbol": "XLK", "price": 200.0, "change": 5.0, "change_pct": 2.5},
        "XLF": {"symbol": "XLF", "price": 40.0, "change": -1.0, "change_pct": -2.4},
    }

    result = get_sector_performance_sync()

    assert len(result) == 2
    # Should be sorted by change_pct descending
    assert result[0]["symbol"] == "XLK"
    assert result[0]["sector"] == "Technology"
    assert result[1]["symbol"] == "XLF"

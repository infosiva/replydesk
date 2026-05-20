from unittest.mock import MagicMock, patch

from app.services.market_data import (
    get_analyst_recommendations_sync,
    get_company_info_sync,
    get_stock_news_sync,
    get_stock_price_sync,
)


def _mock_fast_info():
    info = MagicMock()
    info.last_price = 150.0
    info.previous_close = 148.5
    info.open = 149.0
    info.day_high = 151.0
    info.day_low = 148.0
    info.last_volume = 1000000
    info.market_cap = 2500000000000
    info.currency = "USD"
    return info


@patch("app.services.market_data.yf.Ticker")
def test_get_stock_price(mock_ticker_cls):
    ticker = MagicMock()
    ticker.fast_info = _mock_fast_info()
    mock_ticker_cls.return_value = ticker

    result = get_stock_price_sync("AAPL")

    assert result["symbol"] == "AAPL"
    assert result["price"] == 150.0
    assert result["currency"] == "USD"
    assert result["volume"] == 1000000


@patch("app.services.market_data.yf.Ticker")
def test_get_company_info(mock_ticker_cls):
    ticker = MagicMock()
    ticker.info = {
        "shortName": "Apple Inc.",
        "sector": "Technology",
        "industry": "Consumer Electronics",
        "marketCap": 2500000000000,
        "trailingPE": 28.5,
        "currency": "USD",
    }
    mock_ticker_cls.return_value = ticker

    result = get_company_info_sync("AAPL")

    assert result["symbol"] == "AAPL"
    assert result["shortName"] == "Apple Inc."
    assert result["sector"] == "Technology"


@patch("app.services.market_data.yf.Ticker")
def test_get_analyst_recommendations_empty(mock_ticker_cls):
    ticker = MagicMock()
    ticker.recommendations = None
    mock_ticker_cls.return_value = ticker

    result = get_analyst_recommendations_sync("AAPL")

    assert result["symbol"] == "AAPL"
    assert result["recommendations"] == []


@patch("app.services.market_data.yf.Ticker")
def test_get_stock_news(mock_ticker_cls):
    ticker = MagicMock()
    ticker.news = [
        {
            "title": "Apple Reports Q4 Earnings",
            "publisher": "Reuters",
            "link": "https://example.com",
            "providerPublishTime": 1700000000,
            "type": "STORY",
        }
    ]
    mock_ticker_cls.return_value = ticker

    result = get_stock_news_sync("AAPL")

    assert result["symbol"] == "AAPL"
    assert len(result["news"]) == 1
    assert result["news"][0]["title"] == "Apple Reports Q4 Earnings"

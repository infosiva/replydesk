"""Portfolio analysis service for watchlist insights and analysis."""

import logging
from collections import defaultdict

from app.services.market_data import (
    get_company_info_sync,
    get_stock_news_sync,
    get_stock_price_sync,
)
from app.services.watchlist import get_user_watchlist

logger = logging.getLogger(__name__)


def get_watchlist_data(user_id: str) -> list[dict]:
    """Get watchlist with current prices and basic info."""
    watchlist = get_user_watchlist(user_id)
    if not watchlist:
        return []

    results = []
    for item in watchlist:
        symbol = item["symbol"]
        try:
            price_data = get_stock_price_sync(symbol)
            info_data = get_company_info_sync(symbol)

            # Calculate daily change
            prev_close = price_data.get("previous_close", 0)
            current = price_data.get("price", 0)
            change_pct = 0
            if prev_close and current:
                change_pct = round((current / prev_close - 1) * 100, 2)

            results.append({
                "symbol": symbol,
                "name": info_data.get("shortName") or info_data.get("longName"),
                "price": current,
                "previous_close": prev_close,
                "change_percent": change_pct,
                "sector": info_data.get("sector"),
                "industry": info_data.get("industry"),
                "market_cap": info_data.get("marketCap"),
                "added_at": item.get("added_at"),
            })
        except Exception as e:
            logger.warning("Error fetching data for %s: %s", symbol, e)
            results.append({
                "symbol": symbol,
                "error": str(e),
            })

    return results


def analyze_portfolio_diversification(watchlist_data: list[dict]) -> dict:
    """Analyze portfolio diversification by sector and industry."""
    sectors = defaultdict(list)
    industries = defaultdict(list)
    total_market_cap = 0
    market_caps = {}

    for item in watchlist_data:
        if item.get("error"):
            continue

        symbol = item["symbol"]
        sector = item.get("sector") or "Unknown"
        industry = item.get("industry") or "Unknown"
        market_cap = item.get("market_cap") or 0

        sectors[sector].append(symbol)
        industries[industry].append(symbol)
        market_caps[symbol] = market_cap
        total_market_cap += market_cap

    # Calculate sector allocation
    sector_allocation = {}
    for sector, symbols in sectors.items():
        sector_cap = sum(market_caps.get(s, 0) for s in symbols)
        sector_allocation[sector] = {
            "symbols": symbols,
            "count": len(symbols),
            "weight": round(sector_cap / total_market_cap * 100, 2) if total_market_cap > 0 else 0,
        }

    # Identify concentration risks
    concentration_warnings = []
    for sector, data in sector_allocation.items():
        if data["weight"] > 40:
            concentration_warnings.append(f"High concentration in {sector} ({data['weight']}%)")
        if data["count"] >= 3 and len(sectors) <= 2:
            concentration_warnings.append("Limited sector diversification")

    return {
        "total_positions": len([w for w in watchlist_data if not w.get("error")]),
        "sector_allocation": sector_allocation,
        "sector_count": len(sectors),
        "industry_count": len(industries),
        "concentration_warnings": concentration_warnings,
        "diversification_score": calculate_diversification_score(sectors, sector_allocation),
    }


def calculate_diversification_score(sectors: dict, sector_allocation: dict) -> int:
    """Calculate a diversification score from 0-100."""
    if not sector_allocation:
        return 0

    # Base score from number of sectors
    sector_count = len(sectors)
    if sector_count >= 10:
        base_score = 40
    elif sector_count >= 7:
        base_score = 30
    elif sector_count >= 5:
        base_score = 20
    elif sector_count >= 3:
        base_score = 10
    else:
        base_score = 0

    # Weight distribution score (penalize concentration)
    weights = [s["weight"] for s in sector_allocation.values()]
    max_weight = max(weights) if weights else 100
    if max_weight <= 25:
        weight_score = 60
    elif max_weight <= 35:
        weight_score = 45
    elif max_weight <= 50:
        weight_score = 30
    elif max_weight <= 70:
        weight_score = 15
    else:
        weight_score = 0

    return min(100, base_score + weight_score)


def get_watchlist_movers(watchlist_data: list[dict]) -> dict:
    """Identify top gainers and losers in the watchlist."""
    valid_data = [
        w for w in watchlist_data
        if not w.get("error") and w.get("change_percent") is not None
    ]

    if not valid_data:
        return {"gainers": [], "losers": []}

    sorted_by_change = sorted(valid_data, key=lambda x: x.get("change_percent", 0), reverse=True)

    return {
        "gainers": [
            {"symbol": w["symbol"], "change_percent": w["change_percent"], "price": w["price"]}
            for w in sorted_by_change[:3] if w.get("change_percent", 0) > 0
        ],
        "losers": [
            {"symbol": w["symbol"], "change_percent": w["change_percent"], "price": w["price"]}
            for w in sorted_by_change[-3:] if w.get("change_percent", 0) < 0
        ][::-1],  # Reverse to show biggest losers first
    }


def get_watchlist_news(user_id: str, max_per_symbol: int = 3) -> list[dict]:
    """Get recent news for all watchlist stocks."""
    watchlist = get_user_watchlist(user_id)
    if not watchlist:
        return []

    all_news = []
    for item in watchlist[:10]:  # Limit to first 10 symbols
        symbol = item["symbol"]
        try:
            news_data = get_stock_news_sync(symbol)
            for news in news_data.get("news", [])[:max_per_symbol]:
                news["symbol"] = symbol
                all_news.append(news)
        except Exception as e:
            logger.warning("Error fetching news for %s: %s", symbol, e)

    # Sort by published time
    all_news.sort(key=lambda x: x.get("published", 0), reverse=True)
    return all_news[:20]  # Return top 20 news items


def analyze_portfolio(user_id: str) -> dict:
    """Perform comprehensive portfolio analysis."""
    watchlist_data = get_watchlist_data(user_id)

    if not watchlist_data:
        return {
            "error": "No stocks in watchlist",
            "recommendation": "Add stocks to your watchlist to get portfolio analysis",
        }

    diversification = analyze_portfolio_diversification(watchlist_data)
    movers = get_watchlist_movers(watchlist_data)

    # Calculate overall performance
    total_change = sum(w.get("change_percent", 0) for w in watchlist_data if not w.get("error"))
    avg_change = total_change / len(watchlist_data) if watchlist_data else 0

    return {
        "positions": watchlist_data,
        "summary": {
            "total_positions": diversification["total_positions"],
            "average_daily_change": round(avg_change, 2),
            "diversification_score": diversification["diversification_score"],
        },
        "diversification": diversification,
        "movers": movers,
        "recommendations": generate_recommendations(diversification, movers),
    }


def generate_recommendations(diversification: dict, movers: dict) -> list[str]:
    """Generate actionable recommendations based on analysis."""
    recommendations = []

    # Diversification recommendations
    score = diversification.get("diversification_score", 0)
    if score < 30:
        recommendations.append("Consider diversifying across more sectors to reduce risk")
    elif score < 60:
        recommendations.append(
            "Your portfolio has moderate diversification - consider adding different sectors"
        )

    # Concentration warnings
    for warning in diversification.get("concentration_warnings", []):
        recommendations.append(warning)

    # Sector-specific
    sector_alloc = diversification.get("sector_allocation", {})
    if "Technology" in sector_alloc and sector_alloc["Technology"].get("weight", 0) > 50:
        recommendations.append("Consider reducing technology sector exposure")

    # Performance-based
    if movers.get("losers") and len(movers["losers"]) >= 3:
        worst = movers["losers"][0]
        if worst.get("change_percent", 0) < -5:
            pct = abs(worst['change_percent'])
            recommendations.append(f"Review {worst['symbol']} - down {pct}% today")

    if not recommendations:
        recommendations.append("Your portfolio looks well-balanced")

    return recommendations


def compare_stocks(symbols: list[str]) -> dict:
    """Compare multiple stocks side by side."""
    if len(symbols) < 2:
        return {"error": "Need at least 2 symbols to compare"}
    if len(symbols) > 5:
        symbols = symbols[:5]  # Limit to 5 stocks

    comparison = []
    for symbol in symbols:
        try:
            price_data = get_stock_price_sync(symbol)
            info_data = get_company_info_sync(symbol)

            prev_close = price_data.get("previous_close", 0)
            current = price_data.get("price", 0)
            change_pct = round((current / prev_close - 1) * 100, 2) if prev_close else 0

            comparison.append({
                "symbol": symbol.upper(),
                "name": info_data.get("shortName"),
                "price": current,
                "change_percent": change_pct,
                "market_cap": info_data.get("marketCap"),
                "pe_ratio": info_data.get("trailingPE"),
                "forward_pe": info_data.get("forwardPE"),
                "dividend_yield": info_data.get("dividendYield"),
                "beta": info_data.get("beta"),
                "52_week_high": info_data.get("fiftyTwoWeekHigh"),
                "52_week_low": info_data.get("fiftyTwoWeekLow"),
                "sector": info_data.get("sector"),
                "industry": info_data.get("industry"),
            })
        except Exception as e:
            comparison.append({
                "symbol": symbol.upper(),
                "error": str(e),
            })

    # Determine winner in each category
    valid = [c for c in comparison if not c.get("error")]
    rankings = {}

    if valid:
        # Best daily performance
        best_perf = max(valid, key=lambda x: x.get("change_percent", float("-inf")))
        rankings["best_daily_performer"] = best_perf["symbol"]

        # Lowest P/E (value)
        with_pe = [v for v in valid if v.get("pe_ratio")]
        if with_pe:
            lowest_pe = min(with_pe, key=lambda x: x["pe_ratio"])
            rankings["best_value_pe"] = lowest_pe["symbol"]

        # Highest dividend yield
        with_div = [v for v in valid if v.get("dividend_yield")]
        if with_div:
            highest_div = max(with_div, key=lambda x: x["dividend_yield"])
            rankings["highest_dividend"] = highest_div["symbol"]

    return {
        "comparison": comparison,
        "rankings": rankings,
        "symbols_compared": len(comparison),
    }

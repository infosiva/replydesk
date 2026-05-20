import asyncio
import logging

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.services import market_data, supabase_client
from app.services.alerts import get_all_active_alerts, log_alert_trigger, mark_alert_triggered
from app.services.dashboard_data import get_chart_data, get_dashboard_data
from app.services.indicators import calculate_macd, calculate_rsi

logger = logging.getLogger(__name__)
router = APIRouter()

# Popular symbols to prefetch (can be extended)
PREFETCH_SYMBOLS = [
    # Market Indices
    "^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX",
    # Sector ETFs (for dashboard sectors)
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC",
    # Tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "AMD", "NFLX", "INTC",
    # Finance
    "JPM", "BAC", "WFC", "GS", "V", "MA",
    # Healthcare
    "JNJ", "PFE", "UNH", "ABBV",
    # Energy
    "XOM", "CVX", "COP",
    # Consumer & Others (dashboard watchlist)
    "HD", "KO", "MRK", "PEP", "AVGO", "WMT", "CSCO", "CRM", "ORCL", "DIS",
    # ETFs
    "SPY", "QQQ", "DIA", "IWM",
]


# Symbols that only have price data (no fundamentals)
INDEX_AND_ETF_SYMBOLS = {
    "^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX",  # Indices
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC",  # Sector ETFs
    "SPY", "QQQ", "DIA", "IWM",  # Major ETFs
}


async def _fetch_and_cache_symbol(symbol: str) -> dict:
    """Fetch all data for a symbol and cache in stock_cache table."""
    results = {"symbol": symbol, "status": "ok", "errors": []}
    is_index_or_etf = symbol in INDEX_AND_ETF_SYMBOLS or symbol.startswith("^")

    # Always fetch price data
    try:
        price_data = await market_data.get_stock_price(symbol)
        supabase_client.upsert_stock_cache(symbol, price_data=price_data)
    except Exception as e:
        results["errors"].append(f"price: {e}")

    # Only fetch fundamentals for regular stocks (not indices/ETFs)
    if not is_index_or_etf:
        try:
            info_data = await market_data.get_company_info(symbol)
            supabase_client.upsert_stock_cache(symbol, info_data=info_data)
        except Exception as e:
            results["errors"].append(f"info: {e}")

        try:
            news_data = await market_data.get_stock_news(symbol)
            supabase_client.upsert_stock_cache(symbol, news_data=news_data)
        except Exception as e:
            results["errors"].append(f"news: {e}")

        try:
            rec_data = await market_data.get_analyst_recommendations(symbol)
            supabase_client.upsert_stock_cache(symbol, recommendations_data=rec_data)
        except Exception as e:
            results["errors"].append(f"recommendations: {e}")

    if results["errors"]:
        results["status"] = "partial"

    return results


@router.post("/prefetch-stocks")
async def prefetch_stocks(
    x_webhook_secret: str = Header(...),
    symbols: list[str] | None = None,
):
    """
    Prefetch stock data for popular symbols and cache in Supabase.
    Called by n8n every 5 minutes.
    """
    if x_webhook_secret != settings.n8n_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    target_symbols = symbols if symbols else PREFETCH_SYMBOLS
    logger.info("Prefetching %d symbols", len(target_symbols))

    # Fetch in batches of 5 to avoid overwhelming yfinance
    results = []
    batch_size = 5
    for i in range(0, len(target_symbols), batch_size):
        batch = target_symbols[i:i + batch_size]
        batch_results = await asyncio.gather(
            *[_fetch_and_cache_symbol(s) for s in batch],
            return_exceptions=True,
        )
        for j, res in enumerate(batch_results):
            if isinstance(res, Exception):
                results.append({"symbol": batch[j], "status": "error", "error": str(res)})
            else:
                results.append(res)
        # Small delay between batches to be nice to Yahoo Finance
        if i + batch_size < len(target_symbols):
            await asyncio.sleep(1)

    success_count = sum(1 for r in results if r.get("status") == "ok")
    partial_count = sum(1 for r in results if r.get("status") == "partial")
    error_count = sum(1 for r in results if r.get("status") == "error")

    # Also prefetch dashboard data to warm up cache
    dashboard_status = "ok"
    try:
        logger.info("Prefetching dashboard data...")
        await get_dashboard_data()
        await get_chart_data("^GSPC", "1D")
        logger.info("Dashboard prefetch complete")
    except Exception as e:
        logger.error("Dashboard prefetch failed: %s", e)
        dashboard_status = "error"

    logger.info(
        "Prefetch complete: %d ok, %d partial, %d errors",
        success_count, partial_count, error_count,
    )

    return {
        "status": "complete",
        "total": len(results),
        "success": success_count,
        "partial": partial_count,
        "errors": error_count,
        "dashboard": dashboard_status,
        "details": results,
    }


async def _check_alert_condition(alert: dict) -> dict | None:
    """Check if an alert condition is met. Returns triggered alert info or None."""
    symbol = alert["symbol"]
    alert_type = alert.get("alert_type", "price")
    threshold = alert["threshold"]
    direction = alert["direction"]

    try:
        if alert_type == "price":
            # Simple price threshold
            price_data = await market_data.get_stock_price(symbol)
            current_price = price_data.get("price", 0)
            if direction == "above" and current_price >= threshold:
                return {
                    "alert_id": alert["id"],
                    "user_id": alert["user_id"],
                    "symbol": symbol,
                    "alert_type": alert_type,
                    "condition_met": f"Price {current_price} is above {threshold}",
                    "current_value": current_price,
                    "threshold": threshold,
                    "notification_channels": alert.get("notification_channels", ["in_app"]),
                }
            elif direction == "below" and current_price <= threshold:
                return {
                    "alert_id": alert["id"],
                    "user_id": alert["user_id"],
                    "symbol": symbol,
                    "alert_type": alert_type,
                    "condition_met": f"Price {current_price} is below {threshold}",
                    "current_value": current_price,
                    "threshold": threshold,
                    "notification_channels": alert.get("notification_channels", ["in_app"]),
                }

        elif alert_type == "percent_change":
            # Percentage change from previous close
            price_data = await market_data.get_stock_price(symbol)
            current_price = price_data.get("price", 0)
            prev_close = price_data.get("previous_close", 0)
            if prev_close > 0:
                pct_change = (current_price / prev_close - 1) * 100
                if direction == "above" and pct_change >= threshold:
                    return {
                        "alert_id": alert["id"],
                        "user_id": alert["user_id"],
                        "symbol": symbol,
                        "alert_type": alert_type,
                        "condition_met": f"Price changed {pct_change:.2f}% (above {threshold}%)",
                        "current_value": round(pct_change, 2),
                        "threshold": threshold,
                        "notification_channels": alert.get("notification_channels", ["in_app"]),
                    }
                elif direction == "below" and pct_change <= -threshold:
                    return {
                        "alert_id": alert["id"],
                        "user_id": alert["user_id"],
                        "symbol": symbol,
                        "alert_type": alert_type,
                        "condition_met": f"Price changed {pct_change:.2f}% (below -{threshold}%)",
                        "current_value": round(pct_change, 2),
                        "threshold": threshold,
                        "notification_channels": alert.get("notification_channels", ["in_app"]),
                    }

        elif alert_type == "volume":
            # Volume spike relative to average
            price_data = await market_data.get_stock_price(symbol)
            current_vol = price_data.get("volume", 0)
            # threshold is the multiplier (e.g., 2 means 2x average volume)
            history = await market_data.get_stock_history(symbol, period="1mo", interval="1d")
            if history.get("data") and len(history["data"]) > 5:
                avg_vol = sum(d.get("volume", 0) for d in history["data"][-10:-1]) / 9
                if avg_vol > 0 and current_vol >= avg_vol * threshold:
                    vol_ratio = current_vol / avg_vol
                    return {
                        "alert_id": alert["id"],
                        "user_id": alert["user_id"],
                        "symbol": symbol,
                        "alert_type": alert_type,
                        "condition_met": f"Volume {current_vol:,.0f} is {vol_ratio:.1f}x average",
                        "current_value": current_vol,
                        "threshold": threshold,
                        "notification_channels": alert.get("notification_channels", ["in_app"]),
                    }

        elif alert_type == "rsi":
            # RSI overbought/oversold
            history = await market_data.get_stock_history(symbol, period="1mo", interval="1d")
            if history.get("data") and len(history["data"]) >= 15:
                prices = [d["close"] for d in history["data"] if d.get("close")]
                rsi_values = calculate_rsi(prices, 14)
                current_rsi = rsi_values[-1] if rsi_values else None
                if current_rsi is not None:
                    # direction=above means RSI > threshold (overbought)
                    # direction=below means RSI < threshold (oversold)
                    channels = alert.get("notification_channels", ["in_app"])
                    if direction == "above" and current_rsi >= threshold:
                        return {
                            "alert_id": alert["id"],
                            "user_id": alert["user_id"],
                            "symbol": symbol,
                            "alert_type": alert_type,
                            "condition_met": f"RSI {current_rsi:.1f} >= {threshold} (overbought)",
                            "current_value": round(current_rsi, 2),
                            "threshold": threshold,
                            "notification_channels": channels,
                        }
                    elif direction == "below" and current_rsi <= threshold:
                        return {
                            "alert_id": alert["id"],
                            "user_id": alert["user_id"],
                            "symbol": symbol,
                            "alert_type": alert_type,
                            "condition_met": f"RSI {current_rsi:.1f} <= {threshold} (oversold)",
                            "current_value": round(current_rsi, 2),
                            "threshold": threshold,
                            "notification_channels": channels,
                        }

        elif alert_type == "macd_cross":
            # MACD crossover detection
            history = await market_data.get_stock_history(symbol, period="3mo", interval="1d")
            if history.get("data") and len(history["data"]) >= 35:
                prices = [d["close"] for d in history["data"] if d.get("close")]
                macd_data = calculate_macd(prices)
                macd_line = macd_data.get("macd", [])
                signal_line = macd_data.get("signal", [])
                if len(macd_line) >= 2 and len(signal_line) >= 2:
                    curr_macd = macd_line[-1]
                    curr_signal = signal_line[-1]
                    prev_macd = macd_line[-2]
                    prev_signal = signal_line[-2]
                    vals = [curr_macd, curr_signal, prev_macd, prev_signal]
                if all(v is not None for v in vals):
                        channels = alert.get("notification_channels", ["in_app"])
                        # Bullish crossover (direction=above)
                        bullish = prev_macd <= prev_signal and curr_macd > curr_signal
                        bearish = prev_macd >= prev_signal and curr_macd < curr_signal
                        if direction == "above" and bullish:
                            return {
                                "alert_id": alert["id"],
                                "user_id": alert["user_id"],
                                "symbol": symbol,
                                "alert_type": alert_type,
                                "condition_met": "MACD bullish crossover detected",
                                "current_value": round(curr_macd, 4),
                                "threshold": 0,
                                "notification_channels": channels,
                            }
                        # Bearish crossover (direction=below)
                        elif direction == "below" and bearish:
                            return {
                                "alert_id": alert["id"],
                                "user_id": alert["user_id"],
                                "symbol": symbol,
                                "alert_type": alert_type,
                                "condition_met": "MACD bearish crossover detected",
                                "current_value": round(curr_macd, 4),
                                "threshold": 0,
                                "notification_channels": channels,
                            }

    except Exception as e:
        logger.warning("Error checking alert %s for %s: %s", alert["id"], symbol, e)

    return None


@router.post("/check-alerts")
async def check_all_alerts(
    x_webhook_secret: str = Header(...),
):
    """
    Check all active alerts and return triggered ones.
    Called by n8n enhanced_alert_check workflow.
    """
    if x_webhook_secret != settings.n8n_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    alerts = get_all_active_alerts()
    logger.info("Checking %d active alerts", len(alerts))

    triggered_alerts = []
    for alert in alerts:
        result = await _check_alert_condition(alert)
        if result:
            triggered_alerts.append(result)
            # Log the trigger and mark the alert
            log_alert_trigger(
                alert_id=result["alert_id"],
                user_id=result["user_id"],
                symbol=result["symbol"],
                alert_type=result["alert_type"],
                condition_met=result["condition_met"],
                price_at_trigger=result.get("current_value"),
            )
            mark_alert_triggered(result["alert_id"])

    logger.info("Found %d triggered alerts", len(triggered_alerts))

    return {
        "checked": len(alerts),
        "triggered_count": len(triggered_alerts),
        "triggered_alerts": triggered_alerts,
    }

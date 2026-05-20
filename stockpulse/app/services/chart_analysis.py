"""Chart analysis service for AI-powered technical analysis."""

import logging

from app.services.indicators import (
    calculate_bollinger_bands,
    calculate_macd,
    calculate_rsi,
    calculate_sma,
)
from app.services.market_data import get_stock_history_sync, get_stock_price_sync

logger = logging.getLogger(__name__)


def detect_trend(prices: list[float], sma_short: list[float], sma_long: list[float]) -> dict:
    """Detect the overall trend based on moving averages."""
    if len(prices) < 2 or len(sma_short) < 2 or len(sma_long) < 2:
        return {"trend": "unknown", "strength": 0}

    # Get latest values
    current_price = prices[-1]
    short_ma = sma_short[-1]
    long_ma = sma_long[-1]

    if short_ma is None or long_ma is None:
        return {"trend": "unknown", "strength": 0}

    # Determine trend
    if short_ma > long_ma and current_price > short_ma:
        trend = "bullish"
        strength = min(100, int((short_ma / long_ma - 1) * 1000))
    elif short_ma < long_ma and current_price < short_ma:
        trend = "bearish"
        strength = min(100, int((1 - short_ma / long_ma) * 1000))
    else:
        trend = "sideways"
        strength = 50

    return {"trend": trend, "strength": strength}


def find_support_resistance(prices: list[float], window: int = 20) -> dict:
    """Find support and resistance levels using local minima/maxima."""
    if len(prices) < window:
        return {"support": [], "resistance": []}

    support_levels = []
    resistance_levels = []

    for i in range(window, len(prices) - window):
        # Local minimum (support)
        if prices[i] == min(prices[i - window : i + window + 1]):
            support_levels.append(round(prices[i], 2))
        # Local maximum (resistance)
        if prices[i] == max(prices[i - window : i + window + 1]):
            resistance_levels.append(round(prices[i], 2))

    # Remove duplicates and sort
    support_levels = sorted(set(support_levels))
    resistance_levels = sorted(set(resistance_levels), reverse=True)

    return {
        "support": support_levels[:3],  # Top 3 support levels
        "resistance": resistance_levels[:3],  # Top 3 resistance levels
    }


def detect_patterns(prices: list[float], volumes: list[float] | None = None) -> list[dict]:
    """Detect common chart patterns."""
    patterns = []

    if len(prices) < 10:
        return patterns

    # Double bottom detection (simplified)
    recent = prices[-20:] if len(prices) >= 20 else prices
    min_idx = recent.index(min(recent))
    if 5 < min_idx < len(recent) - 5:
        left_min = min(recent[:min_idx])
        right_min = min(recent[min_idx + 1 :]) if min_idx + 1 < len(recent) else float("inf")
        if abs(left_min - right_min) / left_min < 0.02:  # Within 2%
            patterns.append({
                "pattern": "double_bottom",
                "confidence": 70,
                "signal": "bullish",
            })

    # Volume spike detection
    if volumes and len(volumes) >= 10:
        avg_vol = sum(volumes[-10:-1]) / 9
        if volumes[-1] > avg_vol * 2:
            patterns.append({
                "pattern": "volume_spike",
                "confidence": 80,
                "signal": "attention",
            })

    return patterns


def get_indicator_signals(
    prices: list[float],
    rsi_values: list[float | None],
    macd_data: dict,
    bollinger: dict,
) -> list[dict]:
    """Generate trading signals from indicators."""
    signals = []

    if len(prices) < 2:
        return signals

    current_price = prices[-1]

    # RSI signals
    if rsi_values and rsi_values[-1] is not None:
        rsi = rsi_values[-1]
        if rsi < 30:
            signals.append({
                "indicator": "RSI",
                "signal": "oversold",
                "value": rsi,
                "interpretation": "Potential buying opportunity",
            })
        elif rsi > 70:
            signals.append({
                "indicator": "RSI",
                "signal": "overbought",
                "value": rsi,
                "interpretation": "Potential selling opportunity",
            })

    # MACD signals
    if macd_data.get("macd") and macd_data.get("signal"):
        macd_line = macd_data["macd"]
        signal_line = macd_data["signal"]
        if len(macd_line) >= 2 and len(signal_line) >= 2:
            curr_macd = macd_line[-1]
            curr_signal = signal_line[-1]
            prev_macd = macd_line[-2]
            prev_signal = signal_line[-2]
            if all(v is not None for v in [curr_macd, curr_signal, prev_macd, prev_signal]):
                # Bullish crossover
                if prev_macd <= prev_signal and curr_macd > curr_signal:
                    signals.append({
                        "indicator": "MACD",
                        "signal": "bullish_crossover",
                        "value": curr_macd,
                        "interpretation": "MACD crossed above signal line",
                    })
                # Bearish crossover
                elif prev_macd >= prev_signal and curr_macd < curr_signal:
                    signals.append({
                        "indicator": "MACD",
                        "signal": "bearish_crossover",
                        "value": curr_macd,
                        "interpretation": "MACD crossed below signal line",
                    })

    # Bollinger Band signals
    if bollinger.get("upper") and bollinger.get("lower"):
        upper = bollinger["upper"][-1]
        lower = bollinger["lower"][-1]
        if upper is not None and lower is not None:
            if current_price >= upper:
                signals.append({
                    "indicator": "Bollinger Bands",
                    "signal": "upper_band_touch",
                    "value": current_price,
                    "interpretation": "Price at upper band, potential reversal",
                })
            elif current_price <= lower:
                signals.append({
                    "indicator": "Bollinger Bands",
                    "signal": "lower_band_touch",
                    "value": current_price,
                    "interpretation": "Price at lower band, potential bounce",
                })

    return signals


def analyze_chart(
    symbol: str,
    period: str = "3mo",
    interval: str = "1d",
) -> dict:
    """Perform comprehensive chart analysis for a stock."""
    try:
        # Get historical data
        history = get_stock_history_sync(symbol, period=period, interval=interval)
        if not history.get("data"):
            return {"error": f"No historical data available for {symbol}"}

        # Extract prices and volumes
        data = history["data"]
        prices = [d["close"] for d in data if d.get("close") is not None]
        volumes = [d["volume"] for d in data if d.get("volume") is not None]

        if len(prices) < 20:
            return {"error": f"Insufficient data for analysis ({len(prices)} data points)"}

        # Calculate indicators
        sma_20 = calculate_sma(prices, 20)
        sma_50 = calculate_sma(prices, 50)
        rsi_values = calculate_rsi(prices, 14)
        macd_data = calculate_macd(prices)
        bollinger = calculate_bollinger_bands(prices)

        # Get current price
        current = get_stock_price_sync(symbol)

        # Perform analysis
        trend = detect_trend(prices, sma_20, sma_50)
        sr_levels = find_support_resistance(prices)
        patterns = detect_patterns(prices, volumes)
        signals = get_indicator_signals(prices, rsi_values, macd_data, bollinger)

        return {
            "symbol": symbol.upper(),
            "period": period,
            "interval": interval,
            "current_price": current.get("price"),
            "analysis": {
                "trend": trend,
                "support_resistance": sr_levels,
                "patterns": patterns,
                "signals": signals,
            },
            "indicators": {
                "rsi": rsi_values[-1] if rsi_values else None,
                "macd": macd_data["macd"][-1] if macd_data.get("macd") else None,
                "macd_signal": macd_data["signal"][-1] if macd_data.get("signal") else None,
                "sma_20": sma_20[-1] if sma_20 else None,
                "sma_50": sma_50[-1] if sma_50 else None,
                "bollinger_upper": bollinger["upper"][-1] if bollinger.get("upper") else None,
                "bollinger_lower": bollinger["lower"][-1] if bollinger.get("lower") else None,
            },
            "price_change": {
                "absolute": round(prices[-1] - prices[0], 2) if len(prices) >= 2 else 0,
                "percent": (
                    round((prices[-1] / prices[0] - 1) * 100, 2)
                    if len(prices) >= 2 and prices[0] > 0 else 0
                ),
            },
        }
    except Exception as e:
        logger.exception("Error analyzing chart for %s", symbol)
        return {"error": str(e)}

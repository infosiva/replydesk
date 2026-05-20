"""Technical indicators calculation service."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)


def calculate_sma(prices: list[float], period: int) -> list[float | None]:
    """Calculate Simple Moving Average."""
    if len(prices) < period:
        return [None] * len(prices)

    series = pd.Series(prices)
    sma = series.rolling(window=period).mean()
    return [round(v, 2) if pd.notna(v) else None for v in sma.tolist()]


def calculate_ema(prices: list[float], period: int) -> list[float | None]:
    """Calculate Exponential Moving Average."""
    if len(prices) < period:
        return [None] * len(prices)

    series = pd.Series(prices)
    ema = series.ewm(span=period, adjust=False).mean()
    return [round(v, 2) if pd.notna(v) else None for v in ema.tolist()]


def calculate_rsi(prices: list[float], period: int = 14) -> list[float | None]:
    """Calculate Relative Strength Index."""
    if len(prices) < period + 1:
        return [None] * len(prices)

    series = pd.Series(prices)
    delta = series.diff()

    gain = delta.where(delta > 0, 0)
    loss = (-delta).where(delta < 0, 0)

    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    return [round(v, 2) if pd.notna(v) else None for v in rsi.tolist()]


def calculate_macd(
    prices: list[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> dict[str, list[float | None]]:
    """Calculate MACD (Moving Average Convergence Divergence)."""
    if len(prices) < slow_period:
        n = len(prices)
        return {
            "macd": [None] * n,
            "signal": [None] * n,
            "histogram": [None] * n,
        }

    series = pd.Series(prices)

    ema_fast = series.ewm(span=fast_period, adjust=False).mean()
    ema_slow = series.ewm(span=slow_period, adjust=False).mean()

    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    histogram = macd_line - signal_line

    return {
        "macd": [round(v, 4) if pd.notna(v) else None for v in macd_line.tolist()],
        "signal": [round(v, 4) if pd.notna(v) else None for v in signal_line.tolist()],
        "histogram": [round(v, 4) if pd.notna(v) else None for v in histogram.tolist()],
    }


def calculate_bollinger_bands(
    prices: list[float],
    period: int = 20,
    std_dev: float = 2.0,
) -> dict[str, list[float | None]]:
    """Calculate Bollinger Bands."""
    if len(prices) < period:
        n = len(prices)
        return {
            "upper": [None] * n,
            "middle": [None] * n,
            "lower": [None] * n,
        }

    series = pd.Series(prices)
    middle = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()

    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)

    return {
        "upper": [round(v, 2) if pd.notna(v) else None for v in upper.tolist()],
        "middle": [round(v, 2) if pd.notna(v) else None for v in middle.tolist()],
        "lower": [round(v, 2) if pd.notna(v) else None for v in lower.tolist()],
    }


def get_all_indicators(prices: list[float], volumes: list[float] | None = None) -> dict:
    """Calculate all technical indicators for a price series."""
    result = {
        "sma_20": calculate_sma(prices, 20),
        "sma_50": calculate_sma(prices, 50),
        "sma_200": calculate_sma(prices, 200),
        "ema_12": calculate_ema(prices, 12),
        "ema_26": calculate_ema(prices, 26),
        "rsi": calculate_rsi(prices, 14),
        "macd": calculate_macd(prices),
        "bollinger": calculate_bollinger_bands(prices),
    }

    if volumes:
        result["volumes"] = volumes

    return result

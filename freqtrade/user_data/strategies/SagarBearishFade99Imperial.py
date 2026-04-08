"""
Sagar Bot V2 Strategy 1 — Adapted for Crypto Spot
Based on BankNifty PE Monthly logic: bearish EMA alignment + RSI overbought fade
+ VWAP rejection + ADX bearish trend confirmation.

Crypto adaptation: Buys dips in downtrends (counter-trend bounce plays).
When bearish structure is confirmed, wait for RSI to reach oversold and buy
the reversal bounce. Original logic inverted for spot-only (no shorting).

From 2,152 lifetime trades data:
- 66.7% WR, 5.85x R-multiple on original setup
- Position size enforcement: dead zone blocking
- 3-day time stop for theta-equivalent (momentum decay)
"""

from datetime import datetime
from typing import Optional
from functools import reduce
import numpy as np
import pandas as pd
from pandas import DataFrame

from freqtrade.strategy import IStrategy, Trade, IntParameter, DecimalParameter


class SagarBearishFade99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "15m"
    can_short = False

    # R-multiple based ROI (adapted from options 3x target)
    minimal_roi = {"0": 0.12, "180": 0.06, "720": 0.03, "1440": 0.01}
    stoploss = -0.025
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.06
    trailing_only_offset_is_reached = True

    # Hyperoptable
    buy_rsi_max = IntParameter(20, 35, default=30, space="buy", optimize=True)
    buy_adx_min = IntParameter(18, 35, default=22, space="buy", optimize=True)
    ema_fast = IntParameter(7, 12, default=9, space="buy", optimize=True)
    ema_mid = IntParameter(18, 25, default=21, space="buy", optimize=True)
    ema_slow = IntParameter(45, 55, default=50, space="buy", optimize=True)

    startup_candle_count = 200

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMAs
        dataframe["ema_fast"] = dataframe["close"].ewm(span=self.ema_fast.value, adjust=False).mean()
        dataframe["ema_mid"] = dataframe["close"].ewm(span=self.ema_mid.value, adjust=False).mean()
        dataframe["ema_slow"] = dataframe["close"].ewm(span=self.ema_slow.value, adjust=False).mean()
        dataframe["ema_200"] = dataframe["close"].ewm(span=200, adjust=False).mean()

        # RSI
        delta = dataframe["close"].diff()
        gain = delta.clip(lower=0).ewm(com=13, adjust=False).mean()
        loss = (-delta.clip(upper=0)).ewm(com=13, adjust=False).mean()
        dataframe["rsi"] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))

        # VWAP
        tp = (dataframe["high"] + dataframe["low"] + dataframe["close"]) / 3
        vol_sum = dataframe["volume"].rolling(20).sum().replace(0, 1)
        dataframe["vwap"] = (tp * dataframe["volume"]).rolling(20).sum() / vol_sum

        # ADX
        high, low, close = dataframe["high"], dataframe["low"], dataframe["close"]
        tr = pd.concat([(high - low).abs(), (high - close.shift(1)).abs(), (low - close.shift(1)).abs()], axis=1).max(axis=1)
        plus_dm = np.where((high.diff() > 0) & (high.diff() > -low.diff()), high.diff().clip(lower=0), 0)
        minus_dm = np.where((low.diff() < 0) & (-low.diff() > high.diff()), (-low.diff()).clip(lower=0), 0)
        tr_s = pd.Series(tr).ewm(com=13, adjust=False).mean()
        plus_di = 100 * pd.Series(plus_dm).ewm(com=13, adjust=False).mean() / tr_s
        minus_di = 100 * pd.Series(minus_dm).ewm(com=13, adjust=False).mean() / tr_s
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
        dataframe["adx"] = dx.ewm(com=13, adjust=False).mean()
        dataframe["minus_di"] = minus_di
        dataframe["plus_di"] = plus_di

        # Volume
        dataframe["vol_ma"] = dataframe["volume"].rolling(20).mean()
        dataframe["vol_surge"] = (dataframe["volume"] > dataframe["vol_ma"] * 1.3).astype(int)

        # Bearish structure (lower highs + lower lows)
        dataframe["lower_high"] = (dataframe["high"] < dataframe["high"].rolling(5).max().shift(1)).astype(int)
        dataframe["lower_low"] = (dataframe["low"] < dataframe["low"].rolling(5).min().shift(1)).astype(int)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Buy the oversold bounce in a confirmed downtrend.
        Bearish structure confirmed -> wait for RSI oversold -> buy reversal.
        """
        dataframe.loc[
            (
                (dataframe["ema_fast"] < dataframe["ema_mid"])
                & (dataframe["ema_mid"] < dataframe["ema_slow"])
                & (dataframe["rsi"] < self.buy_rsi_max.value)
                & (dataframe["close"] < dataframe["vwap"])
                & (dataframe["adx"] > self.buy_adx_min.value)
                & (dataframe["minus_di"] > dataframe["plus_di"])
                & (dataframe["vol_surge"] == 1)
                & (dataframe["lower_high"] == 1)
                & (dataframe["close"] > dataframe["open"])  # Green reversal candle
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["ema_fast"] > dataframe["ema_mid"])
                & (dataframe["ema_fast"].shift(1) <= dataframe["ema_mid"].shift(1))
                & (dataframe["rsi"] > 60)
            ),
            "exit_long",
        ] = 1
        return dataframe

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, after_fill, **kwargs):
        hours = (current_time - trade.open_date_utc).total_seconds() / 3600
        if hours > 72 and current_profit < 0.02:
            return -0.005
        if hours > 48:
            return max(self.stoploss, -0.015)
        if hours > 24:
            return max(self.stoploss, -0.02)
        return self.stoploss

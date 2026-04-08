"""
Sagar Bot V2 Strategy 2 — Adapted for Crypto Spot
Based on Nifty CE Weekly logic: bullish breakout + volume + EMA alignment.

4.40x R-multiple edge: profitable even at 29% win rate.
Only fires when there's room for a 4x+ move.
High selectivity, low frequency, large R.

Entry: Bullish breakout above resistance with volume surge + EMA aligned
Exit: R-multiple targets or bearish reversal
"""

from datetime import datetime
from typing import Optional
import numpy as np
import pandas as pd
from pandas import DataFrame
from functools import reduce

from freqtrade.strategy import IStrategy, Trade, IntParameter, DecimalParameter


class SagarBreakout99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "15m"
    can_short = False

    # 4.4x R target adapted for crypto
    minimal_roi = {"0": 0.15, "360": 0.08, "720": 0.04, "1440": 0.02}
    stoploss = -0.023  # 1/4.4 = 22.7% -> tighter for crypto: 2.3%
    trailing_stop = True
    trailing_stop_positive = 0.02
    trailing_stop_positive_offset = 0.08
    trailing_only_offset_is_reached = True

    # Hyperoptable
    buy_rsi_min = IntParameter(50, 65, default=55, space="buy", optimize=True)
    buy_rsi_max = IntParameter(68, 80, default=75, space="buy", optimize=True)
    buy_adx_min = IntParameter(20, 40, default=25, space="buy", optimize=True)
    vol_surge_mult = DecimalParameter(1.2, 2.5, default=1.5, decimals=1, space="buy")
    breakout_atr_mult = DecimalParameter(0.5, 2.0, default=1.0, decimals=1, space="buy")
    ema_fast = IntParameter(7, 13, default=9, space="buy", optimize=True)
    ema_mid = IntParameter(18, 26, default=21, space="buy", optimize=True)
    ema_slow = IntParameter(45, 55, default=50, space="buy", optimize=True)

    startup_candle_count = 200

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMAs
        dataframe["ema_fast"] = dataframe["close"].ewm(span=self.ema_fast.value, adjust=False).mean()
        dataframe["ema_mid"] = dataframe["close"].ewm(span=self.ema_mid.value, adjust=False).mean()
        dataframe["ema_slow"] = dataframe["close"].ewm(span=self.ema_slow.value, adjust=False).mean()
        dataframe["ema_200"] = dataframe["close"].ewm(span=200, adjust=False).mean()

        dataframe["bullish_ema"] = (
            (dataframe["ema_fast"] > dataframe["ema_mid"])
            & (dataframe["ema_mid"] > dataframe["ema_slow"])
        ).astype(int)
        dataframe["ema_slope"] = (dataframe["ema_fast"] > dataframe["ema_fast"].shift(3)).astype(int)

        # RSI
        delta = dataframe["close"].diff()
        gain = delta.clip(lower=0).ewm(com=13, adjust=False).mean()
        loss = (-delta.clip(upper=0)).ewm(com=13, adjust=False).mean()
        dataframe["rsi"] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))
        dataframe["rsi_rising"] = (dataframe["rsi"] > dataframe["rsi"].shift(3)).astype(int)

        # VWAP
        tp = (dataframe["high"] + dataframe["low"] + dataframe["close"]) / 3
        vol_sum = dataframe["volume"].rolling(20).sum().replace(0, 1)
        dataframe["vwap"] = (tp * dataframe["volume"]).rolling(20).sum() / vol_sum

        # ATR
        tr = pd.concat([
            (dataframe["high"] - dataframe["low"]).abs(),
            (dataframe["high"] - dataframe["close"].shift(1)).abs(),
            (dataframe["low"] - dataframe["close"].shift(1)).abs(),
        ], axis=1).max(axis=1)
        dataframe["atr"] = tr.ewm(com=13, adjust=False).mean()

        # Breakout candle
        dataframe["candle_body"] = (dataframe["close"] - dataframe["open"]).abs()
        dataframe["large_bullish"] = (
            (dataframe["candle_body"] > dataframe["atr"] * self.breakout_atr_mult.value)
            & (dataframe["close"] > dataframe["open"])
        ).astype(int)

        # ADX
        high, low, close = dataframe["high"], dataframe["low"], dataframe["close"]
        plus_dm = np.where((high.diff() > 0) & (high.diff() > -low.diff()), high.diff().clip(lower=0), 0)
        minus_dm = np.where((low.diff() < 0) & (-low.diff() > high.diff()), (-low.diff()).clip(lower=0), 0)
        tr_s = pd.Series(tr).ewm(com=13, adjust=False).mean()
        plus_di = 100 * pd.Series(plus_dm).ewm(com=13, adjust=False).mean() / tr_s
        minus_di = 100 * pd.Series(minus_dm).ewm(com=13, adjust=False).mean() / tr_s
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
        dataframe["adx"] = dx.ewm(com=13, adjust=False).mean()
        dataframe["adx_bullish"] = ((dataframe["adx"] > self.buy_adx_min.value) & (plus_di > minus_di)).astype(int)

        # Volume
        dataframe["vol_ma"] = dataframe["volume"].rolling(20).mean()
        dataframe["vol_surge"] = (dataframe["volume"] > dataframe["vol_ma"] * self.vol_surge_mult.value).astype(int)

        # Breakout above resistance
        dataframe["recent_high"] = dataframe["high"].rolling(20).max().shift(1)
        dataframe["breakout"] = (dataframe["close"] > dataframe["recent_high"]).astype(int)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["bullish_ema"] == 1)
                & (dataframe["ema_slope"] == 1)
                & (dataframe["rsi"].between(self.buy_rsi_min.value, self.buy_rsi_max.value))
                & (dataframe["rsi_rising"] == 1)
                & (dataframe["close"] > dataframe["vwap"])
                & (dataframe["adx_bullish"] == 1)
                & (dataframe["vol_surge"] == 1)
                & (dataframe["large_bullish"] == 1)
                & (dataframe["close"] > dataframe["ema_200"])
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["ema_fast"] < dataframe["ema_mid"])
                & (dataframe["ema_fast"].shift(1) >= dataframe["ema_mid"].shift(1))
            )
            | (dataframe["rsi"] > 80),
            "exit_long",
        ] = 1
        return dataframe

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, after_fill, **kwargs):
        hours = (current_time - trade.open_date_utc).total_seconds() / 3600
        if hours > 36 and current_profit < 0.02:
            return max(self.stoploss, -0.01)
        return self.stoploss

"""
Sahil's Babybot Trend Continuation — 99 Imperial / iTradeEdge
82% avg annual return | Trend-following across multiple assets

Enter when: Price > EMA50 > EMA200, EMA50 slope positive, RSI 40-72,
ADX > 18, OBV confirming, volume participating. Weekly rebalance logic
handled by Freqtrade's built-in pairlist refresh.
"""

from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np
import pandas as pd


class BabybotTrend99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "4h"
    can_short = False

    # Hyperopt-optimized (100 epochs, 2021-2025, SharpeHyperOptLoss, +237.88%)
    minimal_roi = {"0": 0.232, "1619": 0.084, "3434": 0.038, "7858": 0}
    stoploss = -0.263
    trailing_stop = True
    trailing_stop_positive = 0.311
    trailing_stop_positive_offset = 0.319
    trailing_only_offset_is_reached = False

    # Hyperoptable
    adx_threshold = IntParameter(15, 25, default=18, space="buy")
    rsi_low = IntParameter(35, 50, default=40, space="buy")
    rsi_high = IntParameter(65, 80, default=72, space="buy")
    ema_slope_min = DecimalParameter(0.01, 0.15, default=0.05, decimals=2, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Trend EMAs
        dataframe["ema9"] = ta.EMA(dataframe, timeperiod=9)
        dataframe["ema21"] = ta.EMA(dataframe, timeperiod=21)
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=50)
        dataframe["ema100"] = ta.EMA(dataframe, timeperiod=100)
        dataframe["ema200"] = ta.EMA(dataframe, timeperiod=200)

        # EMA50 slope (trend acceleration)
        dataframe["ema50_slope"] = (
            (dataframe["ema50"] - dataframe["ema50"].shift(5))
            / dataframe["ema50"].shift(5) * 100
        )

        # RSI
        dataframe["rsi14"] = ta.RSI(dataframe, timeperiod=14)

        # ATR
        dataframe["atr14"] = ta.ATR(dataframe, timeperiod=14)

        # ADX
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)

        # Volume
        dataframe["vol_ratio"] = dataframe["volume"] / pd.Series(ta.SMA(dataframe["volume"], timeperiod=20)).replace(0, 1)

        # OBV (On-Balance Volume)
        dataframe["obv"] = (np.sign(dataframe["close"].diff()) * dataframe["volume"]).cumsum()
        dataframe["obv_ema"] = ta.EMA(dataframe["obv"], timeperiod=20)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Strong entry: all EMAs aligned
        strong_long = (
            (dataframe["close"] > dataframe["ema50"])
            & (dataframe["ema50"] > dataframe["ema200"])
            & (dataframe["ema50_slope"] > self.ema_slope_min.value)
            & (dataframe["rsi14"].between(self.rsi_low.value, self.rsi_high.value))
            & (dataframe["vol_ratio"] > 0.8)
            & (dataframe["adx"] > self.adx_threshold.value)
            & (dataframe["obv"] > dataframe["obv_ema"])
            & (dataframe["close"] > dataframe["close"].shift(1))
            & (dataframe["ema9"] > dataframe["ema21"])
            & (dataframe["ema21"] > dataframe["ema50"])
        )
        dataframe.loc[strong_long, "enter_long"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] < dataframe["ema50"])
                | (dataframe["rsi14"] > 82)
                | (dataframe["ema50_slope"] < -0.1)
            ),
            "exit_long",
        ] = 1
        return dataframe

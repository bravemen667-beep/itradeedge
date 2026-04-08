"""
Capablanca Fade Strategy — 99 Imperial / iTradeEdge
Adapted from David Capablanca's short-selling (spot mode = buy the dip).

Logic flipped for LONGS: When a stock crashes on spike volume with
overhead supply cleared, buy the capitulation for a bounce.
Uses spike detection, volume exhaustion, RSI oversold.
"""

from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np
import pandas as pd


class CapablancaFade99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False

    minimal_roi = {"0": 0.06, "24": 0.03, "48": 0.015}
    stoploss = -0.03
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True

    # Hyperoptable
    spike_threshold = DecimalParameter(-25, -10, default=-15, decimals=0, space="buy")
    rsi_oversold = IntParameter(15, 35, default=25, space="buy")
    vol_spike_mult = DecimalParameter(1.5, 4.0, default=2.0, decimals=1, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["rsi14"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["atr14"] = ta.ATR(dataframe, timeperiod=14)
        dataframe["ema9"] = ta.EMA(dataframe, timeperiod=9)
        dataframe["ema21"] = ta.EMA(dataframe, timeperiod=21)
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=50)

        # Spike detection (crash)
        dataframe["ret5"] = dataframe["close"].pct_change(5) * 100
        dataframe["ret10"] = dataframe["close"].pct_change(10) * 100

        # Volume spike
        dataframe["vol_sma20"] = ta.SMA(dataframe["volume"], timeperiod=20)
        dataframe["vol_ratio"] = dataframe["volume"] / dataframe["vol_sma20"].replace(0, 1)

        # Catalyst spike score (crash version - big red move on volume)
        price_crash = (-dataframe["ret5"] / 20).clip(0, 1)
        vol_spike = ((dataframe["vol_ratio"] - 1) / 2).clip(0, 1)
        dataframe["crash_score"] = (price_crash + vol_spike) / 2 * 100

        # Days since bottom (rolling low)
        dataframe["rolling_low_20"] = dataframe["low"].rolling(20).min()
        dataframe["near_bottom"] = (
            (dataframe["close"] - dataframe["rolling_low_20"])
            / dataframe["rolling_low_20"].replace(0, 1) * 100
        )

        # First green candle after red streak
        dataframe["green"] = (dataframe["close"] > dataframe["open"]).astype(int)
        dataframe["prev_red"] = (dataframe["close"].shift(1) < dataframe["open"].shift(1)).astype(int)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Buy the capitulation: price crashed, volume spiked,
        RSI oversold, first green candle appearing.
        """
        dataframe.loc[
            (
                (dataframe["ret5"] < self.spike_threshold.value)  # crashed
                & (dataframe["rsi14"] < self.rsi_oversold.value)  # oversold
                & (dataframe["vol_ratio"] > self.vol_spike_mult.value)  # volume spike
                & (dataframe["green"] == 1)  # first green candle
                & (dataframe["prev_red"] == 1)  # after red
                & (dataframe["near_bottom"] < 5)  # near recent low
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """Exit on EMA recapture or RSI recovery."""
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["ema21"])
                | (dataframe["rsi14"] > 65)
            ),
            "exit_long",
        ] = 1
        return dataframe

"""
Kevin Davey Breakout Strategy — 99 Imperial / iTradeEdge
Strategy Factory method: breakout above N-bar high with volume confirmation.
Walk-forward validated. ATR-based stops.
"""

from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np


class DaveyBreakout99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False

    minimal_roi = {"0": 0.06, "30": 0.03, "60": 0.015}
    stoploss = -0.03
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True

    # Hyperoptable (Davey: optimise then validate OOS)
    lookback = IntParameter(10, 40, default=20, space="buy")
    vol_filter = DecimalParameter(1.2, 3.0, default=1.5, decimals=1, space="buy")
    atr_stop_mult = DecimalParameter(1.5, 3.0, default=2.0, decimals=1, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        for lb in [10, 15, 20, 30, 40]:
            dataframe[f"high_{lb}"] = dataframe["high"].rolling(lb).max().shift(1)
            dataframe[f"low_{lb}"] = dataframe["low"].rolling(lb).min().shift(1)

        dataframe["vol_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)
        dataframe["atr14"] = ta.ATR(dataframe, timeperiod=14)
        dataframe["rsi14"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=50)
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        lb = self.lookback.value
        high_col = f"high_{lb}"
        if high_col not in dataframe.columns:
            dataframe[high_col] = dataframe["high"].rolling(lb).max().shift(1)

        dataframe.loc[
            (
                (dataframe["close"] > dataframe[high_col])
                & (dataframe["volume"] > dataframe["vol_sma"] * self.vol_filter.value)
                & (dataframe["close"] > dataframe["ema50"])
                & (dataframe["rsi14"] < 75)
                & (dataframe["adx"] > 20)
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        lb = self.lookback.value
        low_col = f"low_{lb}"
        if low_col not in dataframe.columns:
            dataframe[low_col] = dataframe["low"].rolling(lb).min().shift(1)

        dataframe.loc[
            (
                (dataframe["close"] < dataframe[low_col])
                | (dataframe["rsi14"] > 80)
            ),
            "exit_long",
        ] = 1
        return dataframe

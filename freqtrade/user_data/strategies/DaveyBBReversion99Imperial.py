"""
Kevin Davey Bollinger Band Mean Reversion — 99 Imperial / iTradeEdge
Buy when price touches lower BB + RSI oversold. Sell at middle BB.
Walk-forward validated approach from Strategy Factory.
"""

from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np


class DaveyBBReversion99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False

    minimal_roi = {"0": 0.04, "30": 0.025, "60": 0.015}
    stoploss = -0.025
    trailing_stop = True
    trailing_stop_positive = 0.008
    trailing_stop_positive_offset = 0.015

    # Hyperoptable
    bb_period = IntParameter(15, 30, default=20, space="buy")
    bb_std = DecimalParameter(1.5, 2.5, default=2.0, decimals=1, space="buy")
    rsi_buy = IntParameter(25, 40, default=35, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        for p in [15, 20, 25, 30]:
            for s in [1.5, 2.0, 2.5]:
                bb = ta.BBANDS(dataframe, timeperiod=p, nbdevup=s, nbdevdn=s)
                suffix = f"_{p}_{str(s).replace('.','')}"
                dataframe[f"bb_upper{suffix}"] = bb["upperband"]
                dataframe[f"bb_middle{suffix}"] = bb["middleband"]
                dataframe[f"bb_lower{suffix}"] = bb["lowerband"]

        dataframe["rsi14"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["atr14"] = ta.ATR(dataframe, timeperiod=14)
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)
        dataframe["vol_ratio"] = dataframe["volume"] / ta.SMA(dataframe["volume"], timeperiod=20).replace(0, 1)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        p = self.bb_period.value
        s = self.bb_std.value
        suffix = f"_{p}_{str(s).replace('.','')}"
        lower_col = f"bb_lower{suffix}"
        if lower_col not in dataframe.columns:
            bb = ta.BBANDS(dataframe, timeperiod=p, nbdevup=s, nbdevdn=s)
            dataframe[lower_col] = bb["lowerband"]

        dataframe.loc[
            (
                (dataframe["close"] < dataframe[lower_col])
                & (dataframe["rsi14"] < self.rsi_buy.value)
                & (dataframe["adx"] < 30)  # ranging market preferred
                & (dataframe["vol_ratio"] > 0.5)
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        p = self.bb_period.value
        s = self.bb_std.value
        suffix = f"_{p}_{str(s).replace('.','')}"
        mid_col = f"bb_middle{suffix}"
        upper_col = f"bb_upper{suffix}"
        if mid_col not in dataframe.columns:
            bb = ta.BBANDS(dataframe, timeperiod=p, nbdevup=s, nbdevdn=s)
            dataframe[mid_col] = bb["middleband"]
            dataframe[upper_col] = bb["upperband"]

        dataframe.loc[
            (
                (dataframe["close"] > dataframe[mid_col])
                | (dataframe["rsi14"] > 70)
            ),
            "exit_long",
        ] = 1
        return dataframe

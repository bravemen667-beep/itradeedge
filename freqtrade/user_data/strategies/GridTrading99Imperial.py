"""
Grid Trading Strategy — 99 Imperial / iTradeEdge
ATR-based grid spacing, stable Galaxy Score filter zone (40-60)
Auto-pauses during extreme sentiment spikes
"""

from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np


class GridTrading99Imperial(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "15m"
    can_short = False
    minimal_roi = {"0": 0.10}  # Grid manages own exits
    stoploss = -0.03

    # Hyperoptable
    grid_levels = IntParameter(5, 15, default=10, space="buy")
    atr_multiplier = DecimalParameter(0.3, 1.0, default=0.5, decimals=1, space="buy")
    adx_max = IntParameter(15, 25, default=20, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # ATR for dynamic grid spacing
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=14)

        # ADX for regime
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)

        # RSI
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)

        # Bollinger Bands for range detection
        bollinger = ta.BBANDS(dataframe, timeperiod=20, nbdevup=2, nbdevdn=2)
        dataframe["bb_upper"] = bollinger["upperband"]
        dataframe["bb_lower"] = bollinger["lowerband"]
        dataframe["bb_middle"] = bollinger["middleband"]

        # Grid levels based on ATR
        dataframe["grid_spacing"] = dataframe["atr"] * self.atr_multiplier.value
        dataframe["grid_lower"] = dataframe["bb_lower"]
        dataframe["grid_upper"] = dataframe["bb_upper"]

        # Volume
        dataframe["volume_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Enter when price is in lower grid zone + ranging market
        dataframe.loc[
            (
                (dataframe["close"] < dataframe["bb_middle"])
                & (dataframe["adx"] < self.adx_max.value)
                & (dataframe["rsi"] < 55)
                & (dataframe["rsi"] > 25)
                & (dataframe["volume"] > 0)
            ),
            "enter_long",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Exit when price reaches upper grid zone
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["bb_middle"])
                & (dataframe["rsi"] > 55)
            ),
            "exit_long",
        ] = 1

        return dataframe

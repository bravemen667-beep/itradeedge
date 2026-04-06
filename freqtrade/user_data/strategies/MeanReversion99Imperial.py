"""
Mean Reversion Strategy — 99 Imperial / iTradeEdge
RSI oversold/overbought + Bollinger Band touch
Only trades in RANGING regime (ADX < 20)
"""

import freqtrade.vendor.qtpylib.indicators as qtpylib
from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta


class MeanReversion99Imperial(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "15m"
    can_short = False
    minimal_roi = {"0": 0.03, "30": 0.02, "60": 0.015, "120": 0.01}
    stoploss = -0.015
    trailing_stop = True
    trailing_stop_positive = 0.005
    trailing_stop_positive_offset = 0.01

    # Hyperoptable parameters
    rsi_buy = IntParameter(20, 35, default=30, space="buy")
    rsi_sell = IntParameter(65, 80, default=70, space="sell")
    bb_period = IntParameter(15, 25, default=20, space="buy")
    adx_max = IntParameter(15, 25, default=20, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # RSI
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)

        # Bollinger Bands
        bollinger = qtpylib.bollinger_bands(
            qtpylib.typical_price(dataframe), window=self.bb_period.value, stds=2
        )
        dataframe["bb_upper"] = bollinger["upper"]
        dataframe["bb_middle"] = bollinger["mid"]
        dataframe["bb_lower"] = bollinger["lower"]
        dataframe["bb_width"] = (
            (dataframe["bb_upper"] - dataframe["bb_lower"]) / dataframe["bb_middle"]
        )

        # ADX for regime detection
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)

        # Stochastic for additional confirmation
        stoch = ta.STOCH(dataframe, fastk_period=14, slowk_period=3, slowd_period=3)
        dataframe["stoch_k"] = stoch["slowk"]
        dataframe["stoch_d"] = stoch["slowd"]

        # Volume
        dataframe["volume_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Long: RSI oversold + price at lower BB + ranging market
        dataframe.loc[
            (
                (dataframe["rsi"] < self.rsi_buy.value)
                & (dataframe["close"] <= dataframe["bb_lower"])
                & (dataframe["adx"] < self.adx_max.value)
                & (dataframe["stoch_k"] < 20)
                & (dataframe["volume"] > dataframe["volume_sma"] * 0.5)
            ),
            "enter_long",
        ] = 1

        # Short: RSI overbought + price at upper BB + ranging market
        dataframe.loc[
            (
                (dataframe["rsi"] > self.rsi_sell.value)
                & (dataframe["close"] >= dataframe["bb_upper"])
                & (dataframe["adx"] < self.adx_max.value)
                & (dataframe["stoch_k"] > 80)
                & (dataframe["volume"] > dataframe["volume_sma"] * 0.5)
            ),
            "enter_short",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Exit long: price returns to middle BB or RSI recovers
        dataframe.loc[
            (
                (dataframe["close"] >= dataframe["bb_middle"])
                | (dataframe["rsi"] > 60)
            ),
            "exit_long",
        ] = 1

        # Exit short: price returns to middle BB or RSI drops
        dataframe.loc[
            (
                (dataframe["close"] <= dataframe["bb_middle"])
                | (dataframe["rsi"] < 40)
            ),
            "exit_short",
        ] = 1

        return dataframe

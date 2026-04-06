"""
Trend Following Strategy — 99 Imperial / iTradeEdge
EMA 9/21 crossover + ADX > 25 + MACD confirmation
Multi-timeframe: 15m entry, 1h trend, 4h bias
"""

import freqtrade.vendor.qtpylib.indicators as qtpylib
from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta


class TrendFollowing99Imperial(IStrategy):
    INTERFACE_VERSION = 3

    # Strategy settings
    timeframe = "15m"
    can_short = False
    minimal_roi = {"0": 0.05, "30": 0.03, "60": 0.02, "120": 0.01}
    stoploss = -0.025
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True

    # Hyperoptable parameters
    ema_fast = IntParameter(5, 15, default=9, space="buy")
    ema_slow = IntParameter(15, 30, default=21, space="buy")
    adx_threshold = IntParameter(20, 35, default=25, space="buy")

    def informative_pairs(self):
        pairs = self.dp.current_whitelist()
        return [(pair, "1h") for pair in pairs] + [(pair, "4h") for pair in pairs]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMAs
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)

        # ADX
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)
        dataframe["plus_di"] = ta.PLUS_DI(dataframe, timeperiod=14)
        dataframe["minus_di"] = ta.MINUS_DI(dataframe, timeperiod=14)

        # MACD
        macd = ta.MACD(dataframe, fastperiod=12, slowperiod=26, signalperiod=9)
        dataframe["macd"] = macd["macd"]
        dataframe["macd_signal"] = macd["macdsignal"]
        dataframe["macd_hist"] = macd["macdhist"]

        # RSI for additional confirmation
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)

        # Volume SMA
        dataframe["volume_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Long entry: EMA crossover + ADX strong trend + MACD bullish
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"])
                & (dataframe["adx"] > self.adx_threshold.value)
                & (dataframe["plus_di"] > dataframe["minus_di"])
                & (dataframe["macd_hist"] > 0)
                & (dataframe["rsi"] > 40)
                & (dataframe["rsi"] < 75)
                & (dataframe["volume"] > dataframe["volume_sma"])
            ),
            "enter_long",
        ] = 1

        # Short entry: EMA crossunder + ADX strong trend + MACD bearish
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"])
                & (dataframe["adx"] > self.adx_threshold.value)
                & (dataframe["minus_di"] > dataframe["plus_di"])
                & (dataframe["macd_hist"] < 0)
                & (dataframe["rsi"] < 60)
                & (dataframe["rsi"] > 25)
                & (dataframe["volume"] > dataframe["volume_sma"])
            ),
            "enter_short",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Exit long: EMA crossunder or RSI overbought
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"])
                | (dataframe["rsi"] > 80)
            ),
            "exit_long",
        ] = 1

        # Exit short: EMA crossover or RSI oversold
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"])
                | (dataframe["rsi"] < 20)
            ),
            "exit_short",
        ] = 1

        return dataframe

"""
EMA Scalping Strategy v0.1 — 99 Imperial / iTradeEdge

Multi-confirmation scalping: EMA 9/50/150/200 + RSI + Market Structure
Timeframe: 1m entry with 15m trend filter (informative pair)
Risk: 1% per trade, 1:2 R:R, trailing SL to breakeven at 1:1

Works in spot mode (can_short=False) — only long entries.
"""

import freqtrade.vendor.qtpylib.indicators as qtpylib
from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np


class EMAScalping99Imperial(IStrategy):
    INTERFACE_VERSION = 3

    # Strategy settings
    timeframe = "1m"
    can_short = False  # Spot mode — longs only

    # 1:2 R:R managed via custom_exit + trailing
    minimal_roi = {"0": 0.04, "15": 0.02, "30": 0.01}
    stoploss = -0.01  # 1% hard stop, overridden by custom_stoploss

    trailing_stop = True
    trailing_stop_positive = 0.005  # 0.5% trailing once in profit
    trailing_stop_positive_offset = 0.01  # Activate trailing at 1% profit (1:1 level)
    trailing_only_offset_is_reached = True

    # Hyperoptable parameters
    ema_fast = IntParameter(7, 12, default=9, space="buy")
    ema_medium = IntParameter(40, 60, default=50, space="buy")
    ema_slow = IntParameter(130, 170, default=150, space="buy")
    ema_major = IntParameter(180, 220, default=200, space="buy")
    rsi_oversold = IntParameter(30, 45, default=40, space="buy")
    pullback_tolerance = DecimalParameter(0.0005, 0.002, default=0.001, decimals=4, space="buy")

    def informative_pairs(self):
        """Use 15m timeframe for trend bias"""
        pairs = self.dp.current_whitelist()
        return [(pair, "15m") for pair in pairs]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # ── EMAs ──
        dataframe["ema9"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=self.ema_medium.value)
        dataframe["ema150"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)
        dataframe["ema200"] = ta.EMA(dataframe, timeperiod=self.ema_major.value)

        # ── RSI ──
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)

        # ── Market Structure: Higher Highs detection ──
        # Rolling 5-candle swing highs/lows
        dataframe["swing_high"] = dataframe["high"].rolling(window=5, center=True).max()
        dataframe["swing_low"] = dataframe["low"].rolling(window=5, center=True).min()

        # Higher Highs: current swing high > previous swing high
        dataframe["prev_swing_high"] = dataframe["swing_high"].shift(5)
        dataframe["higher_highs"] = (
            dataframe["swing_high"] > dataframe["prev_swing_high"]
        ).astype(int)

        # Lower Lows: current swing low < previous swing low
        dataframe["prev_swing_low"] = dataframe["swing_low"].shift(5)
        dataframe["lower_lows"] = (
            dataframe["swing_low"] < dataframe["prev_swing_low"]
        ).astype(int)

        # ── Pullback to EMA 9 detection ──
        # Candle low touches or wicks near EMA 9 (within tolerance)
        tolerance = self.pullback_tolerance.value
        dataframe["pullback_to_ema9"] = (
            dataframe["low"] <= dataframe["ema9"] * (1 + tolerance)
        ).astype(int)

        # ── Volume filter ──
        dataframe["volume_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)

        # ── 15m Trend (from informative pair) ──
        if self.dp:
            inf_tf = "15m"
            inf_pair = metadata["pair"]
            informative = self.dp.get_pair_dataframe(pair=inf_pair, timeframe=inf_tf)
            if len(informative) > 0:
                informative["ema50_15m"] = ta.EMA(informative, timeperiod=50)
                informative["trend_15m"] = np.where(
                    informative["close"] > informative["ema50_15m"], 1, -1
                )
                # Merge 15m trend into 1m dataframe
                informative = informative[["date", "trend_15m"]].copy()
                informative.columns = ["date", "trend_15m"]
                dataframe = dataframe.merge(informative, on="date", how="left")
                dataframe["trend_15m"] = dataframe["trend_15m"].ffill()
            else:
                dataframe["trend_15m"] = 0
        else:
            dataframe["trend_15m"] = 0

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        BUY (Long) Rules:
        1. 15m trend is BULLISH (trend_15m > 0)
        2. Price above 50 EMA (bullish bias)
        3. Market making Higher Highs
        4. Price pulled back to 9 EMA
        5. Green candle forming at/above 9 EMA
        6. RSI < 40 (oversold on pullback)
        """
        dataframe.loc[
            (
                (dataframe["trend_15m"] > 0)                          # 15m bullish
                & (dataframe["close"] > dataframe["ema50"])           # Above 50 EMA
                & (dataframe["close"] > dataframe["ema9"])            # Close above 9 EMA
                & (dataframe["higher_highs"] == 1)                    # HH structure
                & (dataframe["pullback_to_ema9"] == 1)                # Pullback touched 9 EMA
                & (dataframe["close"] > dataframe["open"])            # Green candle
                & (dataframe["rsi"] < self.rsi_oversold.value)        # RSI oversold
                & (dataframe["volume"] > dataframe["volume_sma"] * 0.5)  # Min volume
            ),
            "enter_long",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Exit when:
        - RSI > 70 (momentum exhaustion)
        - Price crosses below 50 EMA (trend flip)
        - 15m trend flips bearish
        """
        dataframe.loc[
            (
                (dataframe["rsi"] > 70)
                | (dataframe["close"] < dataframe["ema50"])
                | (dataframe["trend_15m"] < 0)
            ),
            "exit_long",
        ] = 1

        return dataframe

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, after_fill, **kwargs):
        """
        Dynamic stop loss:
        - At 1:1 profit, move SL to breakeven (entry price)
        - Below that, use the standard -1% stoploss
        """
        if current_profit >= 0.01:  # 1% profit = 1:1 R:R
            return -0.001  # Essentially breakeven with tiny buffer
        return self.stoploss  # Default -1%

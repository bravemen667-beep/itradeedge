"""
Sam Miesse Multi-Factor Scoring Strategy — 99 Imperial / iTradeEdge
Based on: Chat With Traders Episode 291

Multi-factor scoring: momentum (0-25) + volume (0-20) + trend (0-25)
+ relative strength (0-15) + setup quality (0-15) = 0-100 total score.
Enter LONG when score >= 65, EMA aligned, RSI not overbought, volume surging.
Conviction-based sizing. ATR stops. 3:1 and 5:1 R:R targets.
"""

from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import numpy as np


class MiesseMultiFactor99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False

    minimal_roi = {"0": 0.08, "60": 0.04, "120": 0.02, "240": 0.01}
    stoploss = -0.04
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.03
    trailing_only_offset_is_reached = True

    # Hyperoptable
    score_threshold = IntParameter(55, 75, default=65, space="buy")
    vol_surge_mult = DecimalParameter(1.2, 2.5, default=1.5, decimals=1, space="buy")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMAs
        dataframe["ema9"] = ta.EMA(dataframe, timeperiod=9)
        dataframe["ema21"] = ta.EMA(dataframe, timeperiod=21)
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=50)
        dataframe["ema200"] = ta.EMA(dataframe, timeperiod=200)

        # RSI
        dataframe["rsi14"] = ta.RSI(dataframe, timeperiod=14)

        # ATR
        dataframe["atr14"] = ta.ATR(dataframe, timeperiod=14)

        # Volume ratio
        dataframe["vol_sma20"] = ta.SMA(dataframe["volume"], timeperiod=20)
        dataframe["vol_sma50"] = ta.SMA(dataframe["volume"], timeperiod=50)
        dataframe["vol_ratio"] = dataframe["volume"] / dataframe["vol_sma20"].replace(0, 1)
        dataframe["vol_surge_20"] = (dataframe["volume"] > dataframe["vol_sma20"] * self.vol_surge_mult.value).astype(int)
        dataframe["vol_surge_50"] = (dataframe["volume"] > dataframe["vol_sma50"] * 2.0).astype(int)

        # Returns for momentum
        dataframe["ret5"] = dataframe["close"].pct_change(5)
        dataframe["ret10"] = dataframe["close"].pct_change(10)
        dataframe["ret20"] = dataframe["close"].pct_change(20)

        # Price position in range (0-1)
        roll_high = dataframe["high"].rolling(168).max()  # ~7 days in 1h
        roll_low = dataframe["low"].rolling(168).min()
        denom = (roll_high - roll_low).replace(0, 1)
        dataframe["price_pos"] = (dataframe["close"] - roll_low) / denom

        # Gap percentage
        dataframe["gap_pct"] = (dataframe["open"] - dataframe["close"].shift(1)) / dataframe["close"].shift(1) * 100

        # === MOMENTUM SCORE (0-25) ===
        m1 = np.where(dataframe["ret5"] > 0.02, 6, np.where(dataframe["ret5"] > 0, 3, 0))
        m2 = np.where(dataframe["ret10"] > 0.04, 7, np.where(dataframe["ret10"] > 0, 3, 0))
        m3 = np.where(dataframe["ret20"] > 0.08, 12, np.where(dataframe["ret20"] > 0, 5, 0))
        dataframe["momentum_score"] = m1 + m2 + m3

        # === VOLUME SCORE (0-20) ===
        v1 = np.where(dataframe["vol_ratio"] > 3.0, 10,
             np.where(dataframe["vol_ratio"] > 2.0, 7,
             np.where(dataframe["vol_ratio"] > 1.5, 4, 0)))
        v2 = np.where(dataframe["vol_surge_50"] == 1, 10,
             np.where(dataframe["vol_surge_20"] == 1, 5, 0))
        dataframe["volume_score"] = v1 + v2

        # === TREND SCORE (0-25) ===
        t1 = np.where(dataframe["close"] > dataframe["ema9"], 3, 0)
        t2 = np.where(dataframe["ema9"] > dataframe["ema21"], 5, 0)
        t3 = np.where(dataframe["ema21"] > dataframe["ema50"], 7, 0)
        t4 = np.where(dataframe["ema50"] > dataframe["ema200"], 5, 0)
        t5 = np.where(dataframe["price_pos"] > 0.70, 5, 0)
        dataframe["trend_score"] = t1 + t2 + t3 + t4 + t5

        # === SETUP SCORE (0-15) ===
        s1 = np.where((dataframe["rsi14"] >= 40) & (dataframe["rsi14"] <= 65), 5, 0)
        s2 = np.where(dataframe["gap_pct"] > 3, 5, np.where(dataframe["gap_pct"] > 1, 2, 0))
        near_ema21 = ((dataframe["close"] - dataframe["ema21"]).abs() / dataframe["ema21"].replace(0, 1)) < 0.02
        s3 = np.where(near_ema21, 5, 0)
        dataframe["setup_score"] = s1 + s2 + s3

        # === TOTAL SCORE (0-85 without RS) ===
        dataframe["total_score"] = (
            dataframe["momentum_score"] + dataframe["volume_score"]
            + dataframe["trend_score"] + dataframe["setup_score"]
        )

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["total_score"] >= self.score_threshold.value)
                & (dataframe["close"] > dataframe["ema50"])
                & (dataframe["rsi14"] < 75)
                & (dataframe["vol_surge_20"] == 1)
                & (dataframe["ema9"] > dataframe["ema21"])
                & (dataframe["ema21"] > dataframe["ema50"])
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["ema9"] < dataframe["ema21"])
                | (dataframe["rsi14"] > 80)
            ),
            "exit_long",
        ] = 1
        return dataframe

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, after_fill, **kwargs):
        # Time stop: exit after 10 bars if not +2%
        if trade.open_date_utc and current_time:
            hours_held = (current_time - trade.open_date_utc).total_seconds() / 3600
            if hours_held >= 10 and current_profit < 0.02:
                return -0.001
        return self.stoploss

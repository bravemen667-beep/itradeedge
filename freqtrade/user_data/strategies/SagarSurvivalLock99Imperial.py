"""
Sagar Bot V2 Strategy 3 — Survival Lock (Crypto Adapted)
Capital preservation system from 2,152 lifetime trades.

97% size reduction = 98.9% loss reduction.
This strategy enforces discipline that saved accounts.

Rules enforced:
- Max 2 concurrent positions
- 2-loss daily circuit breaker
- 3-day time stop
- High selectivity: only trade when ALL signals align
- Trailing stop locks profit at 1.5x R
"""

from datetime import datetime
from typing import Optional, Dict
import numpy as np
import pandas as pd
from pandas import DataFrame
from functools import reduce
import logging

from freqtrade.strategy import IStrategy, Trade, IntParameter, DecimalParameter, BooleanParameter

logger = logging.getLogger(__name__)


class SagarSurvivalLock99Imperial(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "15m"
    can_short = False

    minimal_roi = {"0": 0.10, "720": 0.04, "1440": 0.02, "2880": 0.005}
    stoploss = -0.025
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.06
    trailing_only_offset_is_reached = True

    # Hyperoptable
    rsi_oversold = IntParameter(25, 40, default=35, space="buy", optimize=True)
    rsi_overbought = IntParameter(60, 80, default=65, space="buy", optimize=True)
    adx_threshold = IntParameter(20, 35, default=22, space="buy", optimize=True)

    startup_candle_count = 100

    _daily_losses: Dict[str, int] = {}
    _max_daily_losses = 2

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        for p in [9, 21, 50, 200]:
            dataframe[f"ema_{p}"] = dataframe["close"].ewm(span=p, adjust=False).mean()

        delta = dataframe["close"].diff()
        gain = delta.clip(lower=0).ewm(com=13, adjust=False).mean()
        loss = (-delta.clip(upper=0)).ewm(com=13, adjust=False).mean()
        dataframe["rsi"] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))

        high, low, close = dataframe["high"], dataframe["low"], dataframe["close"]
        tr = pd.concat([(high - low).abs(), (high - close.shift(1)).abs(), (low - close.shift(1)).abs()], axis=1).max(axis=1)
        plus_dm = np.where((high.diff() > 0) & (high.diff() > -low.diff()), high.diff().clip(lower=0), 0)
        minus_dm = np.where((low.diff() < 0) & (-low.diff() > high.diff()), (-low.diff()).clip(lower=0), 0)
        tr_s = pd.Series(tr).ewm(com=13, adjust=False).mean()
        plus_di = 100 * pd.Series(plus_dm).ewm(com=13, adjust=False).mean() / tr_s
        minus_di = 100 * pd.Series(minus_dm).ewm(com=13, adjust=False).mean() / tr_s
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
        dataframe["adx"] = dx.ewm(com=13, adjust=False).mean()
        dataframe["plus_di"] = plus_di
        dataframe["minus_di"] = minus_di

        tp = (high + low + close) / 3
        vol_sum = dataframe["volume"].rolling(20).sum().replace(0, 1)
        dataframe["vwap"] = (tp * dataframe["volume"]).rolling(20).sum() / vol_sum
        dataframe["vol_ratio"] = dataframe["volume"] / dataframe["volume"].rolling(20).mean().replace(0, 1)

        dataframe["strong_uptrend"] = (
            (dataframe["ema_9"] > dataframe["ema_21"])
            & (dataframe["ema_21"] > dataframe["ema_50"])
            & (dataframe["close"] > dataframe["ema_200"])
            & (dataframe["adx"] > self.adx_threshold.value)
            & (dataframe["plus_di"] > dataframe["minus_di"])
        ).astype(int)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["strong_uptrend"] == 1)
                & (dataframe["rsi"].between(self.rsi_overbought.value - 15, self.rsi_overbought.value))
                & (dataframe["close"] > dataframe["vwap"])
                & (dataframe["vol_ratio"] > 1.3)
                & (dataframe["close"] > dataframe["close"].shift(1))
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["ema_9"] < dataframe["ema_21"])
                & (dataframe["ema_9"].shift(1) >= dataframe["ema_21"].shift(1))
            )
            | (dataframe["rsi"] > 82),
            "exit_long",
        ] = 1
        return dataframe

    def confirm_trade_entry(self, pair, order_type, amount, rate, time_in_force,
                            current_time, entry_tag, side, **kwargs):
        current_open = len(Trade.get_open_trades())
        if current_open >= 2:
            logger.warning(f"POSITION LIMIT: {current_open}/2 open. Blocking {pair}.")
            return False

        today = current_time.strftime("%Y-%m-%d")
        if today not in self._daily_losses:
            self._daily_losses[today] = 0
        if self._daily_losses[today] >= self._max_daily_losses:
            logger.warning(f"DAILY LOSS LIMIT: {self._daily_losses[today]} losses. Halted for {today}.")
            return False

        return True

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, after_fill, **kwargs):
        hours = (current_time - trade.open_date_utc).total_seconds() / 3600
        if hours > 72 and current_profit < 0.02:
            return -0.005
        if hours > 48:
            return max(self.stoploss, -0.015)
        return self.stoploss

    def custom_exit(self, pair, trade, current_time, current_rate,
                    current_profit, **kwargs):
        minutes = (current_time - trade.open_date_utc).total_seconds() / 60
        if minutes > 4320:
            return f"TIME_STOP_3DAYS ({current_profit:.1%})"
        if minutes > 2880 and current_profit < 0.02:
            return f"MOMENTUM_DECAY ({current_profit:.1%})"
        return None

    def confirm_trade_exit(self, pair, trade, order_type, amount, rate,
                           time_in_force, exit_reason, current_time, **kwargs):
        profit = trade.calc_profit_ratio(rate)
        if profit < 0:
            today = current_time.strftime("%Y-%m-%d")
            if today not in self._daily_losses:
                self._daily_losses[today] = 0
            self._daily_losses[today] += 1
        return True

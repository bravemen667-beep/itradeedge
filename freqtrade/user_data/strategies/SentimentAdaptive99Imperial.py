"""
Sentiment-Adaptive Strategy — 99 Imperial / iTradeEdge
Combines technical indicators with LunarCrush social data
Adapts position sizing and entry gates based on Galaxy Score
"""

import freqtrade.vendor.qtpylib.indicators as qtpylib
from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import requests
import logging

logger = logging.getLogger(__name__)

LUNARCRUSH_API = "https://lunarcrush.com/api4/public"


class SentimentAdaptive99Imperial(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "15m"
    can_short = True
    minimal_roi = {"0": 0.05, "60": 0.03, "120": 0.02}
    stoploss = -0.025
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.02

    # Hyperoptable
    ema_fast = IntParameter(5, 15, default=9, space="buy")
    ema_slow = IntParameter(15, 30, default=21, space="buy")
    galaxy_min = IntParameter(50, 75, default=65, space="buy")
    rsi_entry_low = IntParameter(35, 50, default=40, space="buy")
    rsi_entry_high = IntParameter(55, 70, default=65, space="buy")

    # Cache for API calls
    _sentiment_cache: dict = {}

    def _get_galaxy_score(self, symbol: str) -> float:
        """Fetch Galaxy Score from LunarCrush with caching"""
        import time
        cache_key = symbol
        now = time.time()

        if cache_key in self._sentiment_cache:
            cached = self._sentiment_cache[cache_key]
            if now - cached["ts"] < 300:  # 5 min cache
                return cached["score"]

        try:
            coin = symbol.split("/")[0].lower()
            headers = {}
            api_key = self.config.get("lunarcrush_api_key", "")
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            resp = requests.get(
                f"{LUNARCRUSH_API}/topic/{coin}",
                headers=headers,
                timeout=5,
            )
            if resp.ok:
                data = resp.json().get("data", {})
                score = float(data.get("galaxy_score", 50))
                self._sentiment_cache[cache_key] = {"score": score, "ts": now}
                return score
        except Exception as e:
            logger.warning(f"LunarCrush fetch failed for {symbol}: {e}")

        return 50.0  # Neutral default

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMAs
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)

        # MACD
        macd = ta.MACD(dataframe)
        dataframe["macd_hist"] = macd["macdhist"]

        # RSI
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)

        # ADX
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)

        # ATR for stop loss
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=14)

        # Volume
        dataframe["volume_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)

        # Galaxy Score (fetched once per candle cycle)
        galaxy = self._get_galaxy_score(metadata["pair"])
        dataframe["galaxy_score"] = galaxy

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Long: EMA bullish + MACD bullish + Galaxy Score above threshold
        dataframe.loc[
            (
                (dataframe["ema_fast"] > dataframe["ema_slow"])
                & (dataframe["macd_hist"] > 0)
                & (dataframe["rsi"] > self.rsi_entry_low.value)
                & (dataframe["rsi"] < self.rsi_entry_high.value)
                & (dataframe["galaxy_score"] >= self.galaxy_min.value)
                & (dataframe["volume"] > dataframe["volume_sma"])
            ),
            "enter_long",
        ] = 1

        # Short: EMA bearish + MACD bearish + Galaxy Score below threshold (contrarian)
        dataframe.loc[
            (
                (dataframe["ema_fast"] < dataframe["ema_slow"])
                & (dataframe["macd_hist"] < 0)
                & (dataframe["rsi"] > 55)
                & (dataframe["galaxy_score"] < 40)
                & (dataframe["volume"] > dataframe["volume_sma"])
            ),
            "enter_short",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"])
                | (dataframe["rsi"] > 80)
            ),
            "exit_long",
        ] = 1

        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"])
                | (dataframe["rsi"] < 20)
            ),
            "exit_short",
        ] = 1

        return dataframe

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake, min_stake, max_stake, leverage, entry_tag, side, **kwargs):
        """Adjust position size based on Galaxy Score conviction"""
        galaxy = self._get_galaxy_score(pair)

        if galaxy >= 80:
            multiplier = 1.5
        elif galaxy >= 70:
            multiplier = 1.2
        elif galaxy >= 60:
            multiplier = 1.0
        else:
            multiplier = 0.5

        adjusted = proposed_stake * multiplier
        return max(min(adjusted, max_stake), min_stake)

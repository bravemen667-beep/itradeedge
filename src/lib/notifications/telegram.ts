const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Warn once on first send if creds are missing — operators were previously
// flying blind because sendMessage silently returned false on every call.
let warnedNotConfigured = false;

async function sendMessage(text: string, parseMode = "HTML"): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    if (!warnedNotConfigured) {
      console.warn(
        "[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set — notifications disabled"
      );
      warnedNotConfigured = true;
    }
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    console.error("Telegram notification failed");
    return false;
  }
}

export const telegram = {
  async tradeOpened(pair: string, side: string, price: number, strategy: string) {
    return sendMessage(
      `🟢 <b>Trade Opened</b>\n` +
      `Pair: <code>${pair}</code>\n` +
      `Side: ${side}\n` +
      `Price: $${price.toFixed(2)}\n` +
      `Strategy: ${strategy}\n` +
      `Time: ${new Date().toUTCString()}`
    );
  },

  async tradeClosed(
    pair: string,
    profit: number,
    profitPercent: number,
    strategy: string
  ) {
    const emoji = profit >= 0 ? "🟢" : "🔴";
    return sendMessage(
      `${emoji} <b>Trade Closed</b>\n` +
      `Pair: <code>${pair}</code>\n` +
      `P&L: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)\n` +
      `Strategy: ${strategy}\n` +
      `Time: ${new Date().toUTCString()}`
    );
  },

  async dailySummary(data: {
    totalPnl: number;
    winRate: number;
    tradesCount: number;
    equity: number;
  }) {
    const emoji = data.totalPnl >= 0 ? "📈" : "📉";
    return sendMessage(
      `${emoji} <b>Daily Summary — iTradeEdge</b>\n\n` +
      `Total P&L: $${data.totalPnl.toFixed(2)}\n` +
      `Win Rate: ${data.winRate.toFixed(1)}%\n` +
      `Trades: ${data.tradesCount}\n` +
      `Equity: $${data.equity.toFixed(2)}\n` +
      `\n⏰ ${new Date().toUTCString()}`
    );
  },

  async systemAlert(title: string, message: string) {
    return sendMessage(`⚠️ <b>${title}</b>\n${message}`);
  },

  async sentimentAlert(symbol: string, galaxyScore: number, recommendation: string) {
    return sendMessage(
      `🔮 <b>Sentiment Alert — ${symbol}</b>\n` +
      `Galaxy Score: ${galaxyScore}\n` +
      `Signal: ${recommendation}\n` +
      `Time: ${new Date().toUTCString()}`
    );
  },
};

"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Zap } from "lucide-react";

interface RiskState {
  maxDrawdown: number;
  maxPositionSize: number;
  maxOpenTrades: number;
  riskPerTrade: number;
  maxDailyLoss: number;
  trailingStop: number;
}

const defaultRisk: RiskState = {
  maxDrawdown: 15,
  maxPositionSize: 10,
  maxOpenTrades: 3,
  riskPerTrade: 2,
  maxDailyLoss: 5,
  trailingStop: 2.5,
};

const riskFields: { key: keyof RiskState; label: string; description: string }[] = [
  { key: "maxDrawdown", label: "Max Drawdown (%)", description: "Halt trading above this drawdown" },
  { key: "maxPositionSize", label: "Max Position Size (%)", description: "Maximum portfolio % per trade" },
  { key: "maxOpenTrades", label: "Max Open Trades", description: "Concurrent position limit" },
  { key: "riskPerTrade", label: "Risk Per Trade (%)", description: "Max risk per individual trade" },
  { key: "maxDailyLoss", label: "Max Daily Loss (%)", description: "Pause trading after daily loss" },
  { key: "trailingStop", label: "Trailing Stop (%)", description: "Trailing stop distance" },
];

export default function SettingsPage() {
  const [paperTrading, setPaperTrading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState(true);
  const [risk, setRisk] = useState<RiskState>(defaultRisk);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  // Track the saved-flash timeout so we can clear it on unmount and on
  // back-to-back saves — the previous code leaked timeouts.
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const updateRisk = (key: keyof RiskState, raw: string) => {
    const parsed = Number(raw);
    setRisk((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : prev[key],
    }));
  };

  const saveSettings = async () => {
    setSaveStatus("saving");
    setSaveMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperTrading,
          notifications,
          sentimentFilter,
          risk,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSaveStatus("saved");
      setSaveMessage(data.message || "Saved");
    } catch (err) {
      console.error("[settings] save failed:", err);
      setSaveStatus("error");
      setSaveMessage(err instanceof Error ? err.message : "Save failed");
    }
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      setSaveStatus("idle");
      setSaveMessage("");
    }, 4000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Settings className="h-8 w-8 text-zinc-400" />
          Settings
        </h2>
        <p className="text-zinc-500 mt-1">Configure trading parameters and integrations</p>
      </div>

      {/* Trading Mode */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            Trading Mode
          </CardTitle>
          <CardDescription>Switch between paper and live trading</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Paper Trading</p>
              <p className="text-xs text-zinc-500">
                Simulated trades — no real money at risk
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={paperTrading ? "success" : "destructive"}>
                {paperTrading ? "PAPER" : "LIVE"}
              </Badge>
              <Switch checked={paperTrading} onCheckedChange={setPaperTrading} />
            </div>
          </div>
          {!paperTrading && (
            <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg">
              <p className="text-sm text-red-400 font-medium">
                Live trading uses real funds. Ensure risk parameters are configured.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {riskFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm text-zinc-400 mb-1">{field.label}</label>
                <input
                  type="number"
                  value={risk[field.key]}
                  onChange={(e) => updateRisk(field.key, e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm"
                />
                <p className="text-xs text-zinc-600 mt-1">{field.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Telegram Alerts</p>
              <p className="text-xs text-zinc-500">Trade opens/closes, daily summaries</p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Sentiment Filter</p>
              <p className="text-xs text-zinc-500">Gate entries on LunarCrush Galaxy Score</p>
            </div>
            <Switch checked={sentimentFilter} onCheckedChange={setSentimentFilter} />
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">API Connections</CardTitle>
          <CardDescription>Managed via environment variables on Vercel/VPS</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "Binance", status: "connected" },
              { name: "Freqtrade", status: "connected" },
              { name: "LunarCrush", status: "connected" },
              { name: "Telegram", status: "connected" },
              { name: "PostgreSQL", status: "connected" },
            ].map((api) => (
              <div key={api.name} className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                <span className="text-sm text-zinc-300">{api.name}</span>
                <Badge variant="success">Connected</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button
          onClick={saveSettings}
          disabled={saveStatus === "saving"}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : "Save Settings"}
        </Button>
        {saveMessage && (
          <span
            className={`text-xs ${
              saveStatus === "error" ? "text-red-400" : "text-zinc-500"
            }`}
          >
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
}

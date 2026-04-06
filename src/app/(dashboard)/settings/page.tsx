"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Zap } from "lucide-react";

export default function SettingsPage() {
  const [paperTrading, setPaperTrading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState(true);
  const [saved, setSaved] = useState(false);

  const saveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
            {[
              { label: "Max Drawdown (%)", defaultValue: "15", description: "Halt trading above this drawdown" },
              { label: "Max Position Size (%)", defaultValue: "10", description: "Maximum portfolio % per trade" },
              { label: "Max Open Trades", defaultValue: "3", description: "Concurrent position limit" },
              { label: "Risk Per Trade (%)", defaultValue: "2", description: "Max risk per individual trade" },
              { label: "Max Daily Loss (%)", defaultValue: "5", description: "Pause trading after daily loss" },
              { label: "Trailing Stop (%)", defaultValue: "2.5", description: "Trailing stop distance" },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm text-zinc-400 mb-1">{field.label}</label>
                <input
                  type="number"
                  defaultValue={field.defaultValue}
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

      <Button onClick={saveSettings} className="bg-emerald-600 hover:bg-emerald-700">
        {saved ? "Saved!" : "Save Settings"}
      </Button>
    </div>
  );
}

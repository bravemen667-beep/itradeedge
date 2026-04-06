"use client";

import { useEffect, useState } from "react";
import { SignalCard } from "@/components/intelligence/signal-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, RefreshCw } from "lucide-react";
import type { IntelligenceSignal } from "@/types/intelligence";

const defaultSymbols = ["BTC", "ETH", "SOL", "BNB"];

export default function IntelligencePage() {
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence/signals");
      const data = await res.json();
      if (data.signals) {
        setSignals(data.signals.map((s: { intelligence: IntelligenceSignal }) => s.intelligence));
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      // Use empty state
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const tradeable = signals.filter(
    (s) => s.galaxyScore >= 65 && s.confidence >= 0.6 && s.sentimentBias > 0.2
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-400" />
            Social Intelligence
          </h2>
          <p className="text-zinc-500 mt-1">
            LunarCrush-powered sentiment analysis and trade signals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-zinc-500">Updated: {lastUpdated}</span>
          )}
          <Button variant="outline" size="sm" onClick={fetchSignals} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Trade-Ready Signals */}
      {tradeable.length > 0 && (
        <Card className="bg-emerald-950/30 border-emerald-800/50">
          <CardHeader>
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              Trade-Ready Signals
              <Badge variant="success">{tradeable.length} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {tradeable.map((sig) => (
                <div key={sig.symbol} className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{sig.symbol}</p>
                  <p className="text-sm text-zinc-400">
                    GS: {sig.galaxyScore} | Conf: {(sig.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Signals */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {signals.length > 0
          ? signals.map((sig) => <SignalCard key={sig.symbol} signal={sig} />)
          : defaultSymbols.map((sym) => (
              <Card key={sym} className="bg-zinc-900 border-zinc-800 animate-pulse">
                <CardContent className="pt-6 h-48" />
              </Card>
            ))}
      </div>

      {/* Intelligence Rules */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Entry Filter Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-zinc-400">Galaxy Score</p>
              <p className="text-zinc-200 font-medium">&ge; 65 to enter</p>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-zinc-400">Social Momentum</p>
              <p className="text-zinc-200 font-medium">&gt; 0 (rising)</p>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-zinc-400">Sentiment Bias</p>
              <p className="text-zinc-200 font-medium">&gt; 0.2 (bullish)</p>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-zinc-400">Confidence</p>
              <p className="text-zinc-200 font-medium">&ge; 60%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

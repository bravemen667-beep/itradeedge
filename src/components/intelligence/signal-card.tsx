"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IntelligenceSignal } from "@/types/intelligence";

interface SignalCardProps {
  signal: IntelligenceSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const recColors: Record<string, string> = {
    STRONG_BUY: "text-emerald-400 bg-emerald-500/15",
    BUY: "text-green-400 bg-green-500/10",
    NEUTRAL: "text-zinc-400 bg-zinc-500/10",
    SELL: "text-orange-400 bg-orange-500/10",
    STRONG_SELL: "text-red-400 bg-red-500/15",
  };

  const galaxyColor =
    signal.galaxyScore >= 70 ? "text-emerald-400" :
    signal.galaxyScore >= 50 ? "text-amber-400" :
    "text-red-400";

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg text-zinc-100">{signal.symbol}</CardTitle>
        <Badge className={recColors[signal.recommendation] || ""}>
          {signal.recommendation.replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-zinc-500">Galaxy Score</p>
            <p className={`text-xl font-bold ${galaxyColor}`}>
              {signal.galaxyScore}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">AltRank</p>
            <p className="text-xl font-bold text-zinc-200">#{signal.altRank}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Social Momentum</p>
            <p
              className={`text-sm font-medium ${
                signal.socialMomentum > 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {signal.socialMomentum > 0 ? "+" : ""}
              {(signal.socialMomentum * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Confidence</p>
            <p className="text-sm font-medium text-zinc-200">
              {(signal.confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full"
              style={{ width: `${signal.confidence * 100}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Social Vol: {signal.socialVolume.toLocaleString()}</span>
          <span>Dominance: {signal.socialDominance.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

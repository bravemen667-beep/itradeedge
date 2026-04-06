"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent, timeAgo } from "@/lib/utils";
import type { Position } from "@/types/trading";

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Open Positions</CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No open positions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="text-left py-3 px-2">Pair</th>
                  <th className="text-left py-3 px-2">Side</th>
                  <th className="text-right py-3 px-2">Entry</th>
                  <th className="text-right py-3 px-2">Current</th>
                  <th className="text-right py-3 px-2">P&L</th>
                  <th className="text-left py-3 px-2">Strategy</th>
                  <th className="text-right py-3 px-2">Opened</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-3 px-2 font-medium text-zinc-100">{pos.pair}</td>
                    <td className="py-3 px-2">
                      <Badge variant={pos.side === "BUY" ? "success" : "destructive"}>
                        {pos.side}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right text-zinc-300">
                      {formatCurrency(pos.entryPrice)}
                    </td>
                    <td className="py-3 px-2 text-right text-zinc-300">
                      {formatCurrency(pos.currentPrice)}
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-medium ${
                        pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatCurrency(pos.unrealizedPnl)}
                      <span className="text-xs ml-1">
                        ({formatPercent(pos.unrealizedPnlPercent)})
                      </span>
                    </td>
                    <td className="py-3 px-2 text-zinc-400">{pos.strategy}</td>
                    <td className="py-3 px-2 text-right text-zinc-500">
                      {timeAgo(pos.entryTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

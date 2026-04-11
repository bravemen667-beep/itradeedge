"use client";

// Next.js App Router error boundary for the (dashboard) segment.
// Without this file, an uncaught error in any dashboard page would bubble up
// to the root error handler and unmount the entire app shell. This boundary
// scopes recovery to the dashboard subtree so the user can retry without
// losing the rest of the navigation context.

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Surface the error so it shows up in browser devtools and any attached
    // error-tracking transport (Sentry, etc. when wired).
    console.error("[dashboard] uncaught error:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-red-900/50">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-400">
            The dashboard hit an unexpected error. The rest of the app is still
            running — you can retry this section or navigate elsewhere.
          </p>
          <pre className="bg-zinc-950 p-3 rounded-lg text-xs text-red-300/80 overflow-auto max-h-40">
            {error.message || "Unknown error"}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
          <Button onClick={() => reset()} className="bg-emerald-600 hover:bg-emerald-700">
            <RotateCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

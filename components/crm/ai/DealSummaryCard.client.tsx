"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DealSummaryView } from "./DealSummaryView";
import type { CachedDealSummary } from "@/lib/crm/ai/types";

interface Props {
  dealId: string;
  initial: CachedDealSummary | null;
  canGenerate: boolean;
}

type State =
  | { kind: "empty" }
  | { kind: "filled"; summary: CachedDealSummary }
  | { kind: "loading"; previous: CachedDealSummary | null };

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "před chvílí";
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.floor(hours / 24);
  return `před ${days} dny`;
}

export function DealSummaryCardClient({ dealId, initial, canGenerate }: Props) {
  const [state, setState] = useState<State>(
    initial ? { kind: "filled", summary: initial } : { kind: "empty" }
  );
  const [open, setOpen] = useState(false);

  async function generate() {
    const previous = state.kind === "filled" ? state.summary : null;
    setState({ kind: "loading", previous });
    try {
      const res = await fetch(`/api/crm/deals/${dealId}/summary`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CachedDealSummary;
      setState({ kind: "filled", summary: data });
      toast.success("AI shrnutí vygenerováno.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznámá chyba.";
      toast.error(`Nepodařilo se vygenerovat shrnutí: ${msg}`);
      setState(previous ? { kind: "filled", summary: previous } : { kind: "empty" });
    }
  }

  const isStale = state.kind === "filled" && state.summary.isStale;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
        >
          <Sparkles className="mr-1.5 size-3.5" />
          AI Přehled
          {isStale ? (
            <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-yellow-500" aria-label="neaktuální" />
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-purple-600" />
              <SheetTitle className="truncate">AI Přehled</SheetTitle>
              {isStale ? (
                <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                  <AlertTriangle className="mr-1 size-3" />
                  neaktuální
                </Badge>
              ) : null}
            </div>
            {canGenerate ? (
              <Button
                size="sm"
                variant={state.kind === "empty" ? "default" : "outline"}
                onClick={generate}
                disabled={state.kind === "loading"}
              >
                {state.kind === "empty" ? (
                  <>
                    <Sparkles className="mr-1.5 size-3.5" />
                    Vygenerovat
                  </>
                ) : state.kind === "loading" ? (
                  <>
                    <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                    Generuji…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Obnovit
                  </>
                )}
              </Button>
            ) : null}
          </div>
          {state.kind === "filled" ? (
            <p className="text-xs text-gray-500">Vygenerováno {formatRelative(state.summary.createdAt)}</p>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {state.kind === "empty" ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center"
              >
                <div className="rounded-full bg-purple-100 p-3">
                  <Sparkles className="size-6 text-purple-600" />
                </div>
                <p className="max-w-sm text-sm text-gray-600">
                  Tady se zobrazí AI shrnutí dealu — historie, klíčové body, návrhy dalších kroků.
                </p>
                {canGenerate ? (
                  <Button onClick={generate} size="sm" className="mt-2">
                    <Sparkles className="mr-1.5 size-3.5" />
                    Vygenerovat shrnutí
                  </Button>
                ) : null}
              </motion.div>
            ) : null}

            {state.kind === "loading" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3 animate-pulse rounded bg-gray-100"
                    style={{ width: `${60 + ((i * 7) % 35)}%` }}
                  />
                ))}
              </motion.div>
            ) : null}

            {state.kind === "filled" ? (
              <motion.div
                key={state.summary.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {state.summary.isStale ? (
                  <p className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-900">
                    Data se od posledního shrnutí změnila. Zvaž obnovení.
                  </p>
                ) : null}
                <DealSummaryView content={state.summary.content} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

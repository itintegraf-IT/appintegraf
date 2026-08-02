"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Maximize2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/projekty/ui/sheet";
import { Button } from "@/components/projekty/ui/button";
import { Skeleton } from "@/components/projekty/ui/skeleton";
import { CardDetailContent, type FullCard } from "./CardDetailContent";

/**
 * Detail karty jako side panel (Sheet zprava). Kanonická URL zůstává
 * ?card=<id> — sdílené odkazy (vč. uložených v notifikacích) fungují beze
 * změny. „Otevřít na celé stránce" vede na /boards/[boardId]/cards/[cardId].
 */
export function CardDetailPanel({
  cardId,
  currentUserId,
  open,
  onOpenChange,
}: {
  cardId: string | null;
  currentUserId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [fetched, setFetched] = useState<FullCard | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Aktuální karta = fetch výsledek odpovídající cardId; loading je odvozený
  // (žádný synchronní setState v effectu). Stará karta se nerenderuje.
  const card = fetched && fetched.id === cardId ? fetched : null;
  const loading = Boolean(open && cardId && !card && failed !== cardId);

  useEffect(() => {
    if (!cardId || !open) return;
    let cancelled = false;
    // Reset předchozího selhání téže karty → při retry zase skeleton, ne „nenalezena"
    setFailed((f) => (f === cardId ? null : f));
    fetch(`/api/projekty/cards/${cardId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status))))
      .then((data: { card: FullCard }) => {
        if (!cancelled) setFetched(data.card);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(cardId);
          toast.error("Načtení karty selhalo.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cardId, open]);

  const setCard = useCallback(
    (updater: (prev: FullCard | null) => FullCard | null) => {
      setFetched((prev) => updater(prev));
    },
    [],
  );

  const patchCard = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!cardId) return;
      try {
        const res = await fetch(`/api/projekty/cards/${cardId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          toast.error("Uložení selhalo.");
          return;
        }
        const { card: updated } = (await res.json()) as { card: Partial<FullCard> };
        setCard((prev) => (prev ? { ...prev, ...updated } : prev));
        router.refresh();
      } catch {
        toast.error("Uložení selhalo (chyba sítě).");
      }
    },
    [cardId, router, setCard],
  );

  const handleCardChange = useCallback(
    (updater: (prev: FullCard) => FullCard) => {
      setCard((prev) => (prev ? updater(prev) : prev));
      router.refresh();
    },
    [router, setCard],
  );

  async function handleArchive() {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/projekty/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) {
        toast.error("Archivace selhala.");
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success("Karta archivována", {
        action: {
          label: "Zpět",
          onClick: () => {
            void fetch(`/api/projekty/cards/${cardId}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ archived: false }),
            }).then((r) => {
              if (r.ok) router.refresh();
              else toast.error("Obnovení karty selhalo.");
            });
          },
        },
      });
    } catch {
      toast.error("Archivace selhala (chyba sítě).");
    }
  }

  function copyLink() {
    if (!card || !cardId) return;
    const url = new URL(
      `/projekty/boards/${card.list.board.id}?card=${cardId}`,
      window.location.origin,
    ).toString();
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Odkaz na kartu zkopírován"))
      .catch(() => toast.error("Kopírování se nepodařilo."));
  }

  const fullPageHref =
    card && cardId ? `/projekty/boards/${card.list.board.id}/cards/${cardId}` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <SheetTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {card?.number ?? "…"}
          </SheetTitle>
          <SheetDescription className="sr-only">Detail karty</SheetDescription>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyLink}
              disabled={!card}
              title="Kopírovat odkaz na kartu"
              aria-label="Kopírovat odkaz na kartu"
            >
              <Link2 className="size-4" />
            </Button>
            {fullPageHref ? (
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                title="Otevřít na celé stránce"
              >
                <Link href={fullPageHref} aria-label="Otevřít na celé stránce">
                  <Maximize2 className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              title="Zavřít"
              aria-label="Zavřít"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : card ? (
            <CardDetailContent
              card={card}
              currentUserId={currentUserId}
              onPatch={patchCard}
              onCardChange={handleCardChange}
              onArchive={() => void handleArchive()}
            />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Karta nenalezena.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Link2 } from "lucide-react";
import { Button } from "@/components/projekty/ui/button";
import { CardDetailContent, type FullCard } from "./CardDetailContent";

/**
 * Plnostránkový detail karty (/projekty/boards/[boardId]/cards/[cardId]).
 * Data přichází z RSC — žádný klientský fetch při načtení.
 */
export function CardDetailPage({
  initialCard,
  boardName,
  currentUserId,
}: {
  initialCard: FullCard;
  boardName: string;
  currentUserId: number;
}) {
  const router = useRouter();
  const [card, setCard] = useState<FullCard>(initialCard);
  const boardId = card.list.board.id;

  const patchCard = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/projekty/cards/${card.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          toast.error("Uložení selhalo.");
          return;
        }
        const { card: updated } = (await res.json()) as { card: Partial<FullCard> };
        setCard((prev) => ({ ...prev, ...updated }));
        router.refresh();
      } catch {
        toast.error("Uložení selhalo (chyba sítě).");
      }
    },
    [card.id, router],
  );

  const handleCardChange = useCallback(
    (updater: (prev: FullCard) => FullCard) => {
      setCard(updater);
      router.refresh();
    },
    [router],
  );

  async function handleArchive() {
    try {
      const res = await fetch(`/api/projekty/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) {
        toast.error("Archivace selhala.");
        return;
      }
      toast.success("Karta archivována");
      router.push(`/projekty/boards/${boardId}`);
    } catch {
      toast.error("Archivace selhala (chyba sítě).");
    }
  }

  function copyLink() {
    const url = new URL(
      `/projekty/boards/${boardId}?card=${card.id}`,
      window.location.origin,
    ).toString();
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Odkaz na kartu zkopírován"))
      .catch(() => toast.error("Kopírování se nepodařilo."));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/projekty/boards/${boardId}`}
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="truncate">{boardName}</span>
          <span className="shrink-0 text-muted-foreground/70">
            / {card.number}
          </span>
        </Link>
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Link2 className="mr-2 size-4" />
          Kopírovat odkaz
        </Button>
      </div>

      <CardDetailContent
        card={card}
        currentUserId={currentUserId}
        onPatch={patchCard}
        onCardChange={handleCardChange}
        onArchive={() => void handleArchive()}
      />
    </div>
  );
}

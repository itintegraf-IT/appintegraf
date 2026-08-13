import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const MAKETY_FILE_EVENT_TYPES = [
  "uploaded",
  "downloaded",
  "deleted",
  "type_changed",
  "softproof_sent",
  "softproof_downloaded",
  "workflow_transition",
] as const;

export type MaketyFileEventType = (typeof MAKETY_FILE_EVENT_TYPES)[number];

export type RecordMaketyFileEventInput = {
  maketaId: number;
  fileId?: number | null;
  eventType: MaketyFileEventType;
  userId?: number | null;
  meta?: Record<string, unknown> | null;
  /** Volitelná Prisma transakce. */
  tx?: Prisma.TransactionClient;
};

export async function recordMaketyFileEvent(
  input: RecordMaketyFileEventInput
): Promise<void> {
  const client = input.tx ?? prisma;
  try {
    await client.makety_file_events.create({
      data: {
        maketa_id: input.maketaId,
        file_id: input.fileId ?? null,
        event_type: input.eventType,
        user_id: input.userId ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("recordMaketyFileEvent", input.eventType, e);
  }
}

export function maketyFileEventLabel(eventType: string): string {
  switch (eventType) {
    case "uploaded":
      return "Nahrán soubor";
    case "downloaded":
      return "Stažen soubor";
    case "deleted":
      return "Smazán soubor";
    case "type_changed":
      return "Změněn typ souboru";
    case "softproof_sent":
      return "Softproof odeslán klientovi";
    case "softproof_downloaded":
      return "Klient stáhl softproof";
    case "workflow_transition":
      return "Změna stavu workflow";
    default:
      return eventType;
  }
}

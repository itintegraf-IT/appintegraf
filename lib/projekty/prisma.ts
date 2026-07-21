import { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import { prisma as appPrisma } from "@/lib/db";
import { logger } from "@/lib/projekty/logger";

/**
 * Modul Projekty používá SDÍLENÝ Prisma singleton appintegrafu (lib/db.ts).
 * Tento soubor jen re-exportuje `prisma` a přidává audit middleware `withAudit`,
 * který zapisuje do tabulky projekty_audit_log (model AuditLog).
 */
export const prisma: PrismaClient = appPrisma;

// Jen modely modulu Projekty (v1). Uživatele řeší appintegraf → nejsou v auditu.
export const AUDITED_MODELS = new Set([
  "workspace",
  "board",
  "boardMember",
  "boardList",
  "card",
  "cardMember",
  "label",
  "cardLabel",
  "checklist",
  "checklistItem",
  "note",
  "attachment",
]);

export const MUTATION_ACTIONS = new Set(["create", "update", "delete", "upsert"]);

export function lower(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function toPlainJson(value: unknown): unknown {
  // Binární sloupce (např. Attachment.data LONGBLOB) do auditu NEpatří — serializace
  // Bufferu/Uint8Array by nafoukla diff na desítky MB a mohla překročit max_allowed_packet.
  // Nahradíme metadatem o velikosti. (Primárně řešeno omitem v buildFindArgs; toto je
  // druhá pojistka pro jakýkoli binární sloupec, který by proklouzl.)
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (val instanceof Uint8Array) {
        return { __binary__: true, bytes: val.length };
      }
      if (
        val &&
        typeof val === "object" &&
        (val as { type?: unknown }).type === "Buffer" &&
        Array.isArray((val as { data?: unknown }).data)
      ) {
        return { __binary__: true, bytes: (val as { data: unknown[] }).data.length };
      }
      return val;
    }),
  );
}

export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const beforeObj = before ?? {};
  const afterObj = after ?? {};
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  for (const key of allKeys) {
    const b = beforeObj[key];
    const a = afterObj[key];
    if (!deepEqual(b, a)) {
      diff[key] = { before: b ?? null, after: a ?? null };
    }
  }

  return diff;
}

type AuditableClient = ReturnType<typeof withAudit>;

export interface AuditContext {
  bulkOperationId?: string;
}

export function withAudit(client: PrismaClient, userId: number | null, context?: AuditContext): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelKey = lower(model ?? "");

          if (!AUDITED_MODELS.has(modelKey) || !MUTATION_ACTIONS.has(operation)) {
            return query(args);
          }

          const auditAction = resolveAuditAction(operation);
          if (!auditAction) return query(args);

          if (operation === "delete" || operation === "update") {
            const findArgs = buildFindArgs(modelKey, args);
            const beforeRecord = findArgs
              ? await (client as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[
                  modelKey
                ]?.findUnique(findArgs)
              : null;

            const result = await query(args);

            const afterRecord = operation === "update" ? result : null;

            const diff = computeDiff(
              beforeRecord ? toPlainJson(beforeRecord) as Record<string, unknown> : null,
              afterRecord ? toPlainJson(afterRecord) as Record<string, unknown> : null,
            );

            await writeAuditLog(client, {
              userId,
              entityType: model ?? "unknown",
              entityId: extractId(beforeRecord) ?? extractId(afterRecord) ?? "unknown",
              action: auditAction,
              diff,
              context,
            });

            return result;
          }

          const result = await query(args);

          const entityId = extractId(result) ?? "unknown";
          const diff = computeDiff(null, result ? toPlainJson(result) as Record<string, unknown> : null);

          await writeAuditLog(client, {
            userId,
            entityType: model ?? "unknown",
            entityId,
            action: auditAction,
            diff,
            context,
          });

          return result;
        },
      },
    },
  }) as unknown as AuditableClient;
}

function resolveAuditAction(operation: string): AuditAction | null {
  if (operation === "create") return AuditAction.CREATE;
  if (operation === "update") return AuditAction.UPDATE;
  if (operation === "delete") return AuditAction.DELETE;
  if (operation === "upsert") return AuditAction.UPDATE;
  return null;
}

// Sloupce, které se NIKDY nesmí načíst do audit diffu (binární BLOBy).
const AUDIT_OMIT: Record<string, Record<string, boolean>> = {
  attachment: { data: true },
};

function buildFindArgs(
  modelKey: string,
  args: Record<string, unknown>,
): { where: unknown; omit?: Record<string, boolean> } | null {
  if (!args.where) return null;
  const omit = AUDIT_OMIT[modelKey];
  return omit ? { where: args.where, omit } : { where: args.where };
}

function extractId(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  if (typeof r.id === "string") return r.id;
  if (typeof r.id === "number") return String(r.id);
  // Join modely s kompozitním klíčem (bez `id`): CardLabel, CardMember, BoardMember.
  const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
  if (r.cardId != null && r.labelId != null) return `${s(r.cardId)}:${s(r.labelId)}`;
  if (r.cardId != null && r.userId != null) return `${s(r.cardId)}:${s(r.userId)}`;
  if (r.boardId != null && r.userId != null) return `${s(r.boardId)}:${s(r.userId)}`;
  return null;
}

async function writeAuditLog(
  client: PrismaClient,
  data: {
    userId: number | null;
    entityType: string;
    entityId: string;
    action: AuditAction;
    diff: Record<string, unknown>;
    context?: AuditContext;
  },
): Promise<void> {
  const diffWithContext: Record<string, unknown> = data.context?.bulkOperationId
    ? { ...data.diff, _bulkOperationId: data.context.bulkOperationId }
    : data.diff;

  // Audit nesmí shodit úspěšnou mutaci: zápis do audit logu je best-effort.
  // Když selže (nedostupnost, příliš velký diff apod.), zalogujeme a pokračujeme,
  // aby uživatelská akce (např. smazání přílohy) neskončila 500 poté, co už proběhla.
  try {
    await client.auditLog.create({
      data: {
        userId: data.userId,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        diff: diffWithContext as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    logger.error(
      `[projekty audit] zápis auditu selhal (${data.entityType}/${data.action}/${data.entityId})`,
      err as Error,
    );
  }
}

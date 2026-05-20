import { BLOB_REF_KEY } from "@/lib/backup/types";

export function serializeRow(
  row: Record<string, unknown>,
  blobRefs: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (blobRefs[key]) {
      out[key] = { [BLOB_REF_KEY]: blobRefs[key] };
      continue;
    }
    out[key] = serializeValue(value);
  }
  return out;
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) {
    return { [BLOB_REF_KEY]: `__inline_error_buffer_not_mapped__` };
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.constructor?.name === "Decimal" && "toString" in obj) {
      return (obj as { toString: () => string }).toString();
    }
    return value;
  }
  return value;
}

export function deserializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      BLOB_REF_KEY in (value as Record<string, unknown>)
    ) {
      out[key] = value;
      continue;
    }
    out[key] = deserializeValue(value);
  }
  return out;
}

function deserializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

export function isBlobRef(value: unknown): value is { _blob: string } {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { _blob?: string })._blob === "string"
  );
}

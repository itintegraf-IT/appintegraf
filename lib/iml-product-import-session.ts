import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { cleanupTempDir } from "@/lib/backup/zip-read";
import { appendFilesToImportDir } from "@/lib/iml-product-import-upload";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const SESSION_REGISTRY_DIR = path.join(tmpdir(), "iml-import-sessions");

type ImportSession = {
  id: string;
  userId: number;
  tempDir: string;
  createdAt: number;
  fileCount: number;
  totalBytes: number;
};

const globalForSessions = globalThis as typeof globalThis & {
  __imlImportSessions?: Map<string, ImportSession>;
};

function getSessionMap(): Map<string, ImportSession> {
  if (!globalForSessions.__imlImportSessions) {
    globalForSessions.__imlImportSessions = new Map();
  }
  return globalForSessions.__imlImportSessions;
}

function sessionMetaPath(id: string): string {
  return path.join(SESSION_REGISTRY_DIR, `${id}.json`);
}

async function persistSession(session: ImportSession): Promise<void> {
  await mkdir(SESSION_REGISTRY_DIR, { recursive: true });
  await writeFile(sessionMetaPath(session.id), JSON.stringify(session), "utf-8");
  getSessionMap().set(session.id, session);
}

async function loadSession(id: string): Promise<ImportSession | null> {
  const cached = getSessionMap().get(id);
  if (cached) return cached;

  try {
    const raw = await readFile(sessionMetaPath(id), "utf-8");
    const session = JSON.parse(raw) as ImportSession;
    if (!existsSync(session.tempDir)) {
      await rm(sessionMetaPath(id), { force: true }).catch(() => undefined);
      return null;
    }
    getSessionMap().set(id, session);
    return session;
  } catch {
    return null;
  }
}

async function removeSessionRecord(session: ImportSession): Promise<void> {
  getSessionMap().delete(session.id);
  await rm(sessionMetaPath(session.id), { force: true }).catch(() => undefined);
}

async function purgeExpiredSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, session] of getSessionMap()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      await removeSessionRecord(session);
      await cleanupTempDir(session.tempDir).catch(() => undefined);
      getSessionMap().delete(id);
    }
  }

  try {
    const { readdir } = await import("fs/promises");
    const entries = await readdir(SESSION_REGISTRY_DIR).catch(() => [] as string[]);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const session = await loadSession(entry.replace(/\.json$/, ""));
      if (!session) continue;
      if (now - session.createdAt > SESSION_TTL_MS) {
        await removeSessionRecord(session);
        await cleanupTempDir(session.tempDir).catch(() => undefined);
        getSessionMap().delete(session.id);
      }
    }
  } catch {
    /* registry dir may not exist yet */
  }
}

async function getSessionForUser(sessionId: string, userId: number): Promise<ImportSession> {
  await purgeExpiredSessions();
  const session = await loadSession(sessionId);
  if (!session || session.userId !== userId) {
    throw new Error("Neplatná nebo expirovaná relace importu");
  }
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    await removeSessionRecord(session);
    await cleanupTempDir(session.tempDir).catch(() => undefined);
    throw new Error("Relace importu vypršela – začněte znovu");
  }
  return session;
}

export async function createImportSession(userId: number): Promise<string> {
  await purgeExpiredSessions();
  const tempDir = await mkdtemp(path.join(tmpdir(), "iml-import-session-"));
  const id = randomUUID();
  const session: ImportSession = {
    id,
    userId,
    tempDir,
    createdAt: Date.now(),
    fileCount: 0,
    totalBytes: 0,
  };
  await persistSession(session);
  return id;
}

export async function appendImportSessionBatch(
  sessionId: string,
  userId: number,
  files: File[],
  paths: string[]
): Promise<{ fileCount: number; totalBytes: number; batchBytes: number }> {
  const session = await getSessionForUser(sessionId, userId);
  const { written, bytes } = await appendFilesToImportDir(session.tempDir, files, paths);
  session.fileCount += written;
  session.totalBytes += bytes;
  await persistSession(session);
  return {
    fileCount: session.fileCount,
    totalBytes: session.totalBytes,
    batchBytes: bytes,
  };
}

export async function peekImportSession(
  sessionId: string,
  userId: number
): Promise<{ fileCount: number; totalBytes: number }> {
  const session = await getSessionForUser(sessionId, userId);
  return {
    fileCount: session.fileCount,
    totalBytes: session.totalBytes,
  };
}

export async function takeImportSessionDir(sessionId: string, userId: number): Promise<string> {
  const session = await getSessionForUser(sessionId, userId);
  await removeSessionRecord(session);
  return session.tempDir;
}

export async function cancelImportSession(sessionId: string, userId: number): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session || session.userId !== userId) return;
  await removeSessionRecord(session);
  await cleanupTempDir(session.tempDir).catch(() => undefined);
}

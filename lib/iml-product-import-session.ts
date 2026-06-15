import { randomUUID } from "crypto";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { cleanupTempDir } from "@/lib/backup/zip-read";
import { appendFilesToImportDir } from "@/lib/iml-product-import-upload";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

type ImportSession = {
  id: string;
  userId: number;
  tempDir: string;
  createdAt: number;
  fileCount: number;
  totalBytes: number;
};

const sessions = new Map<string, ImportSession>();

function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      void cleanupTempDir(session.tempDir).finally(() => sessions.delete(id));
    }
  }
}

function getSessionForUser(sessionId: string, userId: number): ImportSession {
  purgeExpiredSessions();
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) {
    throw new Error("Neplatná nebo expirovaná relace importu");
  }
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    void cleanupTempDir(session.tempDir);
    throw new Error("Relace importu vypršela – začněte znovu");
  }
  return session;
}

export async function createImportSession(userId: number): Promise<string> {
  purgeExpiredSessions();
  const tempDir = await mkdtemp(path.join(tmpdir(), "iml-import-session-"));
  const id = randomUUID();
  sessions.set(id, {
    id,
    userId,
    tempDir,
    createdAt: Date.now(),
    fileCount: 0,
    totalBytes: 0,
  });
  return id;
}

export async function appendImportSessionBatch(
  sessionId: string,
  userId: number,
  files: File[],
  paths: string[]
): Promise<{ fileCount: number; totalBytes: number; batchBytes: number }> {
  const session = getSessionForUser(sessionId, userId);
  const { written, bytes } = await appendFilesToImportDir(session.tempDir, files, paths);
  session.fileCount += written;
  session.totalBytes += bytes;
  return {
    fileCount: session.fileCount,
    totalBytes: session.totalBytes,
    batchBytes: bytes,
  };
}

export function peekImportSession(
  sessionId: string,
  userId: number
): { fileCount: number; totalBytes: number } {
  const session = getSessionForUser(sessionId, userId);
  return {
    fileCount: session.fileCount,
    totalBytes: session.totalBytes,
  };
}

export function takeImportSessionDir(sessionId: string, userId: number): string {
  const session = getSessionForUser(sessionId, userId);
  sessions.delete(sessionId);
  return session.tempDir;
}

export async function cancelImportSession(sessionId: string, userId: number): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) return;
  sessions.delete(sessionId);
  await cleanupTempDir(session.tempDir);
}

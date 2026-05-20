import path from "path";
import { readdir, stat } from "fs/promises";
import { getBackupDir } from "@/lib/backup/config";

export async function listBackupFilesOnServer(): Promise<
  { name: string; size: number; mtime: string }[]
> {
  const dir = getBackupDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: { name: string; size: number; mtime: string }[] = [];
  for (const name of names) {
    if (!name.endsWith(".zip")) continue;
    const fp = path.join(dir, name);
    const st = await stat(fp);
    if (!st.isFile()) continue;
    out.push({
      name,
      size: st.size,
      mtime: st.mtime.toISOString(),
    });
  }
  return out.sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export function resolveSafeBackupFilePath(fileName: string): string | null {
  const base = path.resolve(getBackupDir());
  const safeName = path.basename(fileName);
  if (!safeName.endsWith(".zip")) return null;
  const resolved = path.resolve(base, safeName);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) return null;
  return resolved;
}

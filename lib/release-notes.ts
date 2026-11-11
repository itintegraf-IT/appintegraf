import { readFile } from "fs/promises";
import path from "path";
import {
  parseReleaseNotesJson,
  validateReleaseNotes,
} from "@/lib/system-update-announce-core.mjs";

export type ReleaseItem = {
  modules: string[];
  text: string;
};

export type ReleaseNote = {
  id: string;
  date?: string;
  title: string;
  items: ReleaseItem[];
};

export type ReleaseNotesFile = {
  releases: ReleaseNote[];
};

export function releaseNotesPath(cwd: string = process.cwd()): string {
  return path.join(cwd, "data", "release-notes.json");
}

export async function loadReleaseNotes(
  cwd: string = process.cwd()
): Promise<ReleaseNotesFile> {
  const filePath = releaseNotesPath(cwd);
  const raw = await readFile(filePath, "utf8");
  const parsed = parseReleaseNotesJson(raw);
  if (!parsed.ok) {
    throw new Error(`release-notes.json: ${parsed.error}`);
  }
  return parsed.data as ReleaseNotesFile;
}

export function validateReleaseNotesData(
  value: unknown
): { ok: true; data: ReleaseNotesFile } | { ok: false; error: string } {
  return validateReleaseNotes(value);
}

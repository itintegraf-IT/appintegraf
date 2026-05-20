import { readFile } from "fs/promises";
import path from "path";
import { resolveHelpDocSlug } from "./doc-slugs";

const DOCS_DIR = path.join(process.cwd(), "docs");

export async function loadHelpDocMarkdown(slug: string): Promise<{
  title: string;
  content: string;
} | null> {
  const meta = resolveHelpDocSlug(slug);
  if (!meta) return null;

  const filePath = path.join(DOCS_DIR, meta.file);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(DOCS_DIR))) {
    return null;
  }

  try {
    const content = await readFile(resolved, "utf8");
    return { title: meta.title, content };
  } catch {
    return null;
  }
}

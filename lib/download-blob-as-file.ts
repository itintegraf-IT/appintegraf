/**
 * Pojmenované stažení blobu — zabrání UUID názvům z blob: URL.
 * Pouze pro client (document/URL).
 */

export function filenameFromContentDisposition(
  header: string | null | undefined
): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      const decoded = decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ""));
      if (decoded) return decoded;
    } catch {
      // ignore
    }
  }
  const plain = /filename\s*=\s*("([^"]+)"|([^;]+))/i.exec(header);
  const raw = (plain?.[2] ?? plain?.[3] ?? "").trim();
  return raw || null;
}

export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const name = (filename || "soubor").replace(/[\r\n"]/g, "_").trim() || "soubor";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

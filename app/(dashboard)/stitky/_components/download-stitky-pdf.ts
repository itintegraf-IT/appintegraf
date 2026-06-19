/** Stáhne PDF řádku zakázky přes API (fetch + blob — spolehlivější než přímý odkaz). */
export async function downloadStitkyPdf(orderId: number, rowIndex: number): Promise<void> {
  const res = await fetch(`/api/stitky/orders/${orderId}/pdf/${rowIndex}`);
  if (!res.ok) {
    let message = "Stažení PDF selhalo";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* odpověď nemusí být JSON */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = decodeURIComponent(
    utf8Match?.[1] ?? asciiMatch?.[1] ?? `Arch_zakazka_radek_${rowIndex}.pdf`
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

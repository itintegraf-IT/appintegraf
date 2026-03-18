/**
 * Formátování čísel – mezery po 3 cifrách (z dokumentace IG52)
 * Příklad: "1234567" -> "1 234 567"
 */
export function deleni3(line: string): string {
  const str = String(line).replace(/\s/g, "");
  let i = 1;
  let line3 = "";
  for (const a of [...str].reverse()) {
    if (i === 3) {
      line3 += a + " ";
      i = 0;
    } else {
      line3 += a;
    }
    i++;
  }
  return line3.split("").reverse().join("").trim();
}

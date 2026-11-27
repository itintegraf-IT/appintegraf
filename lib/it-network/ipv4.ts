/** IPv4 utility – CIDR expand a rozsahy pro registr sítě. */

export function parseIpv4(ip: string): number | null {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
  return ((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!;
}

export function formatIpv4(n: number): string {
  const x = n >>> 0;
  return `${(x >>> 24) & 255}.${(x >>> 16) & 255}.${(x >>> 8) & 255}.${x & 255}`;
}

export function parseCidr(cidr: string): { network: number; prefix: number; mask: number } | null {
  const parts = cidr.trim().split("/");
  if (parts.length !== 2) return null;
  const ip = parseIpv4(parts[0] ?? "");
  const prefix = Number(parts[1]);
  if (ip == null || !Number.isInteger(prefix) || prefix < 8 || prefix > 30) return null;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  return { network, prefix, mask };
}

/** Hosty v CIDR (bez network a broadcast). Max /22 (=1022 hostů). */
export function expandCidrHosts(cidr: string): string[] {
  const parsed = parseCidr(cidr);
  if (!parsed) throw new Error(`Neplatný CIDR: ${cidr}`);
  if (parsed.prefix < 22) {
    throw new Error("Subnet musí být /22 nebo menší (/23–/30). Větší sítě založte po částech.");
  }
  const hostBits = 32 - parsed.prefix;
  const size = 2 ** hostBits;
  const first = parsed.network + 1;
  const last = parsed.network + size - 2;
  const out: string[] = [];
  for (let n = first; n <= last; n++) out.push(formatIpv4(n));
  return out;
}

/** Expanduje IP od–do (včetně), max 256 adres. */
export function expandIpRange(from: string, to: string): string[] {
  const a = parseIpv4(from);
  const b = parseIpv4(to || from);
  if (a == null) throw new Error(`Neplatná IP: ${from}`);
  if (b == null) throw new Error(`Neplatná IP: ${to}`);
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (end - start > 255) throw new Error("Rozsah IP je příliš velký (max 256 adres)");
  const out: string[] = [];
  for (let n = start; n <= end; n++) out.push(formatIpv4(n));
  return out;
}

export function sortIpStrings(ips: string[]): string[] {
  return [...ips].sort((x, y) => {
    const ax = parseIpv4(x) ?? 0;
    const ay = parseIpv4(y) ?? 0;
    return ax - ay;
  });
}

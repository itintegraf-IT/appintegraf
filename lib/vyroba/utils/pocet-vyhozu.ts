/**
 * Počet výhozů – zaokrouhlení nahoru (všude stejné)
 * PocetVyhozu = ceil(PocetKS / PROD)
 */
export function pocetVyhozu(pocetKS: number, prod: number): number {
  const raw = pocetKS / prod;
  return raw > Math.floor(raw) ? Math.floor(raw) + 1 : Math.floor(raw);
}

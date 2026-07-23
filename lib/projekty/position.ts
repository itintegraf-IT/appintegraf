/**
 * Sparse Float positioning pro drag-reorder (Trello-style).
 *
 * Strategy: vložit hodnotu mezi dva sousedy = (prev + next) / 2.
 * Při blízké distanci (< MIN_GAP) spustit rebalance celého listu.
 */

export const MIN_GAP = 0.0001;
export const INITIAL_GAP = 1024;

/** Vypočti pozici mezi dvěma sousedy. Pokud prev/next chybí, použije edge logic. */
export function between(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return INITIAL_GAP;
  if (prev === null) return (next as number) / 2;
  if (next === null) return prev + INITIAL_GAP;
  return (prev + next) / 2;
}

/** True, pokud sequence má někde gap < MIN_GAP — třeba rebalance. */
export function needsRebalance(positions: number[]): boolean {
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    if (prev === undefined || curr === undefined) continue;
    if (curr - prev < MIN_GAP) return true;
  }
  return false;
}

/**
 * Vrátí mapu id → newPosition, kde položky jsou rovnoměrně rozprostřeny od INITIAL_GAP.
 * Volat v transakci, když needsRebalance() vrátí true.
 */
export function rebalancePositions(items: { id: string }[]): Map<string, number> {
  const result = new Map<string, number>();
  items.forEach((item, index) => {
    result.set(item.id, (index + 1) * INITIAL_GAP);
  });
  return result;
}

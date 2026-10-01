/**
 * Brána skeneru: kamera hlásí tentýž kód zhruba 8× za sekundu, dokud je štítek
 * v záběru. Zpracovaný kód se znovu zpracuje až po oddálení kamery (kód nebyl
 * vidět aspoň `holdWindowMs`). Každý kód má vlastní záznam, takže ani dva
 * štítky střídavě v záběru se nezpracují opakovaně.
 */
export function createScanGate(opts?: { holdWindowMs?: number }) {
  const holdWindowMs = opts?.holdWindowMs ?? 1500;
  /** Zpracované kódy → kdy byly naposledy vidět. */
  const lastSeen = new Map<string, number>();

  return {
    /** false = tento kód už byl zpracován a od té doby je pořád v záběru (obnoví čas posledního vidění). */
    shouldHandle(code: string, now: number): boolean {
      const seen = lastSeen.get(code);
      if (seen !== undefined && now - seen < holdWindowMs) {
        lastSeen.set(code, now);
        return false;
      }
      lastSeen.delete(code);
      return true;
    },
    /** Volat, jakmile se kód začne zpracovávat (dialog, chyba, 404 — cokoli). */
    markHandled(code: string, now: number): void {
      lastSeen.set(code, now);
    },
    /** Přepnutí režimu nebo změna místnosti: vše lze zpracovat znovu. */
    reset(): void {
      lastSeen.clear();
    },
  };
}

export type ScanGate = ReturnType<typeof createScanGate>;

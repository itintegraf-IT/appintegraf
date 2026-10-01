import { describe, expect, it } from "vitest";
import { createScanGate } from "./scan-gate";

/** Kamera hlásí stejný kód zhruba každých 125 ms, dokud je štítek v záběru. */
const FRAME = 125;

describe("createScanGate", () => {
  it("nový kód zpracuje", () => {
    const gate = createScanGate();
    expect(gate.shouldHandle("A", 0)).toBe(true);
  });

  it("zpracovaný kód, který drží v záběru, už nezpracuje (40 snímků = 5 s)", () => {
    const gate = createScanGate();
    gate.markHandled("A", 0);
    const results = Array.from({ length: 40 }, (_, i) => gate.shouldHandle("A", (i + 1) * FRAME));
    expect(results.every((r) => r === false)).toBe(true);
  });

  it("po oddálení kamery (1,6 s bez kódu) ho zpracuje znovu", () => {
    const gate = createScanGate();
    gate.markHandled("A", 0);
    gate.shouldHandle("A", FRAME);
    expect(gate.shouldHandle("A", FRAME + 1600)).toBe(true);
  });

  it("dva štítky střídavě v záběru — každý jen jednou", () => {
    const gate = createScanGate();
    let handled = 0;
    for (let i = 0; i < 40; i++) {
      const code = i % 2 === 0 ? "A" : "B";
      const now = i * FRAME;
      if (gate.shouldHandle(code, now)) {
        handled++;
        gate.markHandled(code, now);
      }
    }
    expect(handled).toBe(2);
  });

  it("během otevřeného dialogu se čas obnovuje — po zavření a stále v záběru nic", () => {
    const gate = createScanGate();
    gate.markHandled("A", 0); // otevřel se dialog
    for (let t = FRAME; t <= 8000; t += FRAME) gate.shouldHandle("A", t); // uživatel 8 s rozhoduje
    expect(gate.shouldHandle("A", 8000 + FRAME)).toBe(false);
  });

  it("reset (přepnutí režimu, změna místnosti) dovolí kód zpracovat hned znovu", () => {
    const gate = createScanGate();
    gate.markHandled("A", 0);
    gate.reset();
    expect(gate.shouldHandle("A", FRAME)).toBe(true);
  });
});

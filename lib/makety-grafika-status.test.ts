import { describe, expect, it } from "vitest";
import {
  assertGrafikaTransition,
  getAllowedGrafikaTransitions,
  grafikaStatusLabel,
  grafikaTransitionActionLabel,
  isMaketaTerminalStatus,
  listGrafikaTransitionOptions,
  GRAFIKA_QUEUE_STATUSES,
} from "@/lib/makety-grafika-status";

describe("makety-grafika-status", () => {
  it("labeluje pozastavení a prepress stavy", () => {
    expect(grafikaStatusLabel("data_problem")).toBe("Pozastaveno");
    expect(grafikaStatusLabel("prepress_approved")).toBe("Schváleno prepressem");
  });

  it("vyžaduje komentář u data_problem", () => {
    expect(() =>
      assertGrafikaTransition({
        fromStatus: "in_progress",
        toStatus: "data_problem",
        comment: "",
      })
    ).toThrow(/povinný komentář/i);

    expect(() =>
      assertGrafikaTransition({
        fromStatus: "in_progress",
        toStatus: "data_problem",
        comment: "Chybí Pantone",
      })
    ).not.toThrow();
  });

  it("povoluje grafikovi přechod na hotovo a pozastavení", () => {
    const allowed = getAllowedGrafikaTransitions("in_progress", ["grafik"]);
    expect(allowed).toContain("done");
    expect(allowed).toContain("data_problem");
    expect(allowed).not.toContain("open");
  });

  it("grafik neuvolní pozastavenou zakázku", () => {
    expect(getAllowedGrafikaTransitions("data_problem", ["grafik"])).toEqual([]);
  });

  it("zadavatel uvolní pozastavenou zakázku do fronty", () => {
    expect(getAllowedGrafikaTransitions("data_problem", ["zadavatel"])).toEqual(["open"]);
    expect(grafikaTransitionActionLabel("open", "data_problem")).toBe("Uvolnit ke zpracování");
    expect(grafikaTransitionActionLabel("data_problem")).toBe("Pozastavit – problém s daty");
    expect(() =>
      assertGrafikaTransition({
        fromStatus: "data_problem",
        toStatus: "open",
      })
    ).not.toThrow();
  });

  it("povoluje prepress a final přechody", () => {
    expect(getAllowedGrafikaTransitions("done", ["prepress"])).toEqual(["prepress_approved"]);
    expect(getAllowedGrafikaTransitions("done", ["grafik"])).not.toContain("prepress_approved");
    expect(getAllowedGrafikaTransitions("prepress_approved", ["final"])).toContain(
      "sent_for_approval"
    );
  });

  it("zadavatel bez override nevidí schválení prepressem", () => {
    const native = listGrafikaTransitionOptions("done", ["zadavatel"], false);
    expect(native).toEqual([]);
  });

  it("zadavatel s override vidí schválení prepressem s potvrzením", () => {
    const opts = listGrafikaTransitionOptions("done", ["zadavatel"], true);
    expect(opts).toEqual([
      { toStatus: "prepress_approved", viaOverride: true, actingAs: "prepress" },
    ]);
  });

  it("přiřazený prepress má nativní přechod bez override", () => {
    const opts = listGrafikaTransitionOptions("done", ["prepress", "zadavatel"], true);
    expect(opts).toEqual([
      { toStatus: "prepress_approved", viaOverride: false, actingAs: "prepress" },
    ]);
  });

  it("vyřazuje pozastavené z fronty grafika", () => {
    expect([...GRAFIKA_QUEUE_STATUSES]).toEqual(["open", "in_progress"]);
    expect(GRAFIKA_QUEUE_STATUSES).not.toContain("data_problem");
  });

  it("rozlišuje terminální stav grafiky a makety", () => {
    expect(isMaketaTerminalStatus("done", "grafika")).toBe(false);
    expect(isMaketaTerminalStatus("approved", "grafika")).toBe(true);
    expect(isMaketaTerminalStatus("done", "maketa")).toBe(true);
  });
});

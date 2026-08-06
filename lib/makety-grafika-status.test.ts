import { describe, expect, it } from "vitest";
import {
  assertGrafikaTransition,
  getAllowedGrafikaTransitions,
  grafikaStatusLabel,
  isMaketaTerminalStatus,
} from "@/lib/makety-grafika-status";

describe("makety-grafika-status", () => {
  it("labeluje prepress stavy", () => {
    expect(grafikaStatusLabel("data_problem")).toBe("Problém s daty");
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

  it("povoluje grafikovi přechod na hotovo", () => {
    const allowed = getAllowedGrafikaTransitions("in_progress", ["grafik"]);
    expect(allowed).toContain("done");
    expect(allowed).toContain("data_problem");
  });

  it("povoluje prepress a final přechody", () => {
    expect(getAllowedGrafikaTransitions("done", ["prepress"])).toEqual(["prepress_approved"]);
    expect(getAllowedGrafikaTransitions("done", ["grafik"])).not.toContain("prepress_approved");
    expect(getAllowedGrafikaTransitions("prepress_approved", ["final"])).toContain(
      "sent_for_approval"
    );
  });

  it("rozlišuje terminální stav grafiky a makety", () => {
    expect(isMaketaTerminalStatus("done", "grafika")).toBe(false);
    expect(isMaketaTerminalStatus("approved", "grafika")).toBe(true);
    expect(isMaketaTerminalStatus("done", "maketa")).toBe(true);
  });
});

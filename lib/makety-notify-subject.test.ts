import { describe, expect, it } from "vitest";
import {
  buildMaketaEmailSubject,
  buildMaketaEmailSubjectRef,
} from "./makety-notify-subject";

describe("buildMaketaEmailSubjectRef", () => {
  it("plný řetězec: job + etiketa + #grafika", () => {
    expect(
      buildMaketaEmailSubjectRef({
        maketaId: 1288,
        workType: "grafika",
        orderNumber: "Z-OLD",
        jobNumber: "JOB-261703",
        labelCode: "ETIK-44",
      })
    ).toBe("JOB-261703 / ETIK-44 (#grafika 1288)");
  });

  it("preferuje job_number před order_number", () => {
    expect(
      buildMaketaEmailSubjectRef({
        maketaId: 10,
        workType: "grafika",
        orderNumber: "ORD-1",
        jobNumber: "JOB-9",
        labelCode: null,
      })
    ).toBe("JOB-9 (#grafika 10)");
  });

  it("bez etikety: zakázka + ID", () => {
    expect(
      buildMaketaEmailSubjectRef({
        maketaId: 1288,
        workType: "grafika",
        orderNumber: "Z-991",
        jobNumber: null,
        labelCode: "  ",
      })
    ).toBe("Z-991 (#grafika 1288)");
  });

  it("jen ID když chybí zakázka i etiketa", () => {
    expect(
      buildMaketaEmailSubjectRef({
        maketaId: 1288,
        workType: "grafika",
        orderNumber: null,
        jobNumber: null,
        labelCode: null,
      })
    ).toBe("#grafika 1288");
  });

  it("u makety používá #maketa", () => {
    expect(
      buildMaketaEmailSubjectRef({
        maketaId: 55,
        workType: "maketa",
        orderNumber: "M-1",
        labelCode: "L-2",
      })
    ).toBe("M-1 / L-2 (#maketa 55)");
  });
});

describe("buildMaketaEmailSubject", () => {
  it("složí subject s ref", () => {
    expect(buildMaketaEmailSubject("Klient schválil softproof", "#grafika 1288")).toBe(
      "Klient schválil softproof · #grafika 1288 – INTEGRAF"
    );
  });

  it("plný příklad approve", () => {
    const ref = buildMaketaEmailSubjectRef({
      maketaId: 1288,
      workType: "grafika",
      jobNumber: "JOB-261703",
      labelCode: "ETIK-44",
    });
    expect(buildMaketaEmailSubject("Klient schválil softproof", ref)).toBe(
      "Klient schválil softproof · JOB-261703 / ETIK-44 (#grafika 1288) – INTEGRAF"
    );
  });

  it("bez ref spadne na title – INTEGRAF", () => {
    expect(buildMaketaEmailSubject("Klient zamítl softproof", "  ")).toBe(
      "Klient zamítl softproof – INTEGRAF"
    );
  });
});

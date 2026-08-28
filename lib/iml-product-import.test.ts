import { describe, expect, it } from "vitest";
import {
  autoMapHeaders,
  buildProductPayload,
  imlExportNoteHeuristics,
  mergeImlExportProductionNotes,
  normalizeCustomerNameKey,
  parseCsvText,
} from "@/lib/iml-product-import-parse";
import {
  extractProductCodeFromBasename,
  extractProductCodeFromFilename,
  resolvePreviewCodesFromSiblings,
  classifyFile,
} from "@/lib/iml-product-import-zip";

describe("extractProductCodeFromFilename", () => {
  it("rozpozná 6místný kód Alimpex", () => {
    const r = extractProductCodeFromFilename("499073-sanpareil-bruselska-vicko-tisk-kod.pdf");
    expect(r.code).toBe("499073");
    expect(r.kind).toBe("print");
  });

  it("zachová formát NN-NN-NNN", () => {
    const r = extractProductCodeFromFilename("06-02-040-bradet-etiketa.pdf");
    expect(r.code).toBe("06-02-040");
    expect(r.kind).toBe("print");
  });

  it("softproof s 6místným kódem", () => {
    const r = extractProductCodeFromFilename("softproof-498056-preview.jpg");
    expect(r.code).toBe("498056");
    expect(r.kind).toBe("preview");
  });
});

describe("extractProductCodeFromBasename", () => {
  it("preferuje pomlčkový formát před 6 číslicemi", () => {
    expect(extractProductCodeFromBasename("06-02-040-extra")).toBe("06-02-040");
  });

  it("vrátí null pro nerozpoznaný název", () => {
    expect(extractProductCodeFromBasename("sanpareil-brusel.pdf")).toBeNull();
  });
});

describe("parseCsvText", () => {
  it("parsuje víceřádkové quoted pole", () => {
    const csv = `code,name,material
473110,HUMMUS,"Schváleno 4.3.2020

Barevnost: CMYK
Lak: Aquaprint 150"`;
    const { headers, dataRows } = parseCsvText(csv);
    expect(headers).toEqual(["code", "name", "material"]);
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0][0]).toBe("473110");
    expect(dataRows[0][1]).toBe("HUMMUS");
    expect(dataRows[0][2]).toContain("Barevnost: CMYK");
    expect(dataRows[0][2]).toContain("Lak: Aquaprint 150");
  });

  it("odstraní UTF-8 BOM", () => {
    const { headers } = parseCsvText("\uFEFFcode,name\n1,Test");
    expect(headers[0]).toBe("code");
  });

  it("detekuje středník jako oddělovač", () => {
    const { headers } = parseCsvText("code;name;contractor\n06-02-001;Test;Zákazník");
    expect(headers).toEqual(["code", "name", "contractor"]);
  });
});

describe("autoMapHeaders", () => {
  it("mapuje type na label_shape_code, ne item_status", () => {
    const headers = [
      "code",
      "type",
      "name",
      "contractor",
      "note",
      "material",
      "print",
      "treatment",
      "realization",
    ];
    const mapping = autoMapHeaders(headers);
    expect(mapping.ig_code).toBe(0);
    expect(mapping.label_shape_code).toBe(1);
    expect(mapping.client_name).toBe(2);
    expect(mapping.customer_name).toBe(3);
    expect(mapping.print_note).toBe(6);
    expect(mapping.item_status).toBeUndefined();
    expect(mapping.production_notes).toBeUndefined();
  });
});

describe("mergeImlExportProductionNotes", () => {
  it("sloučí note, material, treatment a realization", () => {
    const headers = ["code", "note", "material", "treatment", "realization"];
    const row = ["472124", "vzorky hotové", "EUP 60µ", "lak", "hotovo"];
    const merged = mergeImlExportProductionNotes(row, headers, "");
    expect(merged).toContain("vzorky hotové");
    expect(merged).toContain("EUP 60µ");
    expect(merged).toContain("lak");
    expect(merged).toContain("hotovo");
  });
});

describe("resolvePreviewCodesFromSiblings", () => {
  it("softproof s placeholder kódem zdědí kód z PDF ve stejné složce", () => {
    const files = [
      classifyFile("1816/192107-patavi-cremosi.pdf"),
      classifyFile("1816/softproof-0x-0x-00x-patavi-cremosi-test.pdf"),
    ];
    const resolved = resolvePreviewCodesFromSiblings(files);
    const preview = resolved.find((f) => f.kind === "preview");
    expect(preview?.productCode).toBe("192107");
  });
});

describe("PackMans CSV codes", () => {
  it("rozpozná 6místný kód PackMans", () => {
    expect(extractProductCodeFromFilename("192107-patavi-cremosi.pdf").code).toBe("192107");
    expect(extractProductCodeFromFilename("901012-k-jarmark.pdf").code).toBe("901012");
  });
});

describe("normalizeCustomerNameKey", () => {
  it("sjednotí různé apostrofy", () => {
    expect(normalizeCustomerNameKey("PACKMAN´S PACK s.r.o.")).toBe(
      normalizeCustomerNameKey("PACKMAN'S PACK s.r.o.")
    );
  });
});

describe("imlExportNoteHeuristics", () => {
  it("detekuje nátisk a vzorky", () => {
    expect(imlExportNoteHeuristics("NÁTISK").hasPrintProof).toBe(true);
    expect(imlExportNoteHeuristics("vzorky hotové").hasPrintSample).toBe(true);
    expect(imlExportNoteHeuristics("2023-11-13 nátisk").hasPrintProof).toBe(true);
    expect(imlExportNoteHeuristics("").hasPrintProof).toBe(false);
  });
});

describe("buildProductPayload item_status", () => {
  it("bez sloupce stavu nastaví neaktivní", async () => {
    const mapping = autoMapHeaders(["code", "name"]);
    const built = await buildProductPayload(
      ["473110", "Test produkt"],
      0,
      mapping,
      new Map(),
      "Tester"
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.data.item_status).toBe("neaktivní");
  });

  it("explicitní hodnota stavu v CSV se zachová", async () => {
    const mapping = { ig_code: 0, client_name: 1, item_status: 2 };
    const built = await buildProductPayload(
      ["473110", "Test produkt", "chyba"],
      0,
      mapping,
      new Map(),
      "Tester"
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.data.item_status).toBe("chyba");
  });
});

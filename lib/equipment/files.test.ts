import path from "path";
import { describe, expect, it } from "vitest";
import { equipmentFileUrl } from "./file-url";
import {
  equipmentDownloadName,
  equipmentFileContentDisposition,
  equipmentFileDiskPath,
  equipmentServeHeaders,
} from "./files";

describe("equipmentFileDiskPath", () => {
  it("vrátí cestu na disku pro soubor ve složce dané položky", () => {
    expect(equipmentFileDiskPath(11, "/uploads/equipment/11/1790_abc.png")).toBe(
      path.join(process.cwd(), "public", "uploads", "equipment", "11", "1790_abc.png")
    );
  });

  it.each([
    ["soubor jiné položky", "/uploads/equipment/12/1790_abc.png"],
    ["pokus o výstup ze složky", "/uploads/equipment/11/../12/x.png"],
    ["podsložka", "/uploads/equipment/11/sub/x.png"],
    ["zpětná lomítka", "\\uploads\\equipment\\11\\x.png"],
    ["jiný modul", "/uploads/makety/11/x.png"],
    ["půdorys (má vlastní API)", "/uploads/equipment/floor-plans/11/plan.png"],
    ["tečky místo názvu", "/uploads/equipment/11/.."],
  ])("odmítne %s", (_label, filePath) => {
    expect(equipmentFileDiskPath(11, filePath)).toBeNull();
  });
});

describe("equipmentFileContentDisposition", () => {
  it("diakritiku dá do filename* a do filename jen ASCII", () => {
    expect(equipmentFileContentDisposition("Faktura č. 1.pdf", "inline")).toBe(
      "inline; filename=\"Faktura c. 1.pdf\"; filename*=UTF-8''Faktura%20%C4%8D.%201.pdf"
    );
  });

  it("uvozovky a konce řádků v názvu nerozbijí hlavičku", () => {
    const header = equipmentFileContentDisposition('a"b\r\nc.pdf', "attachment");
    expect(header.startsWith('attachment; filename="a_b__c.pdf"')).toBe(true);
    expect(header).not.toMatch(/[\r\n]/);
  });

  it("prázdný název nahradí slovem soubor", () => {
    expect(equipmentFileContentDisposition("", "attachment")).toBe(
      "attachment; filename=\"soubor\"; filename*=UTF-8''soubor"
    );
  });
});

describe("equipmentServeHeaders", () => {
  it("fotku zobrazí v prohlížeči a nechá ji cachovat", () => {
    const h = equipmentServeHeaders("image/png", "foto.png", false);
    expect(h["Content-Type"]).toBe("image/png");
    expect(h["Content-Disposition"].startsWith("inline;")).toBe(true);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toBe("private, max-age=86400, immutable");
  });

  it("PDF zobrazí v prohlížeči, ale necachuje", () => {
    const h = equipmentServeHeaders("application/pdf", "faktura.pdf", false);
    expect(h["Content-Disposition"].startsWith("inline;")).toBe(true);
    expect(h["Cache-Control"]).toBe("private, no-store");
  });

  it("Word nabídne ke stažení", () => {
    const h = equipmentServeHeaders(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "smlouva.docx",
      false
    );
    expect(h["Content-Disposition"].startsWith("attachment;")).toBe(true);
  });

  it("nepovolený typ pošle jako binární soubor ke stažení", () => {
    const h = equipmentServeHeaders("text/html", "x.html", false);
    expect(h["Content-Type"]).toBe("application/octet-stream");
    expect(h["Content-Disposition"].startsWith("attachment;")).toBe(true);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("chybějící typ pošle jako binární ke stažení", () => {
    const h = equipmentServeHeaders(null, "x", false);
    expect(h["Content-Type"]).toBe("application/octet-stream");
    expect(h["Content-Disposition"].startsWith("attachment;")).toBe(true);
  });

  it("?download=1 vynutí stažení i u fotky", () => {
    expect(equipmentServeHeaders("image/jpeg", "foto.jpg", true)["Content-Disposition"].startsWith("attachment;")).toBe(
      true
    );
  });
});

describe("equipmentFileUrl", () => {
  it("vede přes API s kontrolou oprávnění", () => {
    expect(equipmentFileUrl(11, 178)).toBe("/api/equipment/11/files/178");
    expect(equipmentFileUrl(11, 178, { download: true })).toBe("/api/equipment/11/files/178?download=1");
  });
});

describe("equipmentDownloadName", () => {
  it.each([
    ["Faktura_2026.hta", "/uploads/equipment/11/1790_a.docx", "Faktura_2026.docx"],
    ["setup.msi", "/uploads/equipment/11/1790_a.doc", "setup.doc"],
    ["fotka-z-telefonu", "/uploads/equipment/11/1790_a.jpg", "fotka-z-telefonu.jpg"],
    ["smlouva.docx", "/uploads/equipment/11/1790_a.docx", "smlouva.docx"],
    ["", "/uploads/equipment/11/1790_a.pdf", "soubor.pdf"],
    ["starý.exe", "/uploads/equipment/11/1790_a.exe", "starý.bin"],
  ])("%s uložený jako %s se stáhne jako %s", (original, filePath, expected) => {
    expect(equipmentDownloadName(original, filePath)).toBe(expected);
  });
});

describe("equipmentFileContentDisposition — přísné kódování", () => {
  it("apostrof, závorky a hvězdičku zakóduje i ve filename*", () => {
    expect(equipmentFileContentDisposition("a'b(c)*.pdf", "inline")).toBe(
      "inline; filename=\"a_b_c__.pdf\"; filename*=UTF-8''a%27b%28c%29%2A.pdf"
    );
  });
});

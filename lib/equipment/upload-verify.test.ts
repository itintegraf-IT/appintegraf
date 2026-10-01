import { describe, expect, it } from "vitest";
import { sniffEquipmentFileType, verifyEquipmentUpload } from "./upload-verify";

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));
const concat = (...parts: Uint8Array[]) => Uint8Array.from(Buffer.concat(parts.map((p) => Buffer.from(p))));

// Skutečný 1×1 PNG.
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  )
);
const JPEG_HEAD = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const GIF = ascii("GIF89a\x01\x00\x01\x00\x00\x00\x00;");
const WEBP = concat(ascii("RIFF"), bytes(0x24, 0, 0, 0), ascii("WEBPVP8 "), bytes(0, 0, 0, 0));
const PDF = ascii("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
/** Minimální lokální hlavička ZIP (30 B) s názvem položky. */
const zipEntry = (name: string) => {
  const header = new Uint8Array(30);
  header.set([0x50, 0x4b, 0x03, 0x04, 0x14, 0]);
  header[26] = name.length & 0xff;
  header[27] = name.length >> 8;
  return concat(header, ascii(name));
};
const DOCX = concat(zipEntry("[Content_Types].xml"), zipEntry("word/document.xml"));
const PLAIN_ZIP = zipEntry("data/report.csv");
/** ZIP, který jen obsahuje text „word/document.xml“, ale žádný dokument Wordu. */
const FAKE_DOCX = concat(zipEntry("payload.hta"), ascii("<!-- word/document.xml --><script>"));
const HTML_WITH_PDF_MARKER = ascii("<html><!-- %PDF-1.4 --><script>alert(1)</script></html>");
const CFB = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0);
const HTML = ascii("<!doctype html><html><script>alert(document.cookie)</script></html>");
const SVG = ascii('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
const XML_SVG = ascii('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("sniffEquipmentFileType", () => {
  it.each([
    ["JPEG", JPEG_HEAD, "image/jpeg", ".jpg"],
    ["PNG", PNG_1X1, "image/png", ".png"],
    ["GIF", GIF, "image/gif", ".gif"],
    ["WebP", WEBP, "image/webp", ".webp"],
    ["PDF", PDF, "application/pdf", ".pdf"],
    ["DOCX", DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ])("pozná %s podle obsahu", (_name, buf, mime, ext) => {
    expect(sniffEquipmentFileType(buf)).toEqual({ mime, ext });
  });

  it("PDF s BOM nebo prázdnými řádky před hlavičkou pozná", () => {
    expect(sniffEquipmentFileType(concat(ascii("\r\n"), PDF))?.mime).toBe("application/pdf");
    expect(sniffEquipmentFileType(concat(bytes(0xef, 0xbb, 0xbf), PDF))?.mime).toBe("application/pdf");
  });

  it.each([
    ["HTML", HTML],
    ["SVG", SVG],
    ["XML se SVG", XML_SVG],
    ["ZIP bez Wordu", PLAIN_ZIP],
    ["ZIP s textem word/document.xml jen uvnitř obsahu", FAKE_DOCX],
    ["HTML se značkou %PDF- v komentáři", HTML_WITH_PDF_MARKER],
    ["prázdný soubor", new Uint8Array()],
  ])("%s nerozpozná jako povolený typ", (_name, buf) => {
    expect(sniffEquipmentFileType(buf)).toBeNull();
  });
});

describe("verifyEquipmentUpload", () => {
  it("fotku JPEG přijme a příponu i typ určí server, ne prohlížeč", () => {
    expect(verifyEquipmentUpload(JPEG_HEAD, "application/octet-stream", "photo")).toEqual({
      ok: true,
      mime: "image/jpeg",
      ext: ".jpg",
    });
  });

  it("HTML vydávané prohlížečem za PNG odmítne u fotky i přílohy", () => {
    expect(verifyEquipmentUpload(HTML, "image/png", "photo").ok).toBe(false);
    expect(verifyEquipmentUpload(HTML, "image/png", "attachment").ok).toBe(false);
  });

  it("SVG odmítne i s deklarovaným image/svg+xml", () => {
    expect(verifyEquipmentUpload(SVG, "image/svg+xml", "photo").ok).toBe(false);
  });

  it("PDF přijme jako přílohu, ale ne jako fotku", () => {
    expect(verifyEquipmentUpload(PDF, "", "attachment")).toEqual({ ok: true, mime: "application/pdf", ext: ".pdf" });
    expect(verifyEquipmentUpload(PDF, "application/pdf", "photo").ok).toBe(false);
  });

  it("starý Word (.doc) přijme jen když prohlížeč hlásí application/msword", () => {
    expect(verifyEquipmentUpload(CFB, "application/msword", "attachment")).toEqual({
      ok: true,
      mime: "application/msword",
      ext: ".doc",
    });
    expect(verifyEquipmentUpload(CFB, "application/vnd.ms-excel", "attachment").ok).toBe(false);
    expect(verifyEquipmentUpload(CFB, "application/msword", "photo").ok).toBe(false);
  });

  it("půdorys: PDF a PNG ano, GIF ne", () => {
    expect(verifyEquipmentUpload(PDF, "", "floor_plan").ok).toBe(true);
    expect(verifyEquipmentUpload(PNG_1X1, "", "floor_plan").ok).toBe(true);
    expect(verifyEquipmentUpload(GIF, "image/gif", "floor_plan").ok).toBe(false);
  });

  it("odmítnutí vrací českou hlášku pro uživatele", () => {
    const res = verifyEquipmentUpload(new Uint8Array(), "image/jpeg", "photo");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/typ souboru/i);
  });
});

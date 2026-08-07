import { describe, expect, it } from "vitest";
import { join } from "path";
import { parsePaletovkaXlsFile } from "@/lib/stitky/paletovky/xls-import";

const fixtures = join(process.cwd(), "lib", "stitky", "paletovky", "fixtures");

describe("parsePaletovkaXlsFile", () => {
  it("parsuje single layout (5P AGENCY)", () => {
    const r = parsePaletovkaXlsFile(join(fixtures, "5p-agency-obalky.xls"));
    expect(r.layoutVariant).toBe("single");
    expect(r.blocksPerPage).toBe(1);
    expect(r.defaults.blocks[0].zadavatel).toContain("5 P Agency");
    expect(r.defaults.blocks[0].zakazka).toBe("OBÁLKY");
    expect(r.defaults.blocks[0].cisloZakazky).toBe("28050");
    expect(r.defaults.blocks[0].jednotkaLabel).toBe("Krabice");
  });

  it("parsuje single layout (ACA 1213)", () => {
    const r = parsePaletovkaXlsFile(join(fixtures, "aca-1213.xls"));
    expect(r.layoutVariant).toBe("single");
    expect(r.defaults.blocks[0].zadavatel).toContain("ACA");
    expect(r.defaults.blocks[0].jednotkaLabel).toBe("Paleta");
  });

  it("parsuje dual_horizontal (106 PRODUCTION)", () => {
    const r = parsePaletovkaXlsFile(join(fixtures, "106-production.xls"));
    expect(r.layoutVariant).toBe("dual_horizontal");
    expect(r.blocksPerPage).toBe(2);
    expect(r.defaults.blocks[0].cisloZakazky).toBe("A07756");
    expect(r.defaults.blocks[1].cisloZakazky).toBe("A11793");
  });

  it("parsuje stacked layout (ASTRON)", () => {
    const r = parsePaletovkaXlsFile(join(fixtures, "astron.xls"));
    expect(r.layoutVariant).toBe("stacked");
    expect(r.blocksPerPage).toBeGreaterThanOrEqual(2);
    expect(r.defaults.blocks[0].zadavatel).toContain("ASTRON");
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAKETY_DATA_KIND,
  maketyDataKindLabel,
  parseMaketyDataKind,
} from "@/lib/makety-data-kind";

describe("parseMaketyDataKind", () => {
  it("parsuje platné hodnoty", () => {
    expect(parseMaketyDataKind("nova_data")).toBe("nova_data");
    expect(parseMaketyDataKind("uprava_dat")).toBe("uprava_dat");
    expect(parseMaketyDataKind(" Uprava_Dat ")).toBe("uprava_dat");
  });

  it("vrací fallback u neplatných hodnot", () => {
    expect(parseMaketyDataKind("")).toBe(DEFAULT_MAKETY_DATA_KIND);
    expect(parseMaketyDataKind("x")).toBe(DEFAULT_MAKETY_DATA_KIND);
    expect(parseMaketyDataKind(null, "uprava_dat")).toBe("uprava_dat");
  });
});

describe("maketyDataKindLabel", () => {
  it("vrací české labely", () => {
    expect(maketyDataKindLabel("nova_data")).toBe("nová data");
    expect(maketyDataKindLabel("uprava_dat")).toBe("úprava dat");
  });
});

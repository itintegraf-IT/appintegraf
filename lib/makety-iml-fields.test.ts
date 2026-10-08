import { describe, expect, it } from "vitest";
import { parseMaketyImlFieldsFromInput } from "@/lib/makety-iml-fields";

describe("parseMaketyImlFieldsFromInput", () => {
  it("parsuje prázdná pole jako null", () => {
    const fd = new FormData();
    fd.set("customer_id", "");
    fd.set("product_id", "");
    const result = parseMaketyImlFieldsFromInput(fd);
    expect(result).toEqual({
      customer_id: null,
      product_id: null,
      die_cut_id: null,
      shape_id: null,
      label_code: null,
      product_name: null,
      job_number: null,
    });
  });

  it("parsuje platná ID a texty", () => {
    const result = parseMaketyImlFieldsFromInput({
      customer_id: "12",
      product_id: "34",
      die_cut_id: "5",
      shape_id: "7",
      label_code: " IG-001 ",
      product_name: " Etiketa A ",
      job_number: "Z2026-99",
    });
    expect(result).toEqual({
      customer_id: 12,
      product_id: 34,
      die_cut_id: 5,
      shape_id: 7,
      label_code: "IG-001",
      product_name: "Etiketa A",
      job_number: "Z2026-99",
    });
  });

  it("odmítne neplatné ID", () => {
    const result = parseMaketyImlFieldsFromInput({ customer_id: "abc" });
    expect(result).toEqual({ error: "Neplatný klient" });
  });
});

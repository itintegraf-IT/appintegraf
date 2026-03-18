import { describe, it, expect } from "vitest";
import { pocetVyhozu } from "./pocet-vyhozu";

describe("pocetVyhozu", () => {
  it("zaokrouhluje nahoru ceil(PocetKS / PROD)", () => {
    expect(pocetVyhozu(20, 6)).toBe(4); // 20/6 = 3.33 -> 4
    expect(pocetVyhozu(18, 6)).toBe(3); // 18/6 = 3
    expect(pocetVyhozu(1, 6)).toBe(1);
  });
});

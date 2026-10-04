import { describe, expect, it } from "vitest";
import { roomLocationFromPlan } from "./floor-plan";

describe("roomLocationFromPlan", () => {
  const plan = { floor_label: "2NP", building: "Administrativa" };

  it("prázdné patro a budovu doplní z plánku", () => {
    expect(roomLocationFromPlan({ floor: null, building: null }, plan, {})).toEqual({ floor: "2NP", building: "Administrativa" });
  });

  it("vyplněné hodnoty nepřepíše", () => {
    expect(roomLocationFromPlan({ floor: "1NP", building: "Hala" }, plan, {})).toEqual({});
  });

  it("co uživatel posílá sám, nedoplňuje", () => {
    expect(roomLocationFromPlan({ floor: null, building: null }, plan, { floor: true })).toEqual({ building: "Administrativa" });
  });

  it("plánek bez budovy doplní jen patro", () => {
    expect(roomLocationFromPlan({ floor: " ", building: null }, { floor_label: "1NP", building: null }, {})).toEqual({ floor: "1NP" });
  });
});

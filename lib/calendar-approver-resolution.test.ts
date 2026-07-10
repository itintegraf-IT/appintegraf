import { describe, expect, it } from "vitest";
import {
  resolveApproverDepartmentId,
  isUserAbsentAt,
  isUserAbsentInRange,
} from "./calendar-approver-resolution";

describe("resolveApproverDepartmentId", () => {
  it("vrátí hlavní oddělení", () => {
    expect(
      resolveApproverDepartmentId({
        department_id: 5,
        user_secondary_departments: [{ department_id: 9 }],
      })
    ).toBe(5);
  });

  it("bez hlavního vrátí první sekundární", () => {
    expect(
      resolveApproverDepartmentId({
        department_id: null,
        user_secondary_departments: [{ department_id: 9 }, { department_id: 12 }],
      })
    ).toBe(9);
  });

  it("bez oddělení vrátí null", () => {
    expect(
      resolveApproverDepartmentId({
        department_id: null,
        user_secondary_departments: [],
      })
    ).toBeNull();
  });
});

describe("isUserAbsentAt", () => {
  it("deleguje na isUserAbsentInRange se stejným začátkem a koncem", async () => {
    const at = new Date("2026-07-10T10:00:00Z");
    const db = {
      calendar_events: {
        findFirst: async (args: { where: { start_date: { lte: Date }; end_date: { gte: Date } } }) => {
          expect(args.where.start_date.lte).toEqual(at);
          expect(args.where.end_date.gte).toEqual(at);
          return null;
        },
      },
    };
    await expect(isUserAbsentAt(db as never, 1, at)).resolves.toBe(false);
  });
});

describe("isUserAbsentInRange", () => {
  it("používá rozsah start–end pro kolize termínu", async () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-08-07T23:59:59Z");
    const db = {
      calendar_events: {
        findFirst: async (args: { where: { start_date: { lte: Date }; end_date: { gte: Date } } }) => {
          expect(args.where.start_date.lte).toEqual(end);
          expect(args.where.end_date.gte).toEqual(start);
          return { id: 99 };
        },
      },
    };
    await expect(isUserAbsentInRange(db as never, 1, start, end)).resolves.toBe(true);
  });
});

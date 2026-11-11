import { describe, expect, it } from "vitest";
import {
  resolveApproverDepartmentId,
  isUserAbsentAt,
  isUserAbsentInRange,
  isCzechWorkingDay,
  subtractWorkingDays,
  shouldKeepAbsentApprover,
  getCurrentAbsenceEnd,
  resolveDepartmentCalendarApprover,
  formatApproverAssignmentNote,
} from "./calendar-approver-resolution";
import { parseDateTimeLocalInput } from "./datetime-cz";

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

describe("isCzechWorkingDay", () => {
  it("pátek je pracovní den", () => {
    expect(isCzechWorkingDay("2026-05-15")).toBe(true);
  });

  it("sobota není pracovní den", () => {
    expect(isCzechWorkingDay("2026-05-16")).toBe(false);
  });

  it("1. května (svátek) není pracovní den", () => {
    expect(isCzechWorkingDay("2026-05-01")).toBe(false);
  });
});

describe("subtractWorkingDays", () => {
  it("odečte 3 pracovní dny (přes víkend)", () => {
    // St 20. 5. 2026 09:00 → -3 WD = Pá 15. 5. 2026 09:00
    const from = parseDateTimeLocalInput("2026-05-20T09:00");
    const result = subtractWorkingDays(from, 3);
    expect(result).toEqual(parseDateTimeLocalInput("2026-05-15T09:00"));
  });

  it("přeskočí státní svátek (1. 5. 2026 pátek)", () => {
    // Po 4. 5. 2026 → -1 WD = Čt 30. 4. 2026 (pátek 1. 5. je svátek)
    const from = parseDateTimeLocalInput("2026-05-04T10:00");
    const result = subtractWorkingDays(from, 1);
    expect(result).toEqual(parseDateTimeLocalInput("2026-04-30T10:00"));
  });
});

describe("shouldKeepAbsentApprover", () => {
  it("ponechá, když návrat stihne 3 WD před startem", () => {
    const eventStart = parseDateTimeLocalInput("2026-05-20T09:00");
    const returnAt = parseDateTimeLocalInput("2026-05-14T23:59"); // před Pá 15. 5. 09:00
    expect(shouldKeepAbsentApprover(returnAt, eventStart)).toBe(true);
  });

  it("přeskočí, když návrat je pozdě", () => {
    const eventStart = parseDateTimeLocalInput("2026-05-20T09:00");
    const returnAt = parseDateTimeLocalInput("2026-05-18T12:00"); // Po – méně než 3 WD
    expect(shouldKeepAbsentApprover(returnAt, eventStart)).toBe(false);
  });
});

describe("getCurrentAbsenceEnd", () => {
  it("vrátí max(end_date) z překrývajících OOO", async () => {
    const at = parseDateTimeLocalInput("2026-05-10T12:00");
    const db = {
      calendar_events: {
        findMany: async () => [
          { end_date: parseDateTimeLocalInput("2026-05-12T23:59") },
          { end_date: parseDateTimeLocalInput("2026-05-14T18:00") },
        ],
      },
    };
    await expect(getCurrentAbsenceEnd(db as never, 1, at)).resolves.toEqual(
      parseDateTimeLocalInput("2026-05-14T18:00")
    );
  });

  it("bez absence vrátí null", async () => {
    const db = {
      calendar_events: {
        findMany: async () => [],
      },
    };
    await expect(
      getCurrentAbsenceEnd(db as never, 1, parseDateTimeLocalInput("2026-05-10T12:00"))
    ).resolves.toBeNull();
  });
});

describe("resolveDepartmentCalendarApprover – návrat včas", () => {
  const presenceAt = parseDateTimeLocalInput("2026-05-10T10:00");

  function mockDb(opts: {
    primaryAbsent: boolean;
    primaryReturnAt?: Date;
    secondaryUserId?: number | null;
  }) {
    return {
      departments: {
        findUnique: async () => ({
          manager_id: 99,
          calendar_department_approvers: {
            primary_user_id: 10,
            secondary_user_id: opts.secondaryUserId ?? 20,
            tertiary_user_id: null,
          },
        }),
      },
      calendar_events: {
        findFirst: async (args: { where: { created_by: number } }) => {
          if (args.where.created_by === 10 && opts.primaryAbsent) {
            return { id: 1 };
          }
          return null;
        },
        findMany: async (args: { where: { created_by: number } }) => {
          if (args.where.created_by === 10 && opts.primaryAbsent && opts.primaryReturnAt) {
            return [{ end_date: opts.primaryReturnAt }];
          }
          return [];
        },
      },
    };
  }

  it("přítomného primary přiřadí", async () => {
    const db = mockDb({ primaryAbsent: false });
    const resolved = await resolveDepartmentCalendarApprover(db as never, 1, {
      presenceAt,
      eventStart: parseDateTimeLocalInput("2026-05-20T09:00"),
    });
    expect(resolved).toMatchObject({ userId: 10, tier: "primary" });
    expect(resolved?.waitingForReturn).toBeUndefined();
  });

  it("nepřítomného primary ponechá, když se vrátí včas", async () => {
    const db = mockDb({
      primaryAbsent: true,
      primaryReturnAt: parseDateTimeLocalInput("2026-05-14T23:59"),
    });
    const resolved = await resolveDepartmentCalendarApprover(db as never, 1, {
      presenceAt,
      eventStart: parseDateTimeLocalInput("2026-05-20T09:00"),
    });
    expect(resolved).toMatchObject({
      userId: 10,
      tier: "primary",
      waitingForReturn: true,
      skippedTiers: [],
    });
  });

  it("nepřítomného primary přeskočí, když návrat nestihne 3 WD", async () => {
    const db = mockDb({
      primaryAbsent: true,
      primaryReturnAt: parseDateTimeLocalInput("2026-05-18T12:00"),
    });
    const resolved = await resolveDepartmentCalendarApprover(db as never, 1, {
      presenceAt,
      eventStart: parseDateTimeLocalInput("2026-05-20T09:00"),
    });
    expect(resolved).toMatchObject({
      userId: 20,
      tier: "secondary",
      skippedTiers: ["primary"],
    });
  });
});

describe("formatApproverAssignmentNote", () => {
  it("zmíní čekání na návrat", () => {
    const note = formatApproverAssignmentNote("Jan Novák", "primary", [], true);
    expect(note).toContain("návrat včas");
  });
});

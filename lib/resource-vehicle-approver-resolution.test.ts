import { describe, expect, it } from "vitest";
import {
  formatVehicleApproverAssignmentNote,
  resolveVehicleReservationApprover,
  vehicleApproverTierLabel,
} from "./resource-vehicle-approver-resolution";
import { parseDateTimeLocalInput } from "./datetime-cz";

describe("vehicleApproverTierLabel", () => {
  it("vrátí český popisek", () => {
    expect(vehicleApproverTierLabel("primary")).toContain("primární");
  });
});

describe("formatVehicleApproverAssignmentNote", () => {
  it("bez přeskočených tierů", () => {
    expect(formatVehicleApproverAssignmentNote("Jan Novák", "primary", [])).toContain("Jan Novák");
  });

  it("s přeskočenými tiery", () => {
    const note = formatVehicleApproverAssignmentNote("Jan Novák", "secondary", ["primary"]);
    expect(note).toContain("nepřítomen");
  });

  it("zmíní čekání na návrat", () => {
    const note = formatVehicleApproverAssignmentNote("Jan Novák", "primary", [], true);
    expect(note).toContain("návrat včas");
  });
});

describe("resolveVehicleReservationApprover – návrat včas", () => {
  const presenceAt = parseDateTimeLocalInput("2026-05-10T10:00");

  function mockDb(opts: {
    primaryAbsent: boolean;
    primaryReturnAt?: Date;
  }) {
    return {
      resource_vehicle_approvers: {
        findUnique: async () => ({
          primary_user_id: 10,
          secondary_user_id: 20,
          tertiary_user_id: null,
        }),
      },
      calendar_events: {
        findFirst: async (args: { where: { created_by: number } }) => {
          if (args.where.created_by === 10 && opts.primaryAbsent) return { id: 1 };
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

  it("ponechá nepřítomného primary při návratu včas", async () => {
    const db = mockDb({
      primaryAbsent: true,
      primaryReturnAt: parseDateTimeLocalInput("2026-05-14T23:59"),
    });
    const resolved = await resolveVehicleReservationApprover(db as never, {
      presenceAt,
      reservationStart: parseDateTimeLocalInput("2026-05-20T09:00"),
    });
    expect(resolved).toMatchObject({
      userId: 10,
      tier: "primary",
      waitingForReturn: true,
    });
  });

  it("přeskočí primary při pozdním návratu", async () => {
    const db = mockDb({
      primaryAbsent: true,
      primaryReturnAt: parseDateTimeLocalInput("2026-05-18T12:00"),
    });
    const resolved = await resolveVehicleReservationApprover(db as never, {
      presenceAt,
      reservationStart: parseDateTimeLocalInput("2026-05-20T09:00"),
    });
    expect(resolved).toMatchObject({
      userId: 20,
      tier: "secondary",
      skippedTiers: ["primary"],
    });
  });
});

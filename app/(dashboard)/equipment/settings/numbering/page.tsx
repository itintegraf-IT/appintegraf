import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import {
  firstAllowedSeriesStart,
  maxSeriesTagInDb,
  nextSeriesTags,
  readAssetTagSeries,
} from "@/lib/equipment/asset-number";
import { NumberingSettingsClient } from "./NumberingSettingsClient";

export default async function EquipmentNumberingSettingsPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canAdministerEquipment(userId))) redirect("/equipment");

  const series = await readAssetTagSeries(prisma);
  const maxInDb = await maxSeriesTagInDb(prisma);
  const minAllowed = firstAllowedSeriesStart({ maxInDb, lastIssued: series?.lastIssued ?? null });
  let nextTag: string | null = null;
  if (series) {
    try {
      nextTag = nextSeriesTags({ ...series, maxInDb, count: 1 })[0];
    } catch {
      nextTag = null;
    }
  }

  return (
    <NumberingSettingsClient
      start={series?.start ?? null}
      lastIssued={series?.lastIssued ?? null}
      maxInDb={maxInDb}
      minAllowed={minAllowed}
      nextTag={nextTag}
    />
  );
}

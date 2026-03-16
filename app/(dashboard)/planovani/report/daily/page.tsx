import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlanovaniRole } from "@/lib/planovani-auth";
import { Suspense } from "react";
import ReportView from "./ReportView";

export default async function DailyReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) redirect("/planovani");

  return (
    <Suspense
      fallback={
        <div style={{ fontFamily: "-apple-system, sans-serif", padding: 40, color: "#6b7280" }}>
          Načítám data…
        </div>
      }
    >
      <ReportView />
    </Suspense>
  );
}

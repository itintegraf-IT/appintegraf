import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { TechnologieCodebookClient } from "../TechnologieCodebookClient";

export default async function TechnologieSheetTypesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "technologie", "write"))) redirect("/technologie");

  return (
    <TechnologieCodebookClient
      config={{
        title: "Typy archů",
        apiBase: "/api/technologie/sheet-types",
        backHref: "/technologie/ciselniky",
        itemLabel: "typ",
        countField: "technologie",
      }}
    />
  );
}

import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseTroubleKb } from "@/lib/helpdesk/parse-trouble-kb";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PozadavkyClient } from "./PozadavkyClient";

export const dynamic = "force-dynamic";

async function loadTroubleCategories() {
  try {
    const filePath = path.join(process.cwd(), "docs", "trouble.txt");
    const content = await readFile(filePath, "utf8");
    return parseTroubleKb(content);
  } catch {
    return [];
  }
}

export default async function PozadavkyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = parseInt(session.user.id, 10);
  const [user, troubleCategories] = await Promise.all([
    prisma.users.findUnique({
      where: { id: userId },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        department_name: true,
        position: true,
        is_active: true,
      },
    }),
    loadTroubleCategories(),
  ]);

  if (!user || !user.is_active) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<p className="text-gray-500">Načítám…</p>}>
      <PozadavkyClient profile={user} troubleCategories={troubleCategories} />
    </Suspense>
  );
}

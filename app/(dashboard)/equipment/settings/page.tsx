import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { FolderTree, QrCode, Shield } from "lucide-react";

const cards = [
  {
    href: "/equipment/settings/categories",
    icon: FolderTree,
    title: "Skupiny majetku",
    hint: "Přidání, úprava a mazání skupin a zodpovědných uživatelů",
  },
  {
    href: "/equipment/settings/access",
    icon: Shield,
    title: "Přístupy",
    hint: "Přiřazení skupin majetku uživatelům (čtení)",
  },
  {
    href: "/equipment/settings/qr-pool",
    icon: QrCode,
    title: "Fond QR",
    hint: "Generování, tisk a přiřazení inventárních QR kódů",
  },
] as const;

export default async function EquipmentSettingsHubPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canAdministerEquipment(userId))) redirect("/equipment");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nastavení majetku</h1>
        <p className="mt-1 text-gray-600">Skupiny, přístupy a fond QR kódů</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, icon: Icon, title, hint }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{title}</p>
              <p className="mt-1 text-sm text-gray-600">{hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import { PublicEquipmentRequestForm } from "./PublicEquipmentRequestForm";

export default async function PublicEquipmentRequestPage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-7 w-7 text-red-600" />
          Požadavek na techniku
        </h1>
        <p className="mt-1 text-gray-600">
          Vyplňte formulář pro požadavek na nové technické vybavení
        </p>
      </div>

      <PublicEquipmentRequestForm showInternalLink={isLoggedIn} />
    </>
  );
}

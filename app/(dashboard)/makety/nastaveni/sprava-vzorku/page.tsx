import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import { SpravaVzorkuNotifyTemplateForm } from "./SpravaVzorkuNotifyTemplateForm";

export default async function MaketySpravaVzorkuTemplatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canViewAllMaketyTypes(userId))) {
    redirect("/makety");
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Notifikace správy vzorků</h2>
      <p className="mb-4 text-sm text-gray-600">
        Text e-mailu a in-app notifikace při zadání grafiky s úpravou dat
      </p>
      <SpravaVzorkuNotifyTemplateForm />
    </div>
  );
}

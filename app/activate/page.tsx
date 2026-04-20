import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  return (
    <AuthCard
      title="Aktivace účtu"
      subtitle="Nastavte si první přihlašovací heslo"
    >
      <Suspense fallback={null}>
        <SetPasswordForm
          token={token}
          purpose="account_activation"
          submitLabel="Aktivovat účet"
          successTitle="Účet byl aktivován."
        />
      </Suspense>
    </AuthCard>
  );
}

import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  return (
    <AuthCard title="Nastavení nového hesla" subtitle="Platnost odkazu je 30 minut">
      <Suspense fallback={null}>
        <SetPasswordForm
          token={token}
          purpose="password_reset"
          submitLabel="Uložit nové heslo"
          successTitle="Heslo bylo změněno."
        />
      </Suspense>
    </AuthCard>
  );
}

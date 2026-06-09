"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/crm/DeleteConfirmDialog";
import { CompanyReminderButton } from "@/components/crm/reminders/CompanyReminderButton";

export function CompanyDetailActions({ id, name, canEdit }: { id: string; name: string; canEdit: boolean }) {
  const router = useRouter();
  if (!canEdit) return null;

  async function onDelete() {
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      toast.error(j.error ?? "Smazání selhalo");
      return;
    }
    toast.success("Firma smazána");
    router.push("/crm/companies");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <CompanyReminderButton company={{ id, name }} />
      <Button asChild variant="outline">
        <Link href={`/crm/companies/${id}/edit`}>Upravit</Link>
      </Button>
      <DeleteConfirmDialog
        trigger={<Button variant="destructive">Smazat</Button>}
        title="Smazat firmu?"
        description="Smažou se i všechny kontakty a dealy navázané na tuto firmu."
        onConfirm={onDelete}
      />
    </div>
  );
}

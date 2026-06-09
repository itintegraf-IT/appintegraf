"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { crmUserDisplayName } from "@/lib/crm/users";

type Att = {
  id: string;
  file_name: string;
  size: number;
  mime: string;
  created_at: string | Date;
  uploader: { first_name?: string | null; last_name?: string | null; email?: string | null; name?: string | null } | null;
  canDelete: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function AttachmentList({ attachments }: { attachments: Att[] }) {
  const router = useRouter();

  async function onDelete(id: string) {
    if (!confirm("Opravdu smazat přílohu?")) return;
    const res = await fetch(`/api/crm/attachments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Chyba");
      return;
    }
    toast.success("Smazáno");
    router.refresh();
  }

  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="Žádné přílohy"
        description="Nahraj PDF, obrázek nebo dokument pro tento záznam."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {attachments.map((a) => {
        const d = typeof a.created_at === "string" ? new Date(a.created_at) : a.created_at;
        return (
          <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <a href={`/api/crm/attachments/${a.id}/download`} className="truncate font-medium hover:underline">
                {a.file_name}
              </a>
              <p className="text-xs text-muted-foreground">
                {formatSize(a.size)} ·{" "}
                {a.uploader ? (a.uploader.name ?? crmUserDisplayName(a.uploader) ?? a.uploader.email ?? "Uživatel") : "Smazaný uživatel"} ·{" "}
                {format(d, "d. M. yyyy HH:mm", { locale: cs })}
              </p>
            </div>
            {a.canDelete ? (
              <Button variant="ghost" size="sm" onClick={() => onDelete(a.id)}>
                Smazat
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

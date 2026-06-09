"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { crm_parent_type } from "@prisma/client";

export function AttachmentUpload({ parent_type, parent_id }: { parent_type: crm_parent_type; parent_id: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("parent_type", parent_type);
      fd.append("parent_id", parent_id);
      fd.append("file", file);
      const res = await fetch("/api/crm/attachments", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Chyba");
      }
      toast.success(`Nahráno: ${file.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
        accept=".pdf,.docx,.xlsx,.doc,.xls,.png,.jpg,.jpeg,.eml,.msg"
      />
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? "Nahrávám…" : "Nahrát přílohu"}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">Max 25 MB. PDF, DOCX, XLSX, PNG, JPG, EML, MSG.</p>
    </div>
  );
}

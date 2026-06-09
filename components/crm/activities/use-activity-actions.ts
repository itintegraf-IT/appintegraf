"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { crm_activity_type } from "@prisma/client";
import { useHiddenActivities } from "./hidden-activities-context";

const UNDO_WINDOW_MS = 5000;

type ActivityRef = {
  id: string;
  owner_id: number;
  assignee_id: number | null;
  type: crm_activity_type;
};

export function useActivityActions(activity: ActivityRef) {
  const router = useRouter();
  const hidden = useHiddenActivities();
  const [editOpen, setEditOpen] = useState(false);
  const pendingDelete = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openEdit = useCallback(() => {
    if (hidden.isHidden(activity.id)) {
      toast.error("Aktivita se právě maže.");
      return;
    }
    setEditOpen(true);
  }, [activity.id, hidden]);

  const deleteWithUndo = useCallback(() => {
    if (pendingDelete.current) return;
    hidden.hide(activity.id);

    const doDelete = async () => {
      pendingDelete.current = null;
      try {
        const res = await fetch(`/api/crm/activities/${activity.id}`, { method: "DELETE" });
        if (!res.ok) {
          hidden.unhide(activity.id);
          toast.error("Nepodařilo se smazat aktivitu.");
          return;
        }
        router.refresh();
      } catch {
        hidden.unhide(activity.id);
        toast.error("Nepodařilo se smazat aktivitu.");
      }
    };

    const timeoutId = setTimeout(() => {
      void doDelete();
    }, UNDO_WINDOW_MS);
    pendingDelete.current = timeoutId;

    toast.success("Aktivita smazána.", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Vrátit zpět",
        onClick: () => {
          if (pendingDelete.current) {
            clearTimeout(pendingDelete.current);
            pendingDelete.current = null;
          }
          hidden.unhide(activity.id);
        },
      },
    });
  }, [activity.id, hidden, router]);

  return { editOpen, setEditOpen, openEdit, deleteWithUndo };
}

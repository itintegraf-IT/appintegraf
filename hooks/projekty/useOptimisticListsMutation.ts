"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ListData } from "@/components/projekty/boards/BoardListColumn";

export type ListsMutationOptions = {
  /** Aplikuje se okamžitě na lokální stav (optimistic update). */
  optimistic: (lists: ListData[]) => ListData[];
  /** Skutečný API request. */
  request: () => Promise<Response>;
  /** Chybová hláška bez tečky — hook doplní variantu „(chyba sítě)". */
  errorMessage: string;
  /** Volitelný success toast; undo = inverzní operace (vrací úspěch). */
  successToast?: { message: string; undo?: () => Promise<boolean> };
  /** router.refresh() po úspěchu (default false — optimistic stav stačí). */
  refreshOnSuccess?: boolean;
};

/**
 * Sjednocený snapshot/rollback vzor pro mutace nad lists stavem boardu
 * (dřív 3× duplicitně v KanbanBoard/BoardListView/BoardCalendarView).
 * Optimistic update hned, rollback + toast při chybě, volitelné undo.
 */
export function useOptimisticListsMutation({
  lists,
  setLists,
}: {
  lists: ListData[];
  setLists: React.Dispatch<React.SetStateAction<ListData[]>>;
}) {
  const router = useRouter();
  const listsRef = useRef(lists);
  // Sync po každém renderu (zápis do ref během renderu zakazuje React Compiler);
  // mutate se volá z event handlerů — ty běží až po efektech, ref je aktuální.
  useEffect(() => {
    listsRef.current = lists;
  });

  return useCallback(
    async (opts: ListsMutationOptions): Promise<boolean> => {
      const snapshot = listsRef.current;
      setLists(opts.optimistic(snapshot));
      try {
        const res = await opts.request();
        if (!res.ok) {
          setLists(snapshot);
          toast.error(`${opts.errorMessage}.`);
          return false;
        }
        if (opts.refreshOnSuccess) router.refresh();
        if (opts.successToast) {
          const { message, undo } = opts.successToast;
          toast.success(
            message,
            undo
              ? {
                  action: {
                    label: "Zpět",
                    onClick: () => {
                      void undo().then((ok) => {
                        if (ok) router.refresh();
                        else toast.error("Vrácení zpět selhalo.");
                      });
                    },
                  },
                }
              : undefined,
          );
        }
        return true;
      } catch {
        setLists(snapshot);
        toast.error(`${opts.errorMessage} (chyba sítě).`);
        return false;
      }
    },
    [router, setLists],
  );
}

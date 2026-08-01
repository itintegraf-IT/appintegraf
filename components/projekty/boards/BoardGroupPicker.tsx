"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Rows3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/projekty/ui/select";
import { parseBoardGroup, type BoardGroupBy } from "@/lib/projekty/board-view";

const GROUP_LABELS: Record<BoardGroupBy, string> = {
  list: "Sloupec",
  assignee: "Řešitel",
  due: "Termín",
};

/** Picker „Seskupit podle" pro list view (?group=). Default (list) se z URL maže. */
export function BoardGroupPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groupBy = parseBoardGroup(searchParams);

  function setGroup(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === "list") sp.delete("group");
    else sp.set("group", value);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`);
  }

  return (
    <Select value={groupBy} onValueChange={setGroup}>
      <SelectTrigger
        size="sm"
        className="h-7 gap-1.5 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
        aria-label="Seskupit podle"
      >
        <Rows3 className="size-3.5" />
        <span className="hidden sm:inline">Seskupit:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(GROUP_LABELS) as BoardGroupBy[]).map((key) => (
          <SelectItem key={key} value={key} className="text-xs">
            {GROUP_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

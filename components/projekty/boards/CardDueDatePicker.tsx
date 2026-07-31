"use client";

import { useState } from "react";
import { Calendar } from "@/components/projekty/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Button } from "@/components/projekty/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/projekty/utils";
import { formatDue, getDueStatus } from "@/lib/projekty/due-date";

export function CardDueDatePicker({
  value,
  onChange,
  disabled,
  completed = false,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
  completed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const status = getDueStatus(value, completed);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              status === "overdue" && "text-rose-700 dark:text-rose-400",
              status === "today" && "text-amber-700 dark:text-amber-400",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {value ? formatDue(value, "withYear") : "Termín"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(date) => {
              onChange(date ?? null);
              setOpen(false);
            }}
            locale={cs}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => onChange(null)}
          aria-label="Smazat termín"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

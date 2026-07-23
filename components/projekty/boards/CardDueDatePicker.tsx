"use client";

import { useState } from "react";
import { Calendar } from "@/components/projekty/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Button } from "@/components/projekty/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export function CardDueDatePicker({
  value,
  onChange,
  disabled,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <CalendarIcon className="mr-2 size-4" />
            {value ? format(value, "d. M. yyyy", { locale: cs }) : "Termín"}
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

"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/projekty/ui/button";
import { Calendar } from "@/components/projekty/ui/calendar";
import { Input } from "@/components/projekty/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { cn } from "@/lib/projekty/utils";

type Props = {
  /** "YYYY-MM-DDTHH:mm" nebo prázdný string. Stejný formát jako <input type="datetime-local">. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function splitValue(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "09:00" };
  const parsed = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
  if (isNaN(parsed.getTime())) return { date: undefined, time: "09:00" };
  return { date: parsed, time: format(parsed, "HH:mm") };
}

export function DateTimePicker({ value, onChange, placeholder = "Vyber datum a čas", disabled, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const { date: selected, time } = splitValue(value);

  function setCombined(nextDate: Date | undefined, nextTime: string) {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(`${format(nextDate, "yyyy-MM-dd")}T${nextTime}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          {selected ? format(selected, "dd.MM.yyyy HH:mm", { locale: cs }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => setCombined(date, time)}
          autoFocus
        />
        <div className="flex items-center gap-2 border-t p-3">
          <label className="text-sm text-muted-foreground">Čas</label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setCombined(selected, e.target.value || "09:00")}
            className="w-32"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

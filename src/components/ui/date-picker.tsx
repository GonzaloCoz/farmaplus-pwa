import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from '@untitledui/icons';
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DatePicker({
  date,
  setDate,
  placeholder = "Seleccionar fecha",
  className,
}: {
  date?: Date;
  setDate: (date?: Date) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-10 rounded-xl border-border/40 bg-background/50 ",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4.5 w-4.5 opacity-50" />
            {date ? format(date, "PPP", { locale: es }) : <span>{placeholder}</span>}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0 rounded-lg border-border/40 shadow-md" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}


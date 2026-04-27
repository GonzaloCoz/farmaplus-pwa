"use client";

import { useState, useEffect } from "react";
import { format, addHours, setHours, setMinutes, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { 
  RiMapPinLine, 
  RiText, 
  RiTimeLine, 
  RiCalendarLine,
  RiCheckboxCircleLine
} from "@remixicon/react";

import { 
  type CalendarEvent, 
  type EventColor 
} from "./types";
import { safeParseDate } from "./utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: Omit<CalendarEvent, "id"> & { id?: string }) => void;
  defaultDate?: Date;
  eventToEdit?: CalendarEvent | null;
}

const COLORS: { value: EventColor; className: string }[] = [
  { value: "sky", className: "bg-sky-400" },
  { value: "amber", className: "bg-amber-400" },
  { value: "violet", className: "bg-violet-400" },
  { value: "rose", className: "bg-rose-400" },
  { value: "emerald", className: "bg-emerald-400" },
  { value: "orange", className: "bg-orange-400" },
];

// Generar slots de tiempo (cada 30 min)
const TIME_SLOTS = Array.from({ length: 48 }).map((_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    label: `${displayHour}:${minute} ${period}`,
  };
});

export function CreateEventDialog({
  open,
  onOpenChange,
  onSave,
  defaultDate,
  eventToEdit,
}: CreateEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(defaultDate || new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(defaultDate || new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [color, setColor] = useState<EventColor>("sky");

  const isEditing = !!eventToEdit;

  useEffect(() => {
    if (open) {
      if (eventToEdit) {
        setTitle(eventToEdit.title || "");
        setDescription(eventToEdit.description || "");
        setLocation(eventToEdit.location || "");
        setAllDay(eventToEdit.allDay || false);
        setColor(eventToEdit.color || "sky");
        const sStart = safeParseDate(eventToEdit.start);
        const sEnd = safeParseDate(eventToEdit.end);
        
        setStartDate(sStart);
        setEndDate(sEnd);
        
        if (isValid(sStart)) {
          setStartTime(format(sStart, "HH:mm"));
        }
        if (isValid(sEnd)) {
          setEndTime(format(sEnd, "HH:mm"));
        }
      } else if (defaultDate) {
        setTitle("");
        setDescription("");
        setLocation("");
        setAllDay(false);
        setColor("sky");
        setStartDate(new Date(defaultDate));
        setEndDate(new Date(defaultDate));
        const h = defaultDate.getHours().toString().padStart(2, "0");
        const m = defaultDate.getMinutes().toString().padStart(2, "0");
        setStartTime(`${h}:${m}`);
        
        // Default duration 1 hour
        const end = addHours(defaultDate, 1);
        const eh = end.getHours().toString().padStart(2, "0");
        const em = end.getMinutes().toString().padStart(2, "0");
        setEndTime(`${eh}:${em}`);
      }
    }
  }, [open, eventToEdit, defaultDate]);

  const handleSave = () => {
    if (!title || !startDate || !endDate) return;

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    const start = setMinutes(setHours(new Date(startDate), sh), sm);
    const end = setMinutes(setHours(new Date(endDate), eh), em);

    onSave({
      id: eventToEdit?.id,
      title,
      description,
      start,
      end,
      allDay,
      color,
      location,
    });
    
    // Reset state
    setTitle("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-xl border bg-background shadow-lg">
        <DialogHeader className="px-8 pt-8 pb-4">
        <DialogTitle className="text-xl font-bold tracking-tight font-heading">
            {isEditing ? "Editar Evento" : "Crear Evento"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-8 py-2 pb-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Título</Label>
            <div className="relative">
                <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre del evento..."
                className="h-10 rounded-lg bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-ring px-4 text-base"
                autoFocus
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Añade más detalles..."
              className="min-h-[80px] rounded-lg bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-ring p-4 resize-none"
            />
          </div>

          {/* Fechas y Horas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Fecha Inicio</Label>
              <DatePicker 
                date={startDate} 
                setDate={setStartDate} 
                className="w-full h-11 rounded-lg bg-muted/30 border-none"
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Hora Inicio</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-10 rounded-lg bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Fecha Fin</Label>
              <DatePicker 
                date={endDate} 
                setDate={setEndDate} 
                className="w-full h-11 rounded-lg bg-muted/30 border-none"
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Hora Fin</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="h-10 rounded-lg bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Todo el día */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox 
              id="allDay" 
              checked={allDay} 
              onCheckedChange={(checked) => setAllDay(checked as boolean)}
              className="rounded-lg"
            />
            <Label htmlFor="allDay" className="text-sm font-medium cursor-pointer select-none">Evento de todo el día</Label>
          </div>

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Ubicación</Label>
            <div className="relative">
                <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Añadir ubicación..."
                className="h-10 rounded-lg bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-ring px-4"
              />
            </div>
          </div>

          {/* Etiquetas */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Etiqueta</Label>
            <div className="flex items-center gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "size-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center",
                    c.className,
                    color === c.value ? "ring-4 ring-primary/20 ring-offset-2 ring-offset-background" : "opacity-80"
                  )}
                >
                  {color === c.value && <RiCheckboxCircleLine className="size-5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-8 py-6 bg-muted/10 border-t flex items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-6 h-10 font-medium"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!title}
            className="rounded-lg px-8 h-10 font-semibold"
          >
            {isEditing ? "Guardar Cambios" : "Programar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


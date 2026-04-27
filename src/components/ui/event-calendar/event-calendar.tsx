"use client";

import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarEventLine,
} from "@remixicon/react";
import { addDays, addMonths, format, isToday, subDays, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import * as React from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AgendaView,
  CalendarDndProvider,
  type CalendarEvent,
  type CalendarView,
  CreateEventDialog,
  DayView,
  EventDialog,
  MonthView,
  WeekView,
} from "@/components/ui/event-calendar";

export interface EventCalendarProps {
  events: CalendarEvent[];
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventCreate?: (startTime: Date) => void;
  className?: string;
  defaultView?: CalendarView;
  defaultDate?: Date;
}

export function EventCalendar({
  events = [],
  onEventUpdate,
  onEventCreate,
  className,
  defaultView = "month",
  defaultDate = new Date(),
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(defaultDate);
  const [view, setView] = useState<CalendarView>(defaultView);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

  const handlePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subDays(currentDate, 7));
    } else if (view === "day" || view === "agenda") {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else if (view === "day" || view === "agenda") {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleCreateRequest = (startTime: Date) => {
    if (onEventCreate) {
      onEventCreate(startTime);
    }
  };

  const formattedDate = React.useMemo(() => {
    if (view === "month" || view === "agenda") {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
    
    if (view === "week") {
      return format(currentDate, "MMMM yyyy", { locale: es }); 
    }
    
    return format(currentDate, "d 'de' MMMM, yyyy", { locale: es });
  }, [currentDate, view]);

  return (
    <div 
      className={cn("flex flex-col h-full bg-background rounded-lg border", className)}
      style={{
        "--event-height": "24px",
        "--event-gap": "4px",
        "--week-cells-height": "64px"
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/40">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-background rounded-md text-muted-foreground"
              onClick={handlePrevious}
            >
              <RiArrowLeftSLine className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleToday}
              className="h-8 px-3 text-xs font-semibold hover:bg-background rounded-md text-foreground"
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-background rounded-md text-muted-foreground"
              onClick={handleNext}
            >
              <RiArrowRightSLine className="w-5 h-5" />
            </Button>
          </div>
          <h2 className="text-xl font-bold min-w-[200px] text-foreground tracking-tight">
            {formattedDate}
          </h2>
        </div>

        <div className="flex items-center gap-3 pr-20">
          {onEventCreate && (
            <Button 
                onClick={() => handleCreateRequest(new Date())} 
                className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-5 h-10" 
                size="sm"
            >
              <RiCalendarEventLine className="w-5 h-5 mr-2" />
              Nuevo Evento
            </Button>
          )}
          
          <Select value={view} onValueChange={(v) => setView(v as CalendarView)}>
            <SelectTrigger className="w-[150px] h-10 rounded-lg bg-muted/40 border-border/40 focus:ring-primary/20">
              <SelectValue>
                 {view === 'month' && 'Mes'}
                 {view === 'week' && 'Semana'}
                 {view === 'day' && 'Día'}
                 {view === 'agenda' && 'Agenda'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-lg border-border/30 shadow-md">
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="day">Día</SelectItem>
              <SelectItem value="agenda">Agenda</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <CalendarDndProvider
          onEventUpdate={(event) => {
            if (onEventUpdate) {
              onEventUpdate(event);
            }
          }}
        >
          <div className="h-full overflow-y-auto w-full custom-scrollbar">
            {view === "month" && (
              <MonthView
                currentDate={currentDate}
                events={events}
                onEventSelect={handleEventSelect}
                onEventCreate={handleCreateRequest}
              />
            )}
            {view === "week" && (
              <WeekView
                currentDate={currentDate}
                events={events}
                onEventSelect={handleEventSelect}
                onEventCreate={handleCreateRequest}
              />
            )}
            {view === "day" && (
              <DayView
                currentDate={currentDate}
                events={events}
                onEventSelect={handleEventSelect}
                onEventCreate={handleCreateRequest}
              />
            )}
            {view === "agenda" && (
              <AgendaView
                currentDate={currentDate}
                events={events}
                onEventSelect={handleEventSelect}
              />
            )}
          </div>
        </CalendarDndProvider>
      </div>

      <EventDialog
        event={selectedEvent}
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        onEditEvent={(event) => {
          setIsEventDialogOpen(false);
          if (onEventUpdate) onEventUpdate(event);
        }}
      />
    </div>
  );
}

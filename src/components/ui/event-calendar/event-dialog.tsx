"use client";

import { differenceInMinutes, format, isSameDay, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Copy, MapPinIcon, Trash2 } from "lucide-react";

import {
  type CalendarEvent,
  EventColor,
  getEventColorClasses,
  safeParseDate
} from "@/components/ui/event-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteEvent?: (id: string) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

export function EventDialog({
  event,
  open,
  onOpenChange,
  onDeleteEvent,
  onEditEvent,
}: EventDialogProps) {
  if (!event) return null;

  const eventStart = safeParseDate(event.start);
  const eventEnd = safeParseDate(event.end);
  const isSameDayEvent = isSameDay(eventStart, eventEnd);
  const durationInMinutes = isValid(eventStart) && isValid(eventEnd) 
    ? differenceInMinutes(eventEnd, eventStart)
    : 0;

  const getDurationText = () => {
    if (event.allDay) return "Todo el día";

    const hours = Math.floor(durationInMinutes / 60);
    const mins = durationInMinutes % 60;

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-xl border bg-background shadow-lg p-0 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between mt-2 mb-4">
            <Badge
              className={getEventColorClasses(event.color)}
              variant="outline"
            >
              </Badge>
          </div>
          <DialogTitle className="text-xl font-bold font-heading px-6">{event.title}</DialogTitle>
            <div className="flex items-center gap-2 px-6">
              <span className="text-foreground capitalize text-sm">
                {format(eventStart, "EEEE, d 'de' MMMM, yyyy", { locale: es })}
              </span>
              {!isSameDayEvent && (
                <>
                  <span>-</span>
                  <span className="text-foreground capitalize text-sm">
                    {format(eventEnd, "EEEE, d 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </>
              )}
            </div>
            
            {!event.allDay && (
              <div className="flex items-center gap-2">
                <span className="text-foreground">
                  {format(eventStart, "h:mm a", { locale: es })} - {format(eventEnd, "h:mm a", { locale: es })}
                </span>
                <span className="text-muted-foreground/60">({getDurationText()})</span>
              </div>
            )}

            {event.location && (
              <div className="flex items-center gap-2 mt-2 text-foreground px-6">
                <MapPinIcon className="w-4 h-4 text-muted-foreground" />
                {event.location}
              </div>
            )}
        </DialogHeader>

        {event.description && (
          <div className="p-6 pt-0">
            <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap text-foreground/90">
              {event.description}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row sm:justify-between items-center sm:space-x-0">
          {onDeleteEvent && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onDeleteEvent(event.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Evento
            </Button>
          )}

          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" className="rounded-lg">Cerrar</Button>} />
            {onEditEvent && (
              <Button
                className="rounded-lg"
                onClick={() => {
                  onEditEvent(event);
                }}
              >
                Editar Evento
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { calendarService, CalendarEvent as ServiceEvent } from "@/services/calendarService";
import { useUser } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from '@untitledui/icons';
import { XClose as X, Trash01 as Trash2, Edit01 as Edit2, Save01 as Save } from '@untitledui/icons';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { EventCalendar, CreateEventDialog, type CalendarEvent as UIEvent, type EventColor, safeParseDate } from "@/components/ui/event-calendar";
import { format, isValid } from "date-fns";

interface CalendarModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialDate?: Date;
}

const SECTORS = ["Farmacia", "Perfumeria", "General"];

export function CalendarModal({ open, onOpenChange, initialDate }: CalendarModalProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';

    const [events, setEvents] = useState<ServiceEvent[]>([]);

    const [editUIEvent, setEditUIEvent] = useState<UIEvent | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [createDefaultDate, setCreateDefaultDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        if (open) {
            loadEvents();
        }
    }, [open, user?.branchName]);

    const loadEvents = async () => {
        try {
            const data = await calendarService.getEvents(user?.branchName, isAdmin);
            setEvents(data);
        } catch (error) {
            console.error("Error loading events", error);
        }
    };

    const handleSaveUIEvent = async (eventData: Omit<UIEvent, "id"> & { id?: string }) => {
        try {
            const colorToSector = (c?: string): string => {
                switch (c) {
                    case "emerald": return "Farmacia";
                    case "rose": return "Perfumeria";
                    case "amber": return "General";
                    default: return "General";
                }
            };

            if (eventData.id) {
                // Update
                const updated = await calendarService.updateEvent({
                    id: eventData.id,
                    title: eventData.title,
                    branch_name: eventData.location || user?.branchName || "General",
                    sector: colorToSector(eventData.color),
                    date: format(eventData.start, "yyyy-MM-dd")
                });
                if (updated) {
                    notify.success("Actualizado", "Evento modificado exitosamente");
                    loadEvents();
                }
            } else {
                // Create
                const added = await calendarService.addEvent({
                    title: eventData.title,
                    branch_name: eventData.location || user?.branchName || "General",
                    sector: colorToSector(eventData.color),
                    date: format(eventData.start, "yyyy-MM-dd")
                });
                if (added) {
                    notify.success("Creado", "Evento agregado exitosamente");
                    loadEvents();
                }
            }
            setIsCreateDialogOpen(false);
        } catch (error) {
            notify.error("Error", "No se pudo guardar el evento");
        }
    };

    const startAdd = (date?: Date) => {
        setCreateDefaultDate(date || new Date());
        setEditUIEvent(null);
        setIsCreateDialogOpen(true);
    };

    const startEdit = (ev: UIEvent) => {
        setEditUIEvent(ev);
        setIsCreateDialogOpen(true);
    };

    const resetForm = () => {
        setIsCreateDialogOpen(false);
        setEditUIEvent(null);
    };

    // Color mapper based on sector
    const getSectorColor = (sector: string): EventColor => {
        switch (sector) {
            case "Farmacia": return "emerald";
            case "Perfumeria": return "rose";
            case "General": return "amber";
            default: return "sky";
        }
    };

    // Map ServiceEvent to UIEvent for Origin Calendar
    const mappedEvents = useMemo<UIEvent[]>(() => {
        return events
            .filter(e => !!e.date) // Basic safety check
            .map(e => {
                // Ensure date string is properly formatted for constructor
                const dateStr = e.date.includes('T') ? e.date : `${e.date}T09:00:00`;
                const start = safeParseDate(dateStr);
                const end = safeParseDate(e.date.includes('T') ? e.date : `${e.date}T10:00:00`);

                return {
                    id: e.id,
                    title: e.title,
                    description: `Sucursal: ${e.branch_name}\nSector: ${e.sector}`,
                    start,
                    end,
                    allDay: true, 
                    color: getSectorColor(e.sector),
                    location: e.branch_name
                };
            });
    }, [events]);

    const handleEventUpdate = async (updatedUIEvent: UIEvent) => {
         if (!isValid(updatedUIEvent.start)) return;
         const newDateStr = format(updatedUIEvent.start, "yyyy-MM-dd");
         const sEvent = events.find(e => e.id === updatedUIEvent.id);
         if(sEvent && sEvent.date !== newDateStr && isAdmin) {
              const updated = await calendarService.updateEvent({
                  id: sEvent.id,
                  title: sEvent.title,
                  branch_name: sEvent.branch_name,
                  sector: sEvent.sector,
                  date: newDateStr
              });
              if(updated) {
                  notify.success("Reprogramado", "El evento cambió de fecha.");
                  loadEvents();
              }
         }
    };

    // Form overlay logic removed in favor of shared CreateEventDialog

    const renderContent = () => (
        <div className="h-full w-full relative bg-background flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
                <EventCalendar
                    events={mappedEvents}
                    defaultDate={initialDate || new Date()}
                    onEventCreate={(d) => {
                        if (isAdmin) startAdd(d);
                        else notify.error("Denegado", "Solo administradores");
                    }}
                    onEventUpdate={(e) => {
                        if (isAdmin) handleEventUpdate(e);
                        else notify.error("Denegado", "Sin premiso de edición");
                    }}
                    className="border-none rounded-none h-full"
                />

                <CreateEventDialog 
                    open={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                    onSave={handleSaveUIEvent}
                    defaultDate={createDefaultDate}
                    eventToEdit={editUIEvent}
                />
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[1200px] w-[98vw] h-[92vh] p-0 gap-0 overflow-hidden border bg-background text-foreground shadow-sm rounded-xl">
                    {renderContent()}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="h-[95vh] rounded-t-xl overflow-hidden p-0 border-t bg-background shadow-md">
                {renderContent()}
            </DrawerContent>
        </Drawer>
    );
}


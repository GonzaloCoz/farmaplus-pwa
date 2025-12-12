
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import CustomCalendar from "@/components/CustomCalendar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { calendarService, CalendarEvent } from "@/services/calendarService";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2 } from "lucide-react";

interface CalendarModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialDate?: Date;
}

export function CalendarModal({ open, onOpenChange, initialDate }: CalendarModalProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';

    const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form inputs
    const [newTitle, setNewTitle] = useState("");
    const [newBranch, setNewBranch] = useState("");
    const [newSector, setNewSector] = useState("");
    const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));

    useEffect(() => {
        if (open) {
            loadEvents();
            if (initialDate) {
                setSelectedDate(initialDate);
                setNewDate(initialDate.toISOString().slice(0, 10));
            }
        }
    }, [open, initialDate, user?.branchName]);

    const loadEvents = async () => {
        try {
            const data = await calendarService.getEvents(user?.branchName, isAdmin);
            setEvents(data);
        } catch (error) {
            console.error("Error loading events", error);
        }
    };

    const handleAddEvent = async () => {
        if (!newTitle || !newBranch || !newSector || !newDate) {
            toast.error("Completa todos los campos");
            return;
        }

        try {
            const added = await calendarService.addEvent({
                title: newTitle,
                branch_name: newBranch,
                sector: newSector,
                date: newDate
            });

            if (added) {
                toast.success("Evento creado");
                setEvents(prev => [...prev, added]);
                setShowAddForm(false);
                setNewTitle("");
                setNewBranch("");
                setNewSector("");
            }
        } catch (e) {
            toast.error("Error al crear evento");
        }
    };

    // Helper to get events for strict date
    const eventsForDay = (d: Date) => {
        const iso = d.toISOString().slice(0, 10);
        return events.filter(e => e.date === iso);
    };

    // Content Component to reuse between Dialog and Drawer
    const Content = () => (
        <div className={`flex ${isDesktop ? 'flex-row gap-6' : 'flex-col gap-4'} mt-4 h-full`}>
            <div className={isDesktop ? 'w-1/2' : 'w-full'}>
                <CustomCalendar
                    events={events.map(e => ({ ...e, branch: e.branch_name }))} // Map for legacy prop if needed, or CustomCalendar handles it?
                    // Checking CustomCalendar props: it expects { date: string } array usually for dots
                    selected={selectedDate}
                    onSelect={(d) => {
                        if (d) {
                            setSelectedDate(d);
                            setNewDate(d.toISOString().slice(0, 10));
                        }
                    }}
                />
            </div>

            <div className={isDesktop ? 'w-1/2 flex flex-col' : 'w-full'}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium capitalize">
                        {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    {isAdmin && (
                        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} variant={showAddForm ? "ghost" : "default"}>
                            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 mr-2" />}
                            {showAddForm ? "Cancelar" : "Evento"}
                        </Button>
                    )}
                </div>

                {showAddForm ? (
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/40 animate-in slide-in-from-top-2">
                        <h4 className="font-medium text-sm">Nuevo Evento</h4>
                        <Input placeholder="Título" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        <Input placeholder="Sucursal" value={newBranch} onChange={e => setNewBranch(e.target.value)} />
                        <Input placeholder="Sector" value={newSector} onChange={e => setNewSector(e.target.value)} />
                        <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                        <Button className="w-full" onClick={handleAddEvent}>Guardar</Button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[500px]">
                        {eventsForDay(selectedDate).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                                <p>No hay eventos para este día</p>
                            </div>
                        ) : (
                            eventsForDay(selectedDate).map(ev => (
                                <div key={ev.id} className="p-3 bg-card border rounded-lg shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold text-foreground">{ev.title}</h4>
                                            <p className="text-sm text-muted-foreground">{ev.branch_name} - {ev.sector}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Calendario de Inventarios</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden">
                        <Content />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle>Calendario de Inventarios</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-8 h-full overflow-y-auto">
                    <Content />
                </div>
            </DrawerContent>
        </Drawer>
    );
}

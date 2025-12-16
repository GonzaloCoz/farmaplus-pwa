import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import CustomCalendar from "@/components/CustomCalendar";
import { useUser } from "@/contexts/UserContext";
import { calendarService } from '@/services/calendarService';
import { notify } from "@/lib/notifications";
import { Input } from "@/components/ui/input";

type EventItem = {
    id: string;
    title: string;
    branch: string;
    sector: string;
    date: string; // ISO string YYYY-MM-DD
};

export function CalendarWidget() {
    const { user } = useUser();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState<EventItem[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form State
    const [newTitle, setNewTitle] = useState("");
    const [newBranch, setNewBranch] = useState("");
    const [newSector, setNewSector] = useState("");
    const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));

    // Load Events
    useEffect(() => {
        loadEvents();
    }, [user?.branchName]);

    const loadEvents = async () => {
        try {
            // In a real implementation this would fetch from API based on month
            // For now using the service which mimics the old behavior
            const allEvents = await calendarService.getEvents();

            // Map to local EventItem type if needed, assuming service returns compatible shape
            // Doing a robust mapping here just in case service structure varies
            const mappedEvents: EventItem[] = allEvents.map((e: any) => ({
                id: e.id,
                title: e.title,
                branch: e.branch_name || e.branchId || "General", // Fallback
                sector: e.sector || e.description || "",
                date: e.date.split('T')[0]
            }));

            setEvents(mappedEvents);
        } catch (error) {
            console.error("Error loading events:", error);
        }
    };

    const handleAddEvent = async () => {
        if (!newTitle || !newBranch || !newSector || !newDate) {
            notify.error("Error", "Por favor completa todos los campos");
            return;
        }

        try {
            await calendarService.addEvent({
                title: newTitle,
                branch_name: newBranch,
                sector: newSector,
                date: newDate
            });

            notify.success("Operación exitosa", "Evento agregado");
            setShowAddForm(false);

            // Reset form
            setNewTitle("");
            setNewBranch("");
            setNewSector("");
            setNewDate(new Date().toISOString().slice(0, 10));

            loadEvents();
        } catch (error) {
            notify.error("Error", "Error al crear evento");
        }
    };

    const eventsForDay = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return events.filter(e => e.date === dateStr);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                        <CardTitle>Calendario</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-4">
                <div className="flex flex-col md:flex-row gap-6 h-full">
                    <div className="flex-1">
                        <CustomCalendar
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            events={events}
                        />
                    </div>

                    <div className="w-full md:w-80 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold capitalize">
                                {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h3>
                            <Button size="sm" variant={showAddForm ? "ghost" : "outline"} onClick={() => setShowAddForm(!showAddForm)}>
                                {showAddForm ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1" /> Evento</>}
                            </Button>
                        </div>

                        {showAddForm ? (
                            <div className="p-3 bg-muted/50 border rounded-md space-y-3 mb-4 animate-in slide-in-from-top-2">
                                <Input
                                    placeholder="Título"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="bg-background h-8"
                                />
                                <Input
                                    placeholder="Sucursal"
                                    value={newBranch}
                                    onChange={(e) => setNewBranch(e.target.value)}
                                    className="bg-background h-8"
                                />
                                <Input
                                    placeholder="Sector"
                                    value={newSector}
                                    onChange={(e) => setNewSector(e.target.value)}
                                    className="bg-background h-8"
                                />
                                <Input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="bg-background h-8"
                                />
                                <Button size="sm" className="w-full" onClick={handleAddEvent}>Guardar Evento</Button>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto space-y-2 pr-1">
                                {eventsForDay(selectedDate).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-20 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                        No hay eventos
                                    </div>
                                ) : (
                                    eventsForDay(selectedDate).map((event) => (
                                        <div key={event.id} className="p-3 bg-muted/50 hover:bg-muted border rounded-md transition-colors text-sm">
                                            <p className="font-medium text-foreground">{event.title}</p>
                                            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                                <span>{event.branch}</span>
                                                <span>{event.sector}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

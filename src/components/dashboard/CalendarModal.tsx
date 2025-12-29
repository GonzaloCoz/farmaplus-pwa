
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import CustomCalendar from "@/components/CustomCalendar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { calendarService, CalendarEvent } from "@/services/calendarService";
import { useUser } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Trash2, Edit2, Calendar as CalendarIcon, Save, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BRANCH_NAMES } from "@/config/users";

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

    const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    // View Mode: 'list' | 'add' | 'edit'
    const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');

    // Form Inputs
    const [editEventId, setEditEventId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState("");
    const [formBranch, setFormBranch] = useState("");
    const [formSector, setFormSector] = useState("");
    const [formDate, setFormDate] = useState("");

    useEffect(() => {
        if (open) {
            loadEvents();
            if (initialDate) {
                setSelectedDate(initialDate);
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

    const handleSaveEvent = async () => {
        if (!formTitle || !formBranch || !formSector || !formDate) {
            notify.error("Error", "Completa todos los campos");
            return;
        }

        try {
            if (viewMode === 'add') {
                const added = await calendarService.addEvent({
                    title: formTitle,
                    branch_name: formBranch,
                    sector: formSector,
                    date: formDate
                });
                if (added) {
                    notify.success("Creado", "Evento agregado exitosamente");
                    setEvents(prev => [...prev, added]);
                    resetForm();
                }
            } else if (viewMode === 'edit' && editEventId) {
                const updated = await calendarService.updateEvent({
                    id: editEventId,
                    title: formTitle,
                    branch_name: formBranch,
                    sector: formSector,
                    date: formDate
                });
                if (updated) {
                    notify.success("Actualizado", "Evento modificado exitosamente");
                    await loadEvents();
                    resetForm();
                }
            }
        } catch (e) {
            notify.error("Error", "Ocurrió un error al guardar");
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este evento?")) return;
        try {
            const success = await calendarService.deleteEvent(id);
            if (success) {
                notify.success("Eliminado", "Evento eliminado");
                setEvents(prev => prev.filter(e => e.id !== id));
                if (viewMode === 'edit') resetForm();
            }
        } catch (e) {
            notify.error("Error", "No se pudo eliminar el evento");
        }
    };

    const startAdd = () => {
        setFormTitle("");
        setFormBranch("");
        setFormSector("");
        setFormDate(selectedDate.toISOString().slice(0, 10));
        setViewMode('add');
    };

    const startEdit = (ev: CalendarEvent) => {
        setEditEventId(ev.id);
        setFormTitle(ev.title);
        setFormBranch(ev.branch_name);
        setFormSector(ev.sector);
        setFormDate(ev.date);
        setViewMode('edit');
    };

    const resetForm = () => {
        setViewMode('list');
        setEditEventId(null);
        setFormTitle("");
        setFormBranch("");
        setFormSector("");
    };

    const eventsForDay = (d: Date) => {
        const iso = d.toISOString().slice(0, 10);
        return events.filter(e => e.date === iso);
    };

    // Helper Content Render to avoid inner component re-mount issues
    const renderContent = () => (
        <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} h-full bg-background`}>
            {/* Left: Calendar */}
            <div className={isDesktop ? 'w-[380px] border-r border-border/40 p-6 flex flex-col bg-card/50' : 'w-full p-4'}>
                <div className="flex-1 flex flex-col justify-center">
                    <CustomCalendar
                        events={events.map(e => ({ ...e, branch: e.branch_name }))}
                        selected={selectedDate}
                        onSelect={(d) => {
                            if (d) {
                                setSelectedDate(d);
                                if (viewMode === 'add') setFormDate(d.toISOString().slice(0, 10));
                                if (viewMode === 'edit') resetForm();
                            }
                        }}
                        className={cn(
                            "rounded-2xl border border-border/50 shadow-sm p-4 bg-card w-full mx-auto",
                            "transition-all duration-300 hover:shadow-md hover:border-border/80"
                        )}
                    />
                </div>
            </div>

            {/* Right: Details / Form */}
            <div className={cn(
                isDesktop ? 'flex-1 p-8' : 'w-full p-4',
                "flex flex-col relative bg-gradient-to-br from-background to-muted/20"
            )}>
                <AnimatePresence mode="wait">
                    {viewMode === 'list' ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col h-full"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <motion.h2
                                        key={selectedDate.toISOString()}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-3xl font-bold capitalize tracking-tight text-foreground"
                                    >
                                        {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </motion.h2>
                                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                                        {eventsForDay(selectedDate).length} {eventsForDay(selectedDate).length === 1 ? 'Evento programado' : 'Eventos programados'}
                                    </p>
                                </div>
                                {isAdmin && (
                                    <Button onClick={startAdd} className="rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 bg-primary text-primary-foreground px-6 py-2 h-auto text-sm font-medium">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Nuevo Evento
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto -mr-4 pr-4 custom-scrollbar">
                                {eventsForDay(selectedDate).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground/40 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
                                        <CalendarIcon className="w-16 h-16 mb-4 opacity-10" />
                                        <p className="text-lg font-medium">Sin agenda para hoy</p>
                                        <p className="text-sm">Disfruta de tu día libre</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {eventsForDay(selectedDate).map((ev, index) => (
                                            <motion.div
                                                key={ev.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="group relative overflow-hidden bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300"
                                            >
                                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

                                                <div className="flex justify-between items-start pl-3">
                                                    <div>
                                                        <h4 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{ev.title}</h4>
                                                        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <MapPin className="w-3.5 h-3.5" />
                                                                <span>{ev.branch_name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <span>{ev.sector}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground hover:text-foreground rounded-full"
                                                            onClick={() => startEdit(ev)}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col h-full justify-center max-w-md mx-auto w-full"
                        >
                            <div className="bg-card border border-border/60 rounded-3xl shadow-xl p-6 sm:p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            {viewMode === 'add' ? <Plus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold">
                                                {viewMode === 'add' ? 'Programar Inventario' : 'Editar Detalles'}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">Complete la información requerida</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={resetForm}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium ml-1 text-muted-foreground">Título del Evento</label>
                                        <Input
                                            placeholder="Ej: Auditoría Anual"
                                            value={formTitle}
                                            onChange={e => setFormTitle(e.target.value)}
                                            className="bg-muted/30 border-border/50 focus:bg-background h-11 rounded-xl"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium ml-1 text-muted-foreground">Sucursal</label>
                                            <Select value={formBranch} onValueChange={setFormBranch}>
                                                <SelectTrigger className="bg-muted/30 border-border/50 focus:bg-background h-11 rounded-xl">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {BRANCH_NAMES.map((branch) => (
                                                        <SelectItem key={branch} value={branch}>
                                                            {branch}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium ml-1 text-muted-foreground">Sector</label>
                                            <Select value={formSector} onValueChange={setFormSector}>
                                                <SelectTrigger className="bg-muted/30 border-border/50 focus:bg-background h-11 rounded-xl">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SECTORS.map((sector) => (
                                                        <SelectItem key={sector} value={sector}>
                                                            {sector}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium ml-1 text-muted-foreground">Fecha Asignada</label>
                                        <Input
                                            type="date"
                                            value={formDate}
                                            onChange={e => setFormDate(e.target.value)}
                                            className="bg-muted/30 border-border/50 focus:bg-background h-11 rounded-xl"
                                        />
                                    </div>

                                    <div className="flex gap-3 mt-8 pt-2">
                                        {viewMode === 'edit' && editEventId && (
                                            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-11 px-4 rounded-xl" onClick={() => handleDeleteEvent(editEventId)}>
                                                <Trash2 className="w-5 h-5" />
                                            </Button>
                                        )}
                                        <div className="flex-1 flex gap-3 justify-end">
                                            <Button variant="outline" className="h-11 rounded-xl px-6 border-border/60 hover:bg-muted" onClick={resetForm}>
                                                Cancelar
                                            </Button>
                                            <Button className="h-11 rounded-xl px-8 shadow-lg hover:shadow-primary/20 hover:scale-[1.02] transition-all" onClick={handleSaveEvent}>
                                                <Save className="w-4 h-4 mr-2" />
                                                Guardar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[1000px] w-[95vw] h-[80vh] p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-background text-foreground ring-1 ring-border/20">
                    {renderContent()}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="h-[95vh] rounded-t-3xl">
                <DrawerHeader className="text-left border-b pb-4 px-6">
                    <DrawerTitle>Calendario</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-hidden">
                    {renderContent()}
                </div>
            </DrawerContent>
        </Drawer>
    );
}


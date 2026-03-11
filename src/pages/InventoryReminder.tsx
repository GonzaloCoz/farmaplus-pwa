
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { calendarService, CalendarEvent } from "@/services/calendarService";
import { 
    CalendarSearch as CalendarIcon, 
    MapPoint as MapPin, 
    Buildings,
    Mirror as PerfumeryIcon,
    MedicalKit as PharmacyIcon,
    ClockCircle as Clock,
    Danger as DangerIcon,
    InfoCircle as InfoIcon
} from "@solar-icons/react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";


export default function InventoryReminder() {
    const { user } = useUser();
    const [event, setEvent] = useState<CalendarEvent | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchEvent() {
            if (!user?.branchName) return;
            try {
                const events = await calendarService.getEvents(user.branchName, false);
                const today = new Date().toISOString().split('T')[0];
                const upcoming = events
                    .filter(e => e.date >= today)
                    .sort((a, b) => a.date.localeCompare(b.date))[0];
                
                setEvent(upcoming || null);
            } catch (error) {
                console.error("Error fetching reminder event:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchEvent();
    }, [user?.branchName]);

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 animate-pulse grayscale">
                <div className="h-12 w-12 rounded-2xl bg-muted mb-4" />
                <div className="h-4 w-48 bg-muted rounded-full mb-2" />
                <div className="h-3 w-32 bg-muted rounded-full" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center grayscale">
                <div className="h-16 w-16 rounded-3xl bg-muted/30 flex items-center justify-center mb-6">
                    <CalendarIcon className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground/60 mb-2">No hay inventarios asignados</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                    El administrador te notificará por este medio cuando se asigne una fecha de control.
                </p>
            </div>
        );
    }

    const eventDate = parseISO(event.date);
    const isToday = event.date === new Date().toISOString().split('T')[0];

    return (
        <div className="h-full bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-start overflow-hidden animate-in fade-in duration-500">
            <ScrollArea className="flex-1 w-full">
                <div className="w-full max-w-[1000px] mx-auto p-6 md:p-10 lg:p-14 space-y-12">
                    
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                        <div className="relative shrink-0">
                            <div className="h-24 w-24 rounded-[2rem] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center relative z-10 shadow-2xl">
                                <CalendarIcon className="w-12 h-12" weight="BoldDuotone" />
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-3">
                             <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-1">
                                <Badge className="rounded-full px-4 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] bg-black dark:bg-white text-white dark:text-black border-none hover:bg-black/90 dark:hover:bg-white/90">
                                    {isToday ? "¡Es Hoy!" : "Próximamente"}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-4 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black/60 dark:text-white/60">
                                    Control Obligatorio
                                </Badge>
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-black dark:text-white">
                                Recordatorio de Inventario
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-base lg:text-lg font-medium max-w-2xl">
                                Preparación y pautas para el próximo control de stock de tu sucursal.
                            </p>
                        </div>
                    </div>

                    {/* Quick Info Bar - Minimalist */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center gap-5 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 group hover:border-black dark:hover:border-white transition-colors duration-500">
                            <div className="h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-lg">
                                <CalendarIcon className="w-6 h-6" weight="BoldDuotone" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fecha Asignada</p>
                                <p className="text-lg font-bold text-black dark:text-white leading-tight">
                                    {format(eventDate, "EEEE d 'de' MMMM", { locale: es })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-5 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 group hover:border-black dark:hover:border-white transition-colors duration-500">
                            <div className="h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-lg">
                                {event.sector?.toLowerCase().includes('perfumeria') ? (
                                    <PerfumeryIcon className="w-6 h-6" weight="BoldDuotone" />
                                ) : (
                                    <PharmacyIcon className="w-6 h-6" weight="BoldDuotone" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sector / Rubro</p>
                                <p className="text-lg font-bold text-black dark:text-white capitalize leading-tight">
                                    {event.sector || "General"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-5 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 group hover:border-black dark:hover:border-white transition-colors duration-500">
                            <div className="h-12 w-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-lg">
                                <Buildings className="w-6 h-6" weight="BoldDuotone" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sucursal Destino</p>
                                <p className="text-lg font-bold text-black dark:text-white leading-tight">
                                    {event.branch_name}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-zinc-200 dark:bg-zinc-800" />

                    {/* Content Body - Minimalist Sections */}
                    <div className="grid grid-cols-1 gap-14 pb-20">
                        
                        {/* Recommendations */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Recomendaciones Operativas</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    "El inventario comenzará al cierre de la operación.",
                                    "En locales 24 hs, el inicio será al finalizar la atención.",
                                    "Los productos deben estar en su respectivo depósito.",
                                    "Tener a mano productos próximos a vencer en stock.",
                                    "No realizar ingresos ni movimientos durante el conteo."
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 items-start p-5 rounded-3xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/30">
                                        <span className="text-black dark:text-white font-black text-lg leading-none mt-0.5">•</span>
                                        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 leading-relaxed">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Logistics */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Información Logística</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-black dark:text-white mb-3">Comida y refrigerio</h3>
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                        El equipo de Inventarios proveerá comida y bebida. Informar restricciones alimentarias con anticipación.
                                    </p>
                                </div>
                                <div className="p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-black dark:text-white mb-3">Regreso del personal</h3>
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                        Gestionar el regreso del personal únicamente a través de la plataforma Cabify al finalizar.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Important */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">🚨 Importante – Códigos</h2>
                            </div>
                            <div className="p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 space-y-6">
                                <p className="text-sm font-bold opacity-80 leading-relaxed text-black dark:text-white">
                                    Herramienta disponible para registro de productos que no permiten escaneo manual:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Perfumería</h4>
                                        <p className="text-xs font-bold text-black dark:text-white leading-relaxed">Códigos distintos, dañados o ilegibles.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Medicamentos</h4>
                                        <p className="text-xs font-bold text-black dark:text-white leading-relaxed">Unidades fraccionadas sin código (PLEX).</p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Otros</h4>
                                        <p className="text-xs font-bold text-black dark:text-white leading-relaxed">Guantes, jeringas y empaques diversos.</p>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-center text-zinc-500">
                                        Responsable de Perfumería debe permanecer en el área.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Pending */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Acciones Pendientes</h2>
                            </div>
                            <div className="p-8 rounded-[2.5rem] border-2 border-dashed border-zinc-100 dark:border-zinc-900 flex flex-col md:flex-row items-center gap-8">
                                <div className="h-16 w-16 rounded-3xl bg-black dark:bg-white flex items-center justify-center shrink-0">
                                    <Clock className="w-8 h-8 text-white dark:text-black" weight="BoldDuotone" />
                                </div>
                                <div className="text-center md:text-left">
                                    <h4 className="text-lg font-black text-black dark:text-white mb-1">Horarios de cierre</h4>
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                        Enviar horario de cierre a la brevedad para coordinar adecuadamente el inicio del conteo.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

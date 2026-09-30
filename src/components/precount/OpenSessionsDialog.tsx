import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash01 } from "@untitledui/icons";
import { deleteSession as deleteSessionDB } from "@/services/preCountDB";
import { db } from "@/services/db";
import { notify } from "@/lib/notifications";
import { cleanSectorTitle } from "./PreCountAdminCyclicView";
import { useUser } from "@/contexts/UserContext";

export interface OpenSessionData {
    id: string;
    sector: string;
    start_time: string;
    status: string;
    sync_pin?: string;
    branch_id?: string;
    branch_name?: string;
    user_id?: string;
    total_products: number;
    total_units: number;
    profile?: string;
}

interface OpenSessionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    branchName?: string;
    branchId?: string;
    onResumeSession?: (session: OpenSessionData) => void;
    onDeleteSession?: (sessionId: string) => void;
}

export function OpenSessionsDialog({
    open,
    onOpenChange,
    branchName,
    branchId,
    onResumeSession,
    onDeleteSession,
}: OpenSessionsDialogProps) {
    const { user } = useUser();
    const [sessions, setSessions] = useState<OpenSessionData[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchSessions = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Cargar primero de la base local Dexie (Offline-First garantizado)
            let localList: OpenSessionData[] = [];
            try {
                const localActive = await db.sessions
                    .where('status')
                    .equals('active')
                    .reverse()
                    .sortBy('start_time');

                localList = await Promise.all(localActive.map(async (s: any) => {
                    const localItems = await db.items.where('session_id').equals(s.id).toArray();
                    const total_products = localItems.length;
                    const total_units = localItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
                    return {
                        id: s.id,
                        sector: s.sector || "General",
                        start_time: s.start_time,
                        status: s.status,
                        sync_pin: s.sync_pin || "",
                        branch_id: s.branch_id,
                        branch_name: branchName || "",
                        user_id: s.user_id,
                        total_products,
                        total_units,
                        profile: s.profile
                    };
                }));

                if (localList.length > 0) {
                    setSessions(localList);
                    setSelectedId(prev => (prev && localList.some(f => f.id === prev)) ? prev : localList[0].id);
                }
            } catch (localErr) {
                console.warn("[OpenSessionsDialog] Error leyendo sesiones locales Dexie:", localErr);
            }

            // 2. Intentar enriquecer o sincronizar con Supabase si está disponible
            let sessionRows: any[] | null = null;
            const branchMap: Record<string, string> = {};

            try {
                const { data: branchRows } = await supabase
                    .from('branches')
                    .select('id, name');

                if (branchRows) {
                    branchRows.forEach(b => {
                        branchMap[b.id] = b.name;
                    });
                }

                let query: any = (supabase as any)
                    .from('precount_sessions')
                    .select(`
                        *,
                        items:precount_items(quantity)
                    `)
                    .eq('status', 'active')
                    .order('start_time', { ascending: false });

                // Filtrar por sucursal solo si NO es admin
                if (branchId && user?.role !== 'admin') {
                    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
                }

                const res = await query;
                if (!res.error && res.data) {
                    sessionRows = res.data;
                }
            } catch (netErr) {
                console.warn("[OpenSessionsDialog] No se pudo conectar con Supabase (red o certificado), usando datos locales:", netErr);
            }

            const resolveBranchDisplay = (sector: string, sBranchId?: string) => {
                if (sBranchId && branchMap[sBranchId]) {
                    // Si el sector indica claramente una sucursal distinta (ej. test FP ADM guardado con branch Nuñez)
                    if (sector.toLowerCase().includes('fp adm') && branchMap[sBranchId].toLowerCase().includes('nuñez')) {
                        return "FP ADM";
                    }
                    return branchMap[sBranchId];
                }
                const match = sector.trim().match(/^Inventario\s+(.+)$/i);
                if (match) return match[1].trim();
                return branchName || "Central";
            };

            if (sessionRows) {
                const remoteFormatted: OpenSessionData[] = sessionRows.map((s: any) => {
                    const items = s.items || [];
                    const total_products = items.length;
                    const total_units = items.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
                    const bName = resolveBranchDisplay(s.sector || '', s.branch_id);

                    return {
                        id: s.id,
                        sector: s.sector || "General",
                        start_time: s.start_time,
                        status: s.status,
                        sync_pin: s.sync_pin || "",
                        branch_id: s.branch_id,
                        branch_name: bName,
                        user_id: s.user_id,
                        total_products,
                        total_units,
                        profile: s.profile
                    };
                });

                // Merge: priorizamos remoto pero conservamos locales que aún no hayan impactado
                const remoteIds = new Set(remoteFormatted.map(r => r.id));
                const combined = [
                    ...remoteFormatted,
                    ...localList.filter(l => !remoteIds.has(l.id)).map(l => ({
                        ...l,
                        branch_name: resolveBranchDisplay(l.sector, l.branch_id)
                    }))
                ];

                setSessions(combined);
                if (combined.length > 0) {
                    setSelectedId(prev => (prev && combined.some(f => f.id === prev)) ? prev : combined[0].id);
                } else {
                    setSelectedId(null);
                }
            } else if (localList.length > 0) {
                const formattedLocal = localList.map(l => ({
                    ...l,
                    branch_name: resolveBranchDisplay(l.sector, l.branch_id)
                }));
                setSessions(formattedLocal);
                setSelectedId(prev => (prev && formattedLocal.some(f => f.id === prev)) ? prev : formattedLocal[0].id);
            } else {
                setSessions([]);
                setSelectedId(null);
            }
        } catch (err) {
            console.error("Error al consultar sesiones activas:", err);
        } finally {
            setIsLoading(false);
        }
    }, [branchId, branchName]);

    useEffect(() => {
        if (!open) return;
        fetchSessions();

        const channel = supabase
            .channel('open_sessions_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'precount_sessions' }, () => {
                fetchSessions();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [open, fetchSessions]);

    const currentSession = sessions.find(s => s.id === selectedId) || sessions[0] || null;

    const formatStartTime = (dateStr?: string) => {
        if (!dateStr) return "—";
        try {
            const d = new Date(dateStr);
            return format(d, "d 'de' MMMM, HH:mm 'hs'", { locale: es });
        } catch {
            return dateStr;
        }
    };

    const handleDeleteSession = async () => {
        if (!currentSession) return;
        const confirm = window.confirm(
            `¿Estás seguro de que deseas eliminar la sesión "${currentSession.sector}" (${currentSession.branch_name})? Esta acción no se puede deshacer.`
        );
        if (!confirm) return;

        setIsDeleting(true);
        try {
            try {
                await (supabase as any)
                    .from('precount_sessions')
                    .delete()
                    .eq('id', currentSession.id);
            } catch (supaErr) {
                console.warn("[OpenSessionsDialog] Error eliminando en Supabase, procediendo localmente:", supaErr);
            }

            await deleteSessionDB(currentSession.id).catch(() => {});

            if (onDeleteSession) {
                onDeleteSession(currentSession.id);
            }
            if (typeof window !== 'undefined') {
                localStorage.removeItem('last_precount_session_id');
                localStorage.removeItem('precount_session_id');
                sessionStorage.removeItem('active_precount_session_id');

                try {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (k.startsWith('precount_monitor_cache_') || k.startsWith('precount_active_terminal_') || k.includes(currentSession.id))) {
                            keysToRemove.push(k);
                        }
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                } catch {}

                window.dispatchEvent(new CustomEvent('precount:session_deleted', { detail: { sessionId: currentSession.id } }));
            }

            notify.success("Sesión eliminada", `La sesión "${currentSession.sector}" ha sido eliminada`);
            await fetchSessions();
            if (sessions.length <= 1) {
                onOpenChange(false);
            }
        } catch (err: any) {
            console.error("Error al eliminar sesión:", err);
            notify.error("Error al eliminar", err?.message || "No se pudo eliminar la sesión");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleResume = () => {
        if (!currentSession) return;
        if (onResumeSession) {
            onResumeSession(currentSession);
        } else {
            localStorage.setItem('last_precount_session_id', currentSession.id);
            notify.success("Sesión seleccionada", `Retomando ${currentSession.sector}`);
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg" className="sm:max-w-xl font-sans">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold font-sans">
                        Sesiones Abiertas de Inventario
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1 font-sans">
                        Visualizá y gestioná las sesiones activas de inventarios nocturnos.
                    </DialogDescription>
                </DialogHeader>

                {isLoading && sessions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground font-sans">
                        Consultando sesiones activas en Supabase...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="py-8 text-center flex flex-col gap-1 font-sans">
                        <span className="text-sm font-semibold text-foreground">
                            No hay sesiones abiertas
                        </span>
                        <span className="text-xs text-muted-foreground">
                            No se registran inventarios nocturnos en curso en Supabase.
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 py-2 font-sans">
                        {/* Selector de sesión abierta: Única fuente de verdad de la sesión */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-xs font-semibold text-foreground font-sans flex items-center justify-between">
                                <span>Sesión de inventario:</span>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                    {sessions.length} {sessions.length === 1 ? 'sesión activa' : 'sesiones activas'}
                                </span>
                            </label>
                            <Select value={selectedId || ""} onValueChange={(val) => setSelectedId(val || null)}>
                                <SelectTrigger className="h-9 text-xs w-full font-sans">
                                    <span className="truncate flex-1 text-left font-medium text-foreground">
                                        {currentSession ? (
                                            (() => {
                                                const title = cleanSectorTitle(currentSession.sector);
                                                if (!currentSession.branch_name) return title;
                                                if (title.toLowerCase().includes(currentSession.branch_name.toLowerCase()) || currentSession.branch_name.toLowerCase().includes(title.toLowerCase())) {
                                                    return title;
                                                }
                                                return `${title} · ${currentSession.branch_name}`;
                                            })()
                                        ) : "Seleccionar sesión..."}
                                    </span>
                                </SelectTrigger>
                                <SelectContent className="max-h-[220px]">
                                    {sessions.map((s, idx) => {
                                        const title = cleanSectorTitle(s.sector);
                                        const display = s.branch_name && !title.toLowerCase().includes(s.branch_name.toLowerCase()) && !s.branch_name.toLowerCase().includes(title.toLowerCase())
                                            ? `${title} · ${s.branch_name}`
                                            : title;
                                        return (
                                            <SelectItem key={s.id} value={s.id} index={idx} className="font-sans text-xs">
                                                {display}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* PIN de enlace (sin repetir la palabra PIN) */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-xs font-semibold text-foreground font-sans">
                                PIN de enlace:
                            </label>
                            <Input
                                readOnly
                                value={currentSession?.sync_pin || "Sin PIN configurado"}
                                className="h-9 text-xs font-sans bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 rounded-xl px-3 border border-border font-mono tracking-wider"
                            />
                        </div>

                        {/* Fecha y hora de inicio */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-xs font-semibold text-foreground font-sans">
                                Fecha y hora de inicio:
                            </label>
                            <Input
                                readOnly
                                value={formatStartTime(currentSession?.start_time)}
                                className="h-9 text-xs font-sans bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 rounded-xl px-3 border border-border"
                            />
                        </div>

                        {/* Avance de conteo acumulado */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-xs font-semibold text-foreground font-sans">
                                Avance de conteo:
                            </label>
                            <Input
                                readOnly
                                value={`${currentSession?.total_products || 0} productos escaneados (${currentSession?.total_units || 0} unidades totales)`}
                                className="h-9 text-xs font-sans bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 rounded-xl px-3 border border-border"
                            />
                        </div>

                        {/* ID de sesión discreto (sin input redundante) */}
                        {currentSession?.id && (
                            <div className="text-[10px] text-muted-foreground/50 font-mono self-end -mt-1 select-all">
                                ID: {currentSession.id}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="pt-3 mt-4 flex flex-row items-center justify-between w-full sm:justify-between">
                    <div>
                        {currentSession && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={isDeleting}
                                onClick={handleDeleteSession}
                                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
                                title="Eliminar sesión"
                            >
                                <Trash01 className="size-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <DialogClose render={<Button type="button" variant="ghost" className="font-sans text-xs">Cerrar</Button>}>
                            Cerrar
                        </DialogClose>
                        <Button
                            type="button"
                            onClick={handleResume}
                            disabled={!currentSession || isDeleting}
                            className="bg-foreground text-background hover:bg-foreground/90 font-sans text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
                        >
                            Retomar
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

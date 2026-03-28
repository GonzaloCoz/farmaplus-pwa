import { useState, useEffect, useMemo } from "react";
import { auditService, AuditLogEntry } from "@/services/auditService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MapPoint as MapPin, Calendar, User, Magnifer as Search, Filter } from "@solar-icons/react";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Action translations
const ACTION_TRANSLATIONS: Record<string, string> = {
    'LOGIN': 'Inicio de Sesión',
    'LOGOUT': 'Cierre de Sesión',
    'CREATE_INVENTORY': 'Creó Inventario',
    'UPDATE_INVENTORY': 'Actualizó Inventario',
    'DELETE_INVENTORY': 'Eliminó Inventario',
    'FINALIZE_CYCLIC_INVENTORY': 'Finalizó Inventario Cíclico',
    'SAVE_CYCLIC_INVENTORY': 'Guardó Inventario Cíclico',
    'ADJUST_STOCK': 'Ajustó Stock',
    'IMPORT_PRODUCTS': 'Importó Productos',
    'DELETE_REPORT': 'Eliminó Reporte',
    'DOWNLOAD_REPORT': 'Descargó Reporte',
    'CREATE_USER': 'Creó Usuario',
    'UPDATE_USER': 'Actualizó Usuario',
    'DELETE_USER': 'Eliminó Usuario',
    'INVENTORY_ADJUSTMENT': 'Ajuste de Inventario',
    'CYCLE_CLOSURE': 'Cierre de Ciclo',
    'CONFIG_UPDATE_BULK': 'Actualización Masiva de Configuración',
    'INVENTORY_LOCKED': 'Bloqueo de Inventario',
    'INVENTORY_UNLOCKED': 'Desbloqueo de Inventario',
};

// Entity translations (Context of where it happened)
const ENTITY_TRANSLATIONS: Record<string, string> = {
    'auth': 'Módulo de Seguridad',
    'inventory': 'Panel de Inventarios',
    'INVENTORY': 'Panel de Inventarios',
    'product': 'Gestión de Productos',
    'report': 'Centro de Reportes',
    'user': 'Gestión de Usuarios',
    'branch': 'Configuración de Sucursal',
    'setting': 'Ajustes del Sistema',
    'SYSTEM': 'Procesos del Sistema',
    'BRANCH_CONFIG': 'Configuración Global',
    'BRANCH_INVENTORY': 'Monitoreo de Stock'
};

const getTranslatedAction = (action: string) => ACTION_TRANSLATIONS[action] || action;
const getTranslatedEntity = (entity: string) => ENTITY_TRANSLATIONS[entity] || entity;

export default function AdminAudit() {
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const [logs, setLogs] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>(todayStr); // Always today by default
    const [endDate, setEndDate] = useState<string>(todayStr); // Always today by default

    // Mapping cache
    const profileMap = useMemo(() => {
        const map: Record<string, any> = {};
        profiles.forEach(p => (map[p.id] = p));
        return map;
    }, [profiles]);

    const branchMap = useMemo(() => {
        const map: Record<string, any> = {};
        branches.forEach(b => (map[b.id] = b));
        return map;
    }, [branches]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [branchFilter, startDate, endDate]);

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('audit-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'audit_logs'
                },
                (payload) => {
                    // Only process while tab is visible and component is active
                    if (document.visibilityState !== 'visible') return;

                    const newLog = payload.new as any;

                    // Filter by branch if active
                    if (branchFilter !== 'all' && newLog.branch_id !== branchFilter) return;

                    // Prepend to list (maintaining limit by slicing)
                    setLogs(prev => [newLog, ...prev].slice(0, 100));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [branchFilter]); // Re-subscribe if filter changes to ensure correct logic

    const fetchInitialData = async () => {
        try {
            const [{ data: bData }, { data: pData }] = await Promise.all([
                supabase.from('branches').select('id, name').order('name'),
                supabase.from('profiles').select('id, full_name, username')
            ]);
            setBranches(bData || []);
            setProfiles(pData || []);
        } catch (e) {
            console.error("Error fetching initial data", e);
        }
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await auditService.getLogs({
                limit: 100,
                branchId: branchFilter,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });
            setLogs(data || []);
        } catch (e) {
            console.error("Error fetching logs", e);
        } finally {
            setLoading(false);
        }
    };

    const formatDetails = (details: any, action: string) => {
        if (!details) return '-';
        if (typeof details === 'string') return details;

        try {
            // Context-aware translations
            if (action === 'INVENTORY_ADJUSTMENT' || action === 'FINALIZE_CYCLIC_INVENTORY' || action === 'SAVE_CYCLIC_INVENTORY') {
                const labStr = details.lab ? `Lab: ${details.lab}` : '';
                const unitsStr = details.unitsAdjusted !== undefined ? `Unidades: ${details.unitsAdjusted}` : '';
                const valueStr = details.netValue !== undefined ? `Impacto: $${details.netValue.toLocaleString('es-AR')}` : '';
                return [labStr, unitsStr, valueStr].filter(Boolean).join(' | ');
            }

            if (details.product_name) {
                return `Producto: ${details.product_name}${details.ean ? ` (${details.ean})` : ''} | Cant: ${details.quantity || 0}`;
            }

            if (action.includes('CONFIG')) {
                const daysStr = details.days !== undefined ? `Días: ${details.days}` : '';
                const countStr = details.count !== undefined ? `Sucursales: ${details.count}` : '';
                return [daysStr, countStr].filter(Boolean).join(' | ');
            }

            if (details.reason) {
                return `Motivo: ${details.reason}`;
            }

            if (details.username || details.full_name) {
                return `Usuario: ${details.full_name || details.username}`;
            }

            return JSON.stringify(details);
        } catch (e) {
            return JSON.stringify(details);
        }
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Custom CSS to hide date picker icon and improve scroll appearance */}
            <style dangerouslySetInnerHTML={{
                __html: `
                input[type="date"]::-webkit-calendar-picker-indicator {
                    display: none;
                    -webkit-appearance: none;
                }
                .audit-table-container::-webkit-scrollbar {
                  width: 6px;
                  height: 6px;
                }
                .audit-table-container::-webkit-scrollbar-track {
                  background: transparent;
                }
                .audit-table-container::-webkit-scrollbar-thumb {
                  background: rgba(var(--primary-rgb), 0.1);
                  border-radius: 10px;
                }
                .audit-table-container::-webkit-scrollbar-thumb:hover {
                  background: rgba(var(--primary-rgb), 0.2);
                }
            ` }} />

            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-primary/70" />
                    <h3 className="text-lg font-semibold text-foreground/80">Monitor de Actividad del Sistema</h3>
                </div>
                <Badge variant="outline" className="text-muted-foreground border-border/50 bg-muted/20">Últimos 100 eventos</Badge>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-1">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Sucursal</label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger className="bg-background/50 border-border/50 rounded-xl">
                            <SelectValue placeholder="Todas las sucursales" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las sucursales</SelectItem>
                            {branches.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Desde</label>
                    <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Hasta</label>
                    <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="flex items-end pb-0.5">
                    <button
                        onClick={() => { setBranchFilter("all"); setStartDate(""); setEndDate(""); }}
                        className="text-xs font-medium text-primary hover:text-primary/80 transition-colors ml-2 mb-2 p-1"
                    >
                        Limpiar filtros / Ver Historial
                    </button>
                </div>
            </div>

            <Frame>
                <FramePanel className="p-0 overflow-hidden">
                    <Table className="relative">
                        <TableHeader className="bg-transparent">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-[180px] pl-6">Fecha / Hora</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Sucursal</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Sección App</TableHead>
                                <TableHead className="min-w-[250px] max-w-[400px] pr-6">Detalles de Operación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="bg-background rounded-l-xl rounded-r-xl overflow-hidden shadow-xs/5">
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                            <p className="text-muted-foreground animate-pulse font-medium text-sm">Sincronizando registros...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : logs.length > 0 ? (
                                logs.map((log) => {
                                    const profile = profileMap[log.user_id];
                                    const branch = branchMap[log.branch_id];

                                    return (
                                        <TableRow key={log.id} className="group border-t border-border/40 first:border-none">
                                            <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground/80 pl-6">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5 opacity-40" />
                                                    {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shadow-inner">
                                                        <User className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-foreground/90 leading-snug">
                                                            {profile?.full_name || profile?.username || 'Sistema'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/60">
                                                            @{profile?.username || 'system'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium">
                                                    <MapPin className="w-3 h-3 opacity-60 text-primary/60" />
                                                    {branch?.name || 'Casa Central'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={log.action.includes('DELETE') || log.action.includes('REMOVE') || log.action.includes('PURGE') ? 'destructive-outline' : 'outline'}
                                                    className="rounded-lg text-[10px] px-2 py-0 h-5 font-bold uppercase tracking-tight"
                                                >
                                                    {getTranslatedAction(log.action)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="bg-primary/5 border-primary/10 text-primary/70 rounded-lg font-medium whitespace-nowrap h-5 px-2">
                                                    {getTranslatedEntity(log.entity_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[400px] pr-6">
                                                <div className="text-xs text-muted-foreground/80 font-medium group-hover:text-foreground/90 transition-colors leading-relaxed">
                                                    {formatDetails(log.details, log.action)}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                                                <Search className="w-8 h-8 text-muted-foreground/20" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-semibold text-foreground/60">No hay eventos para mostrar</h3>
                                                <p className="text-sm text-muted-foreground/40 max-w-[280px] mx-auto">
                                                    {startDate === todayStr && endDate === todayStr ?
                                                        "Hoy no se registraron acciones. Podés consultar días anteriores usando los filtros." :
                                                        "Intentá ajustando el rango de fechas o la sucursal seleccionada."}
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => { setBranchFilter("all"); setStartDate(""); setEndDate(""); }}
                                                className="px-6 h-10 shadow-lg shadow-primary/20"
                                            >
                                                Ver todo el historial
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </FramePanel>
            </Frame>
        </div>
    );
}

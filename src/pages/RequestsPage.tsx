"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MasterCatalogItem } from "@/services/preCountDB";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COLOR_PALETTE: BadgeColor[] = ["blue", "emerald", "amber", "violet", "cyan", "indigo", "teal", "fuchsia", "rose", "orange"];

function getBatchColor(batchStr: string): BadgeColor {
    if (!batchStr || batchStr === "S/L") return "gray";
    let hash = 0;
    for (let i = 0; i < batchStr.length; i++) {
        hash = batchStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTE.length;
    return COLOR_PALETTE[index];
}

import { Button } from "@/components/ui/button";
import { Table, type TableColumn } from "@/components/motion/table";
import { 
    Pencil01 as Pencil, 
    Trash01 as Trash2, 
    Clock, 
    SearchLg as Search,
    Eye,
    Check,
    XClose as XIcon,
    User01 as UserIcon
} from '@untitledui/icons';
import { format } from "date-fns";
import { SwipeableList, type SwipeableListItem } from "@/components/motion/swipeable-list";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/UserContext";
import { Navigate } from "react-router-dom";
import { requestsService } from "@/services/requestsService";
import { supabase } from "@/integrations/supabase/client";

export type RequestTypeLabel = 'Baja de Laboratorio' | 'Alta de Laboratorio' | 'Revisión Vto.' | 'Control Post-Nocturno';
export type RequestStatusLabel = 'pending' | 'approved' | 'rejected';

export interface SmartAnalystItem {
    id: string;
    date: number;
    type: RequestTypeLabel;
    branch: string;
    reference: string;
    referenceSub?: string;
    rubro: string;
    reason: string;
    status: RequestStatusLabel;
    requestedBy: string;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    controlDate?: number;
    timestamp?: number;
    productName?: string;
    quantity?: number;
    ean?: string;
}

interface PreCountListProps {
    items?: SmartAnalystItem[];
    mode?: "full" | "restricted" | "readonly";
    onUpdate?: (id: string, quantity: number) => void;
    onDelete?: (id: string) => void;
    onEditRequest?: (item: SmartAnalystItem) => void;
    masterCatalog?: MasterCatalogItem[];
}

const MOCK_ITEMS: SmartAnalystItem[] = [];

export default function SmartAnalystPage({ 
    items = MOCK_ITEMS, 
    onUpdate, 
    onDelete, 
    onEditRequest, 
}: PreCountListProps) {
    const { user, isLoading } = useUser();
    const isAdmin = user?.role === 'admin';

    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [tableHeight, setTableHeight] = useState(500);
    const [hoveredBatch, setHoveredBatch] = useState<{ rowId: string; loteName?: string; status?: string } | null>(null);
    const [itemList, setItemList] = useState<SmartAnalystItem[]>(items);

    const loadRequests = useCallback(async () => {
        try {
            const data = await requestsService.getRequests(isAdmin ? undefined : user?.branchSheet);
            const mapped: SmartAnalystItem[] = data.map(d => ({
                id: d.id,
                date: new Date(d.requestedAt).getTime(),
                type: d.type as RequestTypeLabel,
                branch: d.branchName,
                reference: d.targetName,
                referenceSub: d.comments,
                rubro: d.category || "General",
                reason: d.reason,
                status: d.status,
                requestedBy: d.requestedBy || d.branchName,
                reviewedBy: d.reviewedBy,
                reviewedAt: d.reviewedAt,
                rejectionReason: d.rejectionReason
            }));
            setItemList(mapped);
        } catch (e) {
            console.error("Error loading requests:", e);
        }
    }, [isAdmin, user?.branchSheet]);

    useEffect(() => {
        loadRequests();

        // Suscripción Realtime para actualizar al instante en todas las pantallas
        const channel = supabase
            .channel('requests-realtime-listener')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
                loadRequests();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadRequests]);

    const [approveItem, setApproveItem] = useState<SmartAnalystItem | null>(null);
    const [rejectItem, setRejectItem] = useState<SmartAnalystItem | null>(null);
    const [rejectReasonInput, setRejectReasonInput] = useState("");
    const [editItem, setEditItem] = useState<SmartAnalystItem | null>(null);
    const [editSelectedStatus, setEditSelectedStatus] = useState<RequestStatusLabel>('pending');
    const [editReason, setEditReason] = useState("");
    const [editCustomReason, setEditCustomReason] = useState("");
    const [editComments, setEditComments] = useState("");
    const [viewItem, setViewItem] = useState<SmartAnalystItem | null>(null);

    // Detectar layout móvil
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calcular altura disponible basándose en la posición del contenedor en el viewport
    const tableWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const calcHeight = () => {
            if (!tableWrapperRef.current) return;
            const rect = tableWrapperRef.current.getBoundingClientRect();
            const available = window.innerHeight - rect.top - 48;
            setTableHeight(Math.max(available, 200));
        };

        const raf = requestAnimationFrame(calcHeight);
        window.addEventListener('resize', calcHeight);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', calcHeight);
        };
    }, []);

    // Filtrar items
    const filteredItems = useMemo(() => {
        return itemList.filter(item => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                item.reference.toLowerCase().includes(query) ||
                item.branch.toLowerCase().includes(query) ||
                item.type.toLowerCase().includes(query) ||
                item.reason.toLowerCase().includes(query) ||
                (item.rubro && item.rubro.toLowerCase().includes(query)) ||
                (item.requestedBy && item.requestedBy.toLowerCase().includes(query))
            );
        });
    }, [itemList, searchQuery]);

    // Estadísticas
    const totalSolicitudes = filteredItems.length;
    const pendingCount = filteredItems.filter(i => i.status === 'pending').length;
    const approvedCount = filteredItems.filter(i => i.status === 'approved').length;
    const rejectedCount = filteredItems.filter(i => i.status === 'rejected').length;

    // Columnas de la tabla BeUI
    const columns = useMemo<TableColumn<SmartAnalystItem>[]>(
        () => [
            {
                key: "date",
                header: "Fecha",
                width: "110px",
                sortable: true,
                cell: (row) => (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(row.date || row.timestamp || Date.now(), 'dd/MM/yyyy')}
                    </span>
                ),
            },
            {
                key: "type",
                header: "Tipo",
                width: "140px",
                sortable: true,
                cell: (row) => (
                    <Badge variant="dot" showDot={false} color="blue" size="sm" className="whitespace-nowrap">
                        {row.type}
                    </Badge>
                ),
            },
            {
                key: "branch",
                header: "Solicitante",
                width: "130px",
                sortable: true,
                cell: (row) => (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <UserIcon className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-xs text-foreground truncate">{row.requestedBy || row.branch}</span>
                    </div>
                ),
            },
            {
                key: "reference",
                header: "Referencia / Ítem",
                width: "160px",
                sortable: true,
                cell: (row) => (
                    <span className="font-bold text-xs text-foreground truncate block">{row.reference}</span>
                ),
            },
            {
                key: "rubro",
                header: "Rubro / Sector",
                width: "150px",
                sortable: true,
                cell: (row) => (
                    <Badge variant="dot" showDot={false} color="gray" size="sm" className="truncate max-w-[140px] uppercase text-[10px]">
                        {row.rubro === "Baja Total (Todos los rubros)" ? "Baja Total" : (row.rubro || "Varios")}
                    </Badge>
                ),
            },
            {
                key: "reason",
                header: "Motivo / Detalle",
                width: "280px",
                sortable: true,
                cell: (row) => (
                    <span className="text-xs text-foreground/80 leading-snug line-clamp-2 block max-w-[280px]" title={row.reason}>
                        {row.reason}
                    </span>
                ),
            },
            {
                key: "status",
                header: "Estado",
                width: "120px",
                sortable: true,
                cell: (row) => {
                    const statusConfig = {
                        pending: { label: "Pendiente", color: "amber" as BadgeColor },
                        approved: { label: "Aprobada", color: "emerald" as BadgeColor },
                        rejected: { label: "Rechazada", color: "rose" as BadgeColor }
                    };
                    const config = statusConfig[row.status] || statusConfig.pending;
                    return (
                        <Badge variant="dot" showDot={true} color={config.color} size="sm" className="whitespace-nowrap">
                            {config.label}
                        </Badge>
                    );
                },
            },
            {
                key: "actions",
                header: "Acciones",
                width: "130px",
                cell: (row) => (
                    <div className="flex items-center gap-1">
                        {isAdmin && row.status === 'pending' && (
                            <>
                                <Tooltip content="Aprobar Solicitud" side="top">
                                    <Button
                                        variant="tertiary"
                                        size="sm"
                                        className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-emerald-500/10 transition-all active:scale-[0.96]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setApproveItem(row);
                                        }}
                                    >
                                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="Rechazar Solicitud" side="top">
                                    <Button
                                        variant="tertiary"
                                        size="sm"
                                        className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-red-500/10 transition-all active:scale-[0.96]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRejectReasonInput("");
                                            setRejectItem(row);
                                        }}
                                    >
                                        <XIcon className="size-3.5 text-red-500" />
                                    </Button>
                                </Tooltip>
                            </>
                        )}
                        {(isAdmin || row.status !== 'approved') && (
                            <Tooltip content={isAdmin ? "Editar Estado / Acción" : "Re-editar Solicitud"} side="top">
                                <Button
                                    variant="tertiary"
                                    size="sm"
                                    className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-primary/10 transition-all active:scale-[0.96]"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditItem(row);
                                        setEditSelectedStatus(row.status);
                                        setEditReason(row.reason || "Stock 0 en Plex / No hay datos para mostrar");
                                        setEditCustomReason("");
                                        setEditComments(row.referenceSub || "");
                                    }}
                                >
                                    <Pencil className="size-3.5 text-muted-foreground hover:text-primary" />
                                </Button>
                            </Tooltip>
                        )}
                        <Tooltip content="Ver Detalle" side="top">
                            <Button
                                variant="tertiary"
                                size="sm"
                                className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-primary/10 transition-all active:scale-[0.96]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewItem(row);
                                }}
                            >
                                <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                        </Tooltip>
                    </div>
                ),
            },
        ],
        [isAdmin]
    );

    // Items para swipeable en mobile
    const swipeableItems = useMemo<SwipeableListItem[]>(() => {
        return filteredItems.map((item) => ({
            id: item.id,
            leftActions: [
                {
                    id: "edit",
                    label: "Editar",
                    icon: <Pencil className="size-4 text-primary" />,
                    tone: "primary" as const,
                    onClick: () => onEditRequest?.(item)
                }
            ],
            rightActions: [
                {
                    id: "delete",
                    label: "Borrar",
                    icon: <Trash2 className="size-4 text-destructive" />,
                    tone: "danger" as const,
                    onClick: () => onDelete?.(item.id)
                }
            ]
        }));
    }, [filteredItems, onEditRequest, onDelete]);

    const renderSwipeableItem = (swipeItem: SwipeableListItem) => {
        const originalItem = filteredItems.find(i => i.id === swipeItem.id);
        if (!originalItem) return null;

        const timeStr = format(originalItem.date || originalItem.timestamp || Date.now(), 'dd/MM HH:mm');

        return (
            <div 
                onClick={() => onEditRequest?.(originalItem)}
                className="flex items-center justify-between w-full h-full text-left cursor-pointer"
            >
                <div className="flex-1 min-w-0 pr-3 flex flex-col gap-0.5">
                    <div className="font-bold text-[13px] leading-tight text-foreground line-clamp-1">
                        {originalItem.reference}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                        <span className="font-semibold text-foreground">{originalItem.branch}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{originalItem.reason}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="dot" showDot={false} color="blue" size="sm" className="h-5 px-1.5 font-normal text-[10px]">
                            {originalItem.type}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="size-3 opacity-60" />
                            {timeStr}
                        </div>
                    </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-center">
                    <Badge variant="dot" showDot={true} color={originalItem.status === 'approved' ? 'emerald' : originalItem.status === 'rejected' ? 'rose' : 'amber'} size="sm">
                        {originalItem.status === 'approved' ? 'Aprobada' : originalItem.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                    </Badge>
                </div>
            </div>
        );
    };

    if (isLoading) return null;
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div 
            ref={containerRef}
            className="flex flex-col flex-1 overflow-hidden h-full w-full min-w-0 min-h-0 gap-2 p-4"
        >
            {/* Toolbar Superior: Contador y Buscador */}
            <div className="flex items-center justify-between gap-3 shrink-0 px-4 pt-3 pb-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                    <Badge size="lg" variant="dot" showDot={false} color="blue">
                        {totalSolicitudes} Solicitudes
                    </Badge>
                    <Badge size="lg" variant="dot" showDot={false} color="amber">
                        {pendingCount} Pendientes
                    </Badge>
                    <Badge size="lg" variant="dot" showDot={false} color="emerald">
                        {approvedCount} Aprobadas
                    </Badge>
                    <Badge size="lg" variant="dot" showDot={false} color="rose">
                        {rejectedCount} Rechazadas
                    </Badge>
                </div>

                <div className="w-full max-w-[320px]">
                    <div className="relative inline-flex w-full min-w-0 items-center rounded-xl border border-input bg-background/50 text-xs text-foreground shadow-xs/5 transition-shadow sm:text-xs" role="group">
                        <div className="flex h-auto cursor-text select-none items-center justify-center ps-3">
                            <Search className="size-3.5 text-muted-foreground/80" aria-hidden="true" />
                        </div>
                        <input 
                            aria-label="Buscar solicitudes..." 
                            placeholder="Buscar por sucursal, ítem, tipo o motivo..." 
                            type="search" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-full min-w-0 px-2.5 outline-none placeholder:text-muted-foreground/70 bg-transparent border-none text-xs" 
                        />
                    </div>
                </div>
            </div>

            {/* Data Table beui (Desktop) */}
            <div ref={tableWrapperRef} className="hidden md:block flex-1 min-h-0 w-full overflow-hidden">
                <Table
                    data={filteredItems}
                    columns={columns}
                    getRowId={(row) => row.id}
                    resizable
                    reorderable
                    defaultSort={{ key: "date", direction: "desc" }}
                    height={tableHeight}
                    rowHeight={52}
                    overscan={5}
                    emptyState={
                        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-xs">
                            No hay solicitudes registradas.
                        </div>
                    }
                    className="rounded-2xl border-none w-full"
                />
            </div>

            {/* Mobile Swipeable List View */}
            <div className="block md:hidden flex-1 overflow-auto scrollbar-none py-1 min-w-0">
                {swipeableItems.length > 0 ? (
                    <SwipeableList
                        items={swipeableItems}
                        renderItem={renderSwipeableItem}
                        classNames={{
                            root: "gap-2.5",
                            surface: "bg-card border-border/40 shadow-xs px-4 py-3 rounded-2xl flex items-center min-h-[80px]",
                            item: "rounded-2xl bg-muted/20 border border-border/20",
                            rail: "rounded-2xl"
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground/60">
                        <span className="text-xs">No hay solicitudes registradas.</span>
                    </div>
                )}
            </div>

            {/* Dialog Confirmar Aprobación (Estilo Fluid Functionalism) */}
            <Dialog open={!!approveItem} onOpenChange={(open) => { if (!open) setApproveItem(null); }}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Aprobar {approveItem?.reference}</DialogTitle>
                            <DialogDescription>
                                ¿Estás seguro de que quieres aprobar esta solicitud de <strong>{approveItem?.type}</strong> para la sucursal <strong>{approveItem?.branch}</strong>?
                            </DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                            <DialogClose render={<Button type="button" variant="ghost" />}>
                                Cancelar
                            </DialogClose>
                            <Button
                                onClick={async () => {
                                    if (approveItem) {
                                        await requestsService.approveRequest(approveItem.id, user?.username || "Admin");
                                        await loadRequests();
                                        setApproveItem(null);
                                    }
                                }}
                            >
                                Aprobar
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Confirmar Rechazo (Estilo Fluid Functionalism) */}
            <Dialog open={!!rejectItem} onOpenChange={(open) => { 
                if (!open) {
                    setRejectItem(null);
                    setRejectReasonInput("");
                }
            }}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Rechazar {rejectItem?.reference}</DialogTitle>
                            <DialogDescription>
                                Especifica el motivo o justificación del rechazo para la sucursal <strong>{rejectItem?.branch}</strong>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2 py-2">
                            <label className="text-xs font-semibold text-foreground">
                                Motivo del rechazo <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                value={rejectReasonInput}
                                onChange={(e) => setRejectReasonInput(e.target.value)}
                                placeholder="Ej: El laboratorio posee stock activo en depósito / No corresponde la baja en este ciclo..."
                                className="min-h-[90px] text-xs resize-none text-foreground bg-surface-2 border-border/50 placeholder:text-muted-foreground/60"
                                required
                            />
                        </div>

                        <DialogFooter>
                            <DialogClose render={<Button type="button" variant="ghost" />}>
                                Cancelar
                            </DialogClose>
                            <Button
                                disabled={!rejectReasonInput.trim()}
                                onClick={async () => {
                                    if (rejectItem && rejectReasonInput.trim()) {
                                        await requestsService.rejectRequest(
                                            rejectItem.id, 
                                            user?.username || "Admin", 
                                            rejectReasonInput.trim()
                                        );
                                        await loadRequests();
                                        setRejectItem(null);
                                        setRejectReasonInput("");
                                    }
                                }}
                            >
                                Rechazar Solicitud
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Editar Estado / Acción (Admin) o Re-editar Solicitud (Sucursal) */}
            <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                        <DialogTitle>
                                {isAdmin 
                                    ? `Editar Estado de ${editItem?.reference}` 
                                    : `Re-editar Solicitud: ${editItem?.reference}`
                                }
                            </DialogTitle>
                            <DialogDescription>
                                {isAdmin 
                                    ? `Modifica el estado o resolución asignada a esta solicitud de ${editItem?.type} de ${editItem?.branch}.`
                                    : `Modifica el motivo o justificación de tu solicitud para revisión del equipo central.`
                                }
                            </DialogDescription>
                        </DialogHeader>

                        {isAdmin ? (
                            <div className="flex flex-col gap-2 py-2">
                                <label className="text-xs font-semibold text-foreground">Estado de la solicitud:</label>
                                <Select value={editSelectedStatus} onValueChange={(val) => setEditSelectedStatus(val as RequestStatusLabel)}>
                                    <SelectTrigger placeholder="Seleccionar estado..." className="h-9 text-xs w-48" />
                                    <SelectContent>
                                        <SelectItem index={0} value="pending" className="text-xs">Pendiente</SelectItem>
                                        <SelectItem index={1} value="approved" className="text-xs">Aprobada</SelectItem>
                                        <SelectItem index={2} value="rejected" className="text-xs">Rechazada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 py-2">
                                <label className="text-xs font-semibold text-foreground">Motivo de la solicitud:</label>
                                <Select value={editReason} onValueChange={setEditReason}>
                                    <SelectTrigger placeholder="Seleccionar motivo..." className="h-9 text-xs w-full" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="Stock 0 en Plex / No hay datos para mostrar" className="text-xs">
                                            Stock 0 en Plex / No hay datos para mostrar
                                        </SelectItem>
                                        <SelectItem index={1} value="Laboratorio discontinuado / no se comercializa" className="text-xs">
                                            Laboratorio discontinuado / no se comercializa
                                        </SelectItem>
                                        <SelectItem index={2} value="Asignación incorrecta de rubro" className="text-xs">
                                            Asignación incorrecta de rubro
                                        </SelectItem>
                                        <SelectItem index={3} value="Laboratorio duplicado en el listado" className="text-xs">
                                            Laboratorio duplicado en el listado
                                        </SelectItem>
                                        <SelectItem index={4} value="Otro motivo (especificar)" className="text-xs">
                                            Otro motivo (especificar)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {editReason === "Otro motivo (especificar)" && (
                                    <Input
                                        value={editCustomReason}
                                        onChange={(e) => setEditCustomReason(e.target.value)}
                                        placeholder="Describe el motivo específico..."
                                        className="h-9 text-xs mt-1"
                                        required
                                    />
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <DialogClose render={<Button type="button" variant="ghost" />}>
                                Cancelar
                            </DialogClose>
                            <Button
                                onClick={async () => {
                                    if (editItem) {
                                        if (isAdmin) {
                                            await requestsService.updateRequestStatus(editItem.id, editSelectedStatus, user?.username || "Admin");
                                        } else {
                                            const finalReason = editReason === "Otro motivo (especificar)" 
                                                ? (editCustomReason.trim() || "Otro motivo") 
                                                : editReason;
                                            await requestsService.updateRequestDetails(editItem.id, finalReason, editComments);
                                        }
                                        await loadRequests();
                                        setEditItem(null);
                                    }
                                }}
                            >
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Ver Detalle Completo */}
            <Dialog open={!!viewItem} onOpenChange={(open) => { if (!open) setViewItem(null); }}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Detalle de la Solicitud</DialogTitle>
                            <DialogDescription>
                                Información completa registrada para esta solicitud.
                            </DialogDescription>
                        </DialogHeader>

                        {viewItem && (
                            <div className="grid grid-cols-2 gap-3 py-2 text-xs">
                                <div className="p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-medium">Ítem / Referencia</span>
                                    <span className="font-semibold text-foreground block">{viewItem.reference}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-medium">Tipo de Solicitud</span>
                                    <span className="font-semibold text-foreground block">{viewItem.type}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-medium">Solicitante</span>
                                    <span className="font-semibold text-foreground block">{viewItem.requestedBy || viewItem.branch}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-medium">Rubro / Sector</span>
                                    <span className="font-semibold text-foreground block">
                                        {viewItem.rubro === "Baja Total (Todos los rubros)" ? "Baja Total" : (viewItem.rubro || "Varios")}
                                    </span>
                                </div>
                                <div className="col-span-2 p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-medium">Motivo / Justificación</span>
                                    <span className="font-semibold text-foreground block leading-relaxed">{viewItem.reason}</span>
                                </div>
                                {viewItem.referenceSub && (
                                    <div className="col-span-2 p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                        <span className="text-[11px] text-muted-foreground block font-medium">Observaciones / Comentarios</span>
                                        <span className="font-semibold text-foreground block leading-relaxed">{viewItem.referenceSub}</span>
                                    </div>
                                )}

                                {/* Información de Auditoría / Control si fue Aprobada o Rechazada */}
                                {(viewItem.status === 'approved' || viewItem.status === 'rejected' || viewItem.reviewedBy) && (
                                    <>
                                        <div className="p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                            <span className="text-[11px] text-muted-foreground block font-medium">Auditada / Controlada por</span>
                                            <span className="font-semibold text-foreground block">{viewItem.reviewedBy || "Administrador"}</span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                            <span className="text-[11px] text-muted-foreground block font-medium">Día y Horario</span>
                                            <span className="font-semibold text-foreground block">
                                                {viewItem.reviewedAt 
                                                    ? format(new Date(viewItem.reviewedAt), "dd/MM/yyyy HH:mm 'hs'")
                                                    : "--/--/----"
                                                }
                                            </span>
                                        </div>
                                        {viewItem.rejectionReason && (
                                            <div className="col-span-2 p-3 rounded-xl bg-surface-3 border border-border/40 space-y-1">
                                                <span className="text-[11px] text-muted-foreground block font-medium">Motivo de Rechazo</span>
                                                <span className="font-semibold text-red-500 block">{viewItem.rejectionReason}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <DialogClose render={<Button type="button" variant="ghost" />}>
                                Cerrar
                            </DialogClose>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

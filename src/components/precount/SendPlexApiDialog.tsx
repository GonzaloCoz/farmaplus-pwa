import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { Badge } from "@/components/ui/badge";
import {
    Database,
    Send,
    Package,
    Layers,
    Store,
    CheckCircle2,
    Loader2,
    Server,
    AlertTriangle,
    Wifi,
    WifiOff,
    Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/services/db';
import { OFFICIAL_71_BRANCHES } from '@/lib/branchNetworkMap';
import { 
    sendPlexInventoryApiBatch, 
    testMysqlConnection, 
    type MysqlConfig,
    type PlexBatchItemInput 
} from '@/services/mysqlTauriBridge';

export interface SendPlexApiDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inventoryTitle: string;
    sectorOrLab: string;
    items?: Array<{
        id?: string;
        id_producto?: string | number;
        ean: string;
        productName?: string;
        quantity: number;
        cost?: number;
        laboratory?: string;
        rubro?: string;
        sector?: string;
    }>;
    sessionId?: string;
    onExportSuccess?: (batchId: number) => void;
}

export function SendPlexApiDialog({
    open,
    onOpenChange,
    inventoryTitle,
    sectorOrLab,
    items,
    sessionId,
    onExportSuccess,
}: SendPlexApiDialogProps) {
    const { user } = useUser();
    const [isSending, setIsSending] = useState(false);
    const [isCheckingConn, setIsCheckingConn] = useState(false);
    const [connStatus, setConnStatus] = useState<'idle' | 'connected' | 'error'>('idle');
    const [connError, setConnError] = useState<string | null>(null);
    const [createdBatchId, setCreatedBatchId] = useState<number | null>(null);

    // Resolver ID de la sesión activa
    const effectiveSessionId = useMemo(() => {
        if (sessionId) return sessionId;
        if (typeof window !== 'undefined') {
            return localStorage.getItem('last_precount_session_id') ||
                localStorage.getItem('precount_session_id') ||
                sessionStorage.getItem('active_precount_session_id') ||
                '';
        }
        return '';
    }, [sessionId]);

    // Live Dexie query as reliable fallback or real-time source
    const liveDbItems = useLiveQuery(
        async () => {
            if (!open) return [];
            try {
                let records: any[] = [];
                if (effectiveSessionId) {
                    records = await db.items.where('session_id').equals(effectiveSessionId).toArray();
                }

                // Map catalog info if available
                const productsMap = new Map<string, { lab?: string; rubro?: string; name?: string; id_producto?: string }>();
                if (effectiveSessionId) {
                    const sessionProducts = await db.precount_products.where('session_id').equals(effectiveSessionId).toArray();
                    sessionProducts.forEach(p => {
                        productsMap.set(p.ean, { lab: p.laboratory, rubro: p.rubro, name: p.name, id_producto: p.id_producto });
                    });
                }

                return records.map(rec => {
                    const catInfo = productsMap.get(rec.ean);
                    return {
                        id: rec.id,
                        id_producto: rec.id_producto || catInfo?.id_producto,
                        ean: rec.ean,
                        productName: rec.product_name || catInfo?.name || `Producto ${rec.ean}`,
                        quantity: Number(rec.quantity) || 1,
                        laboratory: rec.laboratory || catInfo?.lab || 'SIN CLASIFICAR',
                        rubro: rec.rubro || catInfo?.rubro || 'Varios',
                        sector: rec.location_tag || rec.sector || sectorOrLab || 'General'
                    };
                });
            } catch (err) {
                console.error('[SendPlexApiDialog] Error leyendo Dexie items:', err);
                return [];
            }
        },
        [open, effectiveSessionId, sectorOrLab]
    );

    const activeItems = useMemo(() => {
        if (items && items.length > 0) return items;
        return liveDbItems || [];
    }, [items, liveDbItems]);

    // Resolver Sucursal e IP de destino
    const targetBranch = useMemo(() => {
        const storedBranch = typeof window !== 'undefined' ? localStorage.getItem('plex_target_branch') : null;
        const branchName = user?.branchName || storedBranch || 'FP ADM (Pruebas)';
        
        // Buscar en la lista de sucursales oficiales
        const found = OFFICIAL_71_BRANCHES.find(b => 
            b.name.toLowerCase().includes(branchName.toLowerCase()) ||
            branchName.toLowerCase().includes(b.name.toLowerCase()) ||
            (user?.branchId && b.branchId === Number(user.branchId))
        );

        if (found) {
            return {
                name: found.name,
                ip: found.primaryIp,
                port: 3306,
                branchId: found.branchId
            };
        }

        // Por defecto: FP ADM (Pruebas)
        return {
            name: 'FP ADM (Pruebas)',
            ip: '172.30.40.63',
            port: 3306,
            branchId: 1
        };
    }, [user?.branchName, user?.branchId]);

    const mysqlConfig: MysqlConfig = useMemo(() => ({
        host: targetBranch.ip,
        port: targetBranch.port,
        user: 'root',
        password: 'm@st3rpl3x0nz3',
        database: 'plex',
    }), [targetBranch.ip, targetBranch.port]);

    // Verificar conexión al abrir el modal
    useEffect(() => {
        if (!open) {
            setCreatedBatchId(null);
            setConnStatus('idle');
            setConnError(null);
            return;
        }

        let isMounted = true;
        const checkConnection = async () => {
            setIsCheckingConn(true);
            try {
                const res = await testMysqlConnection(mysqlConfig);
                if (!isMounted) return;
                if (res.success) {
                    setConnStatus('connected');
                    setConnError(null);
                } else {
                    setConnStatus('error');
                    setConnError(res.message || 'No se pudo conectar al host.');
                }
            } catch (err: any) {
                if (!isMounted) return;
                setConnStatus('error');
                setConnError(err?.message || String(err));
            } finally {
                if (isMounted) setIsCheckingConn(false);
            }
        };

        checkConnection();

        return () => {
            isMounted = false;
        };
    }, [open, mysqlConfig]);

    const totalUnits = activeItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const totalSkus = new Set(activeItems.map(it => it.ean)).size;

    const handleConfirmSendToPlex = async () => {
        if (activeItems.length === 0) {
            toast.error('No hay productos contados para exportar');
            return;
        }

        setIsSending(true);
        try {
            const batchPayload: PlexBatchItemInput[] = activeItems.map(it => ({
                id_producto: it.id_producto ? Number(it.id_producto) : undefined,
                codebar: it.ean,
                cantidad: Number(it.quantity) || 1
            }));

            const res = await sendPlexInventoryApiBatch(mysqlConfig, batchPayload);

            if (!res.success || !res.id_registro) {
                throw new Error(res.message || 'Error al registrar lote en Plex');
            }

            setCreatedBatchId(res.id_registro);
            toast.success(
                `Lote #${res.id_registro} enviado a Plex`,
                {
                    description: `Se transmitieron ${res.total_units} unidades (${res.total_items} SKUs) a ${res.host}. Listo para Carga desde API.`
                }
            );

            if (onExportSuccess) {
                onExportSuccess(res.id_registro);
            }
        } catch (error: any) {
            console.error('Error al enviar lote a Plex:', error);
            toast.error('Error al enviar a Plex', {
                description: error.message || 'No se pudo completar la transmisión a inventario_ws.'
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-6 rounded-[24px] border border-border/60 bg-white dark:bg-surface-2 shadow-xl">
                <DialogHeader className="space-y-2 text-left">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Database className="w-5 h-5 stroke-[1.8]" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                                <span>Enviar a Plex (Carga API)</span>
                                <Badge variant="outline" showDot={false} className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 border-primary/30 text-primary bg-primary/5">
                                    Perfil Admin
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Transmite los conteos a la base de datos de Plex para la sucursal activa.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {createdBatchId ? (
                    /* Vista de Éxito al completar el envío */
                    <div className="my-4 space-y-4 animate-in fade-in-50 zoom-in-95 duration-200">
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <Check className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <h4 className="font-bold text-sm text-foreground">
                                ¡Lote #{createdBatchId} registrado en Plex!
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Los productos han sido insertados en <code className="font-mono text-foreground font-semibold">inventario_ws</code> con estado <span className="font-semibold text-emerald-600 dark:text-emerald-400">PENDIENTE</span>.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-surface-2/60 dark:bg-surface-3/50 border border-border/40 space-y-2 text-xs">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <span>Pasos siguientes en Plex:</span>
                            </div>
                            <ol className="list-decimal list-inside text-muted-foreground space-y-1 pl-1 text-[11px] leading-relaxed">
                                <li>Abrí el módulo <strong>Inventario → Captura y Ajuste de Stock</strong> en Plex.</li>
                                <li>Seleccioná la sesión de inventario activa.</li>
                                <li>Hacé clic en el botón <strong>"Carga desde API"</strong> para procesar el lote <strong>#{createdBatchId}</strong>.</li>
                            </ol>
                        </div>
                    </div>
                ) : (
                    /* Vista principal de Configuración y Resumen */
                    <div className="my-4 space-y-3">
                        {/* Estado del Servidor / IP */}
                        <div className="p-3.5 rounded-2xl bg-surface-2/60 dark:bg-surface-3/50 border border-border/40 flex flex-col gap-2.5 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                    <Server className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    <span>Servidor MySQL Plex:</span>
                                </span>
                                {isCheckingConn ? (
                                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                        <span>Comprobando IP...</span>
                                    </div>
                                ) : connStatus === 'connected' ? (
                                    <Badge variant="dot" color="emerald" size="compact" className="text-[11px] font-semibold">
                                        Conectado ({targetBranch.ip})
                                    </Badge>
                                ) : (
                                    <Badge variant="dot" color="red" size="compact" className="text-[11px] font-semibold">
                                        Sin Conexión ({targetBranch.ip})
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    <span>Sucursal Destino:</span>
                                </span>
                                <strong className="text-foreground font-semibold">{targetBranch.name}</strong>
                            </div>

                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    <span>Inventario:</span>
                                </span>
                                <strong className="text-foreground font-semibold max-w-[200px] truncate" title={inventoryTitle}>
                                    {inventoryTitle} {sectorOrLab ? `(${sectorOrLab})` : ''}
                                </strong>
                            </div>

                            <div className="h-px bg-border/40 my-0.5" />

                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <Package className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    <span>Total a Transmitir:</span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground text-sm">
                                        {totalUnits.toLocaleString('es-AR')} un.
                                    </span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="font-semibold text-primary text-sm">
                                        {totalSkus} {totalSkus === 1 ? 'SKU' : 'SKUs'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {connError && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="leading-snug">
                                    <strong>No se pudo conectar al servidor Plex:</strong>
                                    <p className="mt-0.5 text-[11px] opacity-90">{connError}</p>
                                </div>
                            </div>
                        )}

                        <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
                            Al confirmar, se enviará el lote a la base de datos Plex de <strong className="text-foreground">{targetBranch.name}</strong> ({targetBranch.ip}).
                        </p>
                    </div>
                )}

                <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-border/30">
                    {createdBatchId ? (
                        <Button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer w-full sm:w-auto"
                        >
                            Listo, Cerrar
                        </Button>
                    ) : (
                        <>
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={isSending}
                                    className="rounded-xl h-9 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-hover"
                                >
                                    Cancelar
                                </Button>
                            </DialogClose>

                            <Button
                                type="button"
                                onClick={handleConfirmSendToPlex}
                                disabled={isSending || activeItems.length === 0 || connStatus === 'error'}
                                className="rounded-xl h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Transmitiendo a Plex…</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Transmitir a Plex</span>
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

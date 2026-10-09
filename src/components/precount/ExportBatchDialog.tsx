
import React, { useState, useMemo } from 'react';
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
import {
    UploadCloud,
    FileText,
    Package,
    Layers,
    Store,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { preCountExportService } from '@/services/preCountExportService';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/services/db';
import { getDeviceId } from '@/services/preCountDB';

export interface ExportBatchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inventoryTitle: string;
    sectorOrLab: string;
    items?: Array<{
        id?: string;
        id_producto?: string;
        ean: string;
        productName?: string;
        quantity: number;
        cost?: number;
        laboratory?: string;
        rubro?: string;
        sector?: string;
    }>;
    sessionId?: string;
    branchName?: string;
    onExportSuccess?: () => void;
}

export function ExportBatchDialog({
    open,
    onOpenChange,
    inventoryTitle,
    sectorOrLab,
    items,
    sessionId,
    branchName: propBranchName,
    onExportSuccess,
}: ExportBatchDialogProps) {
    const { user } = useUser();
    const [isSending, setIsSending] = useState(false);

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

                // Perfil sucursal: exportación estrictamente individual por terminal
                const myDeviceId = (getDeviceId() || '').toLowerCase();
                const myDeviceName = (typeof window !== 'undefined' ? (localStorage.getItem('precount_device_name') || localStorage.getItem('precount_user_name') || '') : '').toLowerCase().trim();

                records = records.filter(rec => {
                    const recDevId = (rec.device_id || '').toLowerCase();
                    const recDevName = (rec.device_name || '').toLowerCase();
                    const recScannedBy = (rec.scanned_by || '').toLowerCase();

                    if (recDevId && (recDevId === myDeviceId || myDeviceId.includes(recDevId) || recDevId.includes(myDeviceId))) return true;
                    if (myDeviceName && recDevName && (recDevName === myDeviceName || recDevName.includes(myDeviceName) || myDeviceName.includes(recDevName))) return true;
                    if (!recDevId && !recDevName.includes('zebra') && !recScannedBy.includes('zebra')) return true;
                    return false;
                });

                // Map catalog info if available
                const productsMap = new Map<string, { lab?: string; rubro?: string; name?: string; id_producto?: string }>();
                if (effectiveSessionId) {
                    const sessionProducts = await db.precount_products.where('session_id').equals(effectiveSessionId).toArray();
                    sessionProducts.forEach(p => {
                        const idp = p.id_producto ? String(p.id_producto).trim() : undefined;
                        productsMap.set(p.ean, { lab: p.laboratory, rubro: p.rubro, name: p.name, id_producto: idp });
                        if (idp) {
                            productsMap.set(idp, { lab: p.laboratory, rubro: p.rubro, name: p.name, id_producto: idp });
                        }
                    });
                }

                return records.map(rec => {
                    const rawEan = String(rec.ean || '').trim();
                    const catInfo = productsMap.get(rawEan) || (rec.id_producto ? productsMap.get(rec.id_producto) : undefined);
                    let finalIdProd = (rec.id_producto || catInfo?.id_producto || '').trim();
                    if (!finalIdProd && rawEan) {
                        finalIdProd = rawEan;
                    }
                    return {
                        id: rec.id,
                        id_producto: finalIdProd || undefined,
                        ean: rec.ean,
                        productName: rec.product_name || catInfo?.name || `Producto ${rec.ean}`,
                        quantity: Number(rec.quantity) || 1,
                        laboratory: rec.laboratory || catInfo?.lab || 'SIN CLASIFICAR',
                        rubro: rec.rubro || catInfo?.rubro || 'Varios',
                        sector: rec.location_tag || rec.sector || sectorOrLab || 'General'
                    };
                });
            } catch (err) {
                console.error('[ExportBatchDialog] Error leyendo Dexie items:', err);
                return [];
            }
        },
        [open, effectiveSessionId, sectorOrLab]
    );

    const activeItems = useMemo(() => {
        if (items !== undefined) return items;
        return liveDbItems || [];
    }, [items, liveDbItems]);

    const totalUnits = activeItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const totalSkus = new Set(activeItems.map(it => it.ean)).size;
    const branchName = useMemo(() => {
        if (propBranchName && propBranchName.trim()) return propBranchName.trim();
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('plex_target_branch') || localStorage.getItem('precount_config_selected_branch');
            if (saved) return saved.replace(/\s*\([^)]*\)/, '').trim();
        }
        return user?.branchName || 'Sucursal';
    }, [propBranchName, user?.branchName]);

    const effectiveOperatorName = useMemo(() => {
        if (typeof window !== 'undefined') {
            const op = localStorage.getItem('precount_operator_name');
            if (op && op.trim()) return op.trim();
            const dev = localStorage.getItem('precount_device_name');
            if (dev && dev.trim() && dev !== 'Generic Device') return dev.trim();
        }
        return user?.name || user?.username || 'Operador';
    }, [user]);

    const handleConfirmSend = async () => {
        if (activeItems.length === 0) {
            toast.error('No hay productos contados para exportar');
            return;
        }

        setIsSending(true);
        try {
            const result = await preCountExportService.sendBatchToAdmin({
                branchName,
                inventoryTitle,
                sectorOrLab: sectorOrLab || 'General',
                items: activeItems,
                sessionId: effectiveSessionId || sessionId,
                userName: effectiveOperatorName
            });

            toast.success(
                '¡Conteo enviado a la Tabla de Administrador!',
                {
                    description: `Se sincronizaron ${totalUnits} un. (${totalSkus} SKUs) a nombre de "${effectiveOperatorName}". Archivo descargado: ${result.fileName}`
                }
            );

            onOpenChange(false);
            if (onExportSuccess) {
                onExportSuccess();
            }
        } catch (error: any) {
            console.error('Error al enviar lote:', error);
            toast.error('Error al enviar el lote', {
                description: error.message || 'Se descargó una copia local en tu equipo.'
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
                            <UploadCloud className="w-5 h-5 stroke-[1.8]" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                                Exportar Conteo a la Tabla Admin
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Publica tus productos contados en el catálogo maestro del Administrador.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Resumen del Lote en tarjetas estilizadas */}
                <div className="my-4 space-y-3">
                    <div className="p-3.5 rounded-2xl bg-surface-2/60 dark:bg-surface-3/50 border border-border/40 flex flex-col gap-2.5 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-muted-foreground/70" />
                                <span>Sucursal:</span>
                            </span>
                            <strong className="text-foreground font-semibold">{branchName}</strong>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-muted-foreground/70" />
                                <span>Inventario / Sector:</span>
                            </span>
                            <strong className="text-foreground font-semibold max-w-[200px] truncate" title={`${inventoryTitle} · ${sectorOrLab}`}>
                                {inventoryTitle} {sectorOrLab ? `(${sectorOrLab})` : ''}
                            </strong>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-muted-foreground/70" />
                                <span>Usuario / Colector:</span>
                            </span>
                            <strong className="text-foreground font-semibold text-primary">
                                {effectiveOperatorName}
                            </strong>
                        </div>

                        <div className="h-px bg-border/40 my-0.5" />

                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Package className="w-3.5 h-3.5 text-muted-foreground/70" />
                                <span>Total a Enviar:</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                    {totalUnits.toLocaleString('es-AR')} un.
                                </span>
                                <span className="text-muted-foreground">·</span>
                                <span className="font-semibold text-primary">
                                    {totalSkus} {totalSkus === 1 ? 'SKU' : 'SKUs'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
                        Al exportar, los conteos se integrarán inmediatamente en la <strong className="text-foreground">tabla de Administrador</strong> identificando tus unidades y se generará una copia <strong className="text-foreground">.txt de colector</strong> de respaldo.
                    </p>
                </div>

                <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-border/30">
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
                        onClick={handleConfirmSend}
                        disabled={isSending || activeItems.length === 0}
                        className="rounded-xl h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Enviando lote…</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>Exportar a Tabla Admin</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

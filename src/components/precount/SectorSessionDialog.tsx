import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { FARMAPLUS_SECTORS, normalizeSectorCode, parseSectorCode, isSectorCode } from '@/constants/farmaplusSectors';
import { updateLocationStatus, claimOrValidateLocation, closeLocationWithSync } from '@/services/preCountDB';
import { emitDeviceTelemetry, getDeviceId } from '@/services/deviceTelemetry';
import { db } from '@/services/db';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { notify as toast } from '@/lib/notifications';

interface SectorSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId?: string;
    activeSector: string | null;
    onSectorChange: (sector: string | null) => void;
}

export function SectorSessionDialog({
    open,
    onOpenChange,
    sessionId,
    activeSector,
    onSectorChange
}: SectorSessionDialogProps) {
    const [selectedPrefix, setSelectedPrefix] = useState<string>("ESP");
    const [sectorNumber, setSectorNumber] = useState<string>("1");
    const [manualCode, setManualCode] = useState<string>("");
    const [mode, setMode] = useState<'open_new' | 'current'>(activeSector ? 'current' : 'open_new');
    const [sectorStats, setSectorStats] = useState<{ products: number; units: number }>({ products: 0, units: 0 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Ajustar modo al abrir
    useEffect(() => {
        if (open) {
            setMode(activeSector ? 'current' : 'open_new');
            setManualCode("");
        }
    }, [open, activeSector]);

    // Cargar estadísticas del sector activo si hay uno abierto
    useEffect(() => {
        if (!open || !sessionId || !activeSector) {
            setSectorStats({ products: 0, units: 0 });
            return;
        }

        let isMounted = true;
        const loadStats = async () => {
            try {
                const items = await db.items
                    .where('session_id')
                    .equals(sessionId)
                    .filter(i => (i.location_tag || (i as any).sector || '').toUpperCase() === activeSector.toUpperCase())
                    .toArray();

                if (!isMounted) return;

                const skus = new Set(items.map(i => i.ean)).size;
                const units = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
                setSectorStats({ products: skus, units });
            } catch (err) {
                console.error("Error cargando estadísticas del sector:", err);
            }
        };

        loadStats();
        return () => {
            isMounted = false;
        };
    }, [open, sessionId, activeSector]);

    // Acción: Abrir un nuevo sector
    const handleOpenSector = async () => {
        let finalCode = "";

        if (manualCode.trim()) {
            const normalized = normalizeSectorCode(manualCode.trim());
            if (!normalized) {
                toast.warning("Código no válido", "Ingresá un código como ESP-01, GON-02, HELA-01, etc.");
                return;
            }
            finalCode = normalized;
        } else {
            const num = parseInt(sectorNumber, 10);
            if (isNaN(num) || num < 1) {
                toast.warning("Número no válido", "Ingresá un número de mueble válido mayor a 0.");
                return;
            }
            const padded = num < 10 ? `0${num}` : String(num);
            finalCode = `${selectedPrefix}-${padded}`;
        }

        if (!sessionId) {
            toast.error("Error", "No hay una sesión de inventario activa.");
            return;
        }

        setIsSubmitting(true);
        try {
            const opName = localStorage.getItem('precount_operator_name') || undefined;
            const devName = localStorage.getItem('precount_device_name') || undefined;
            const devId = getDeviceId();

            // Validar concurrencia atómica en Supabase
            try {
                const claimRes = await claimOrValidateLocation(
                    sessionId,
                    finalCode,
                    opName,
                    devName,
                    devId
                );

                if (!claimRes.success) {
                    if (claimRes.code === 'ALREADY_CLOSED') {
                        toast.warning("Sector cerrado", claimRes.message || "Este sector ya fue contabilizado y cerrado.");
                        setIsSubmitting(false);
                        return;
                    }
                    if (claimRes.code === 'OCCUPIED') {
                        toast.error("Sector ocupado", claimRes.message || "El sector ya está siendo operado por otro usuario.");
                        setIsSubmitting(false);
                        return;
                    }
                }
            } catch (rpcErr) {
                console.debug('[SectorSessionDialog] Fallback updateLocationStatus:', rpcErr);
                await updateLocationStatus(sessionId, finalCode, 'open');
            }

            // Calcular mapa acumulado de todos los sectores de esta sesión
            const allItems = await db.items.where('session_id').equals(sessionId).toArray();
            const locMap: Record<string, number> = {};
            let totalUnits = 0;
            const skusSet = new Set<string>();
            allItems.forEach((i: any) => {
                const loc = (i.location_tag || i.sector || '').toUpperCase();
                const qty = Number(i.quantity) || 1;
                if (loc) {
                    locMap[loc] = (locMap[loc] || 0) + qty;
                }
                totalUnits += qty;
                if (i.ean) skusSet.add(i.ean);
            });

            onSectorChange(finalCode);

            // Emitir telemetría de inmediato a toda la red / monitor
            emitDeviceTelemetry({
                sessionId,
                currentLocation: finalCode,
            }).catch(() => {});

            toast.success("Sector Abierto", `Se habilitó el conteo para: ${finalCode}`);
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error al abrir sector:", err);
            toast.error("Error", "No se pudo abrir el sector.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Acción: Cerrar el sector activo
    const handleCloseSector = async () => {
        if (!sessionId || !activeSector) return;

        setIsSubmitting(true);
        try {
            const opName = localStorage.getItem('precount_operator_name') || undefined;
            const devName = localStorage.getItem('precount_device_name') || undefined;
            const devId = getDeviceId();

            // Calcular unidades y mapa completo de sectores acumulados
            const allItems = await db.items.where('session_id').equals(sessionId).toArray();
            const locMap: Record<string, number> = {};
            let totalUnits = 0;
            const skusSet = new Set<string>();
            allItems.forEach((i: any) => {
                const loc = (i.location_tag || i.sector || '').toUpperCase();
                const qty = Number(i.quantity) || 1;
                if (loc) {
                    locMap[loc] = (locMap[loc] || 0) + qty;
                }
                totalUnits += qty;
                if (i.ean) skusSet.add(i.ean);
            });

            const closedUnits = locMap[activeSector.toUpperCase()] || sectorStats.units || 0;

            // Cerrar atómicamente en Supabase
            try {
                await closeLocationWithSync(
                    sessionId,
                    activeSector,
                    opName,
                    devName,
                    devId,
                    closedUnits
                );
            } catch (rpcErr) {
                console.debug('[SectorSessionDialog] Fallback updateLocationStatus:', rpcErr);
                await updateLocationStatus(sessionId, activeSector, 'closed');
            }

            // Sincronizar automáticamente los items contabilizados de este sector con precount_items en Supabase
            const sectorItems = allItems.filter((i: any) => 
                (i.location_tag || i.sector || '').toUpperCase() === activeSector.toUpperCase()
            );

            if (sectorItems.length > 0) {
                try {
                    const rows = sectorItems.map((item: any) => ({
                        id: item.id || uuidv4(),
                        session_id: sessionId,
                        ean: item.ean,
                        id_producto: item.id_producto || null,
                        product_name: item.product_name || `Producto ${item.ean}`,
                        quantity: Number(item.quantity) || 1,
                        scanned_at: item.scanned_at || new Date().toISOString(),
                        device_id: devId,
                        device_name: devName || opName || 'Operador',
                        location_tag: activeSector
                    }));
                    await supabase.from('precount_items').upsert(rows, { onConflict: 'id' });
                } catch (pushErr) {
                    console.warn('[SectorSessionDialog] Error al sincronizar items del sector cerrado:', pushErr);
                }
            }

            onSectorChange(null);

            // Emitir telemetría inmediatamente con currentLocation = null
            // para que el sector cerrado pase a completado con sus unidades reales en el monitor
            emitDeviceTelemetry({
                sessionId,
                currentLocation: null,
            }).catch(() => {});

            toast.success("Sector Cerrado", `Se finalizó el conteo en ${activeSector} (${closedUnits} un. contadas).`);
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error al cerrar sector:", err);
            toast.error("Error", "No se pudo cerrar el sector.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentDef = activeSector ? parseSectorCode(activeSector) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-6 bg-surface-1 border border-border/60 shadow-xl rounded-2xl font-sans">
                {mode === 'current' && activeSector ? (
                    <div className="font-sans">
                        <DialogHeader className="space-y-1.5 pb-2">
                            <DialogTitle className="text-base font-semibold text-foreground font-sans">
                                Sector en Conteo
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-sans">
                                Este sector se encuentra abierto y registrando productos.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Recuadro resumen del sector actual */}
                        <div className="my-3 px-3.5 py-3 rounded-xl border border-border/70 bg-surface-2/30 flex flex-col gap-2.5 font-sans">
                            <div>
                                <h4 className="text-sm font-semibold text-foreground font-sans">
                                    {activeSector}
                                    {currentDef?.sectorDef && (
                                        <span className="text-xs font-normal text-muted-foreground ml-2 font-sans">
                                            · {currentDef.sectorDef.name}
                                        </span>
                                    )}
                                </h4>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50 font-sans">
                                <div>
                                    Productos: <strong className="text-foreground font-medium font-sans">{sectorStats.products} SKUs</strong>
                                </div>
                                <div className="h-3 w-px bg-border/50" />
                                <div>
                                    Total unidades: <strong className="text-foreground font-medium font-sans">{sectorStats.units} un.</strong>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setMode('open_new')}
                                className="w-full sm:w-auto text-xs font-sans"
                                disabled={isSubmitting}
                            >
                                Cambiar a otro sector
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleCloseSector}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto text-xs font-sans"
                            >
                                Cerrar Sector
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="font-sans">
                        <DialogHeader className="space-y-1.5 pb-2">
                            <DialogTitle className="text-base font-semibold text-foreground font-sans">
                                Abrir Sector
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-sans">
                                Seleccioná o ingresá el mueble de la farmacia que vas a contabilizar.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 my-4 font-sans">
                            {/* Selector por tipo de mueble y número */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-foreground font-sans">
                                    Mueble / Sector
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <Select value={selectedPrefix} onValueChange={setSelectedPrefix}>
                                            <SelectTrigger
                                                placeholder={FARMAPLUS_SECTORS.find(s => s.prefix === selectedPrefix)?.name || selectedPrefix}
                                                className="w-full h-9 text-xs font-sans"
                                            />
                                            <SelectContent className="max-h-[260px]">
                                                {FARMAPLUS_SECTORS.map((sec, idx) => (
                                                    <SelectItem key={sec.prefix} index={idx} value={sec.prefix} className="text-xs font-sans">
                                                        {`${sec.prefix} · ${sec.name}`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-1">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min="1"
                                                max="99"
                                                value={sectorNumber}
                                                onChange={(e) => setSectorNumber(e.target.value)}
                                                placeholder="1"
                                                className="h-9 text-xs pl-3 pr-7 font-sans font-medium text-foreground bg-surface-1 border-border/80 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground pointer-events-none font-sans select-none">
                                                N°
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground font-sans">
                                    Código resultante: <strong className="text-foreground font-sans font-semibold">{selectedPrefix}-{parseInt(sectorNumber || '1', 10) < 10 ? `0${parseInt(sectorNumber || '1', 10)}` : sectorNumber}</strong>
                                </p>
                            </div>

                            {/* O entrada manual / escaneo rápido */}
                            <div className="relative py-1">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border/40" />
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase font-sans">
                                    <span className="bg-surface-1 px-2 text-muted-foreground font-medium font-sans">
                                        o escaneá / tipeá el código
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Input
                                    placeholder="Ej: ESP-01, HELA-02, GON-01..."
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleOpenSector();
                                        }
                                    }}
                                    className="h-9 text-xs font-sans text-foreground placeholder:text-muted-foreground/60"
                                />
                            </div>
                        </div>

                        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                            {activeSector && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setMode('current')}
                                    className="w-full sm:w-auto text-xs font-sans"
                                    disabled={isSubmitting}
                                >
                                    Volver a sector actual
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="w-full sm:w-auto text-xs font-sans"
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleOpenSector}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto text-xs font-sans"
                            >
                                Abrir Sector
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

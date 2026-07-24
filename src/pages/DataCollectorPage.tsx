import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useZebraScanner, zebraAudio } from '@/hooks/useZebraScanner';
import { collectorOfflineService, LocalInventoryItem } from '@/services/collectorOfflineService';
import { BRANCHES } from '@/constants/branches';
import { getLaboratoriesForBranch } from '@/services/preCountDB';
import { 
    Barcode, 
    Zap, 
    Calculator, 
    RefreshCw, 
    CloudDownload, 
    CloudUpload, 
    CheckCircle2, 
    AlertTriangle,
    Wifi,
    WifiOff,
    Search,
    Plus,
    Minus,
    PackageCheck,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

export default function DataCollectorPage() {
    // Branch & Lab Selection
    const [selectedBranch, setSelectedBranch] = useState<string>('SALADILLO');
    const [laboratories, setLaboratories] = useState<string[]>([]);
    const [selectedLab, setSelectedLab] = useState<string>('');
    const [isLoadingLabs, setIsLoadingLabs] = useState(false);

    // Scanning Mode: 'unit' (+1 per scan) or 'manual' (focus quantity for keypad entry)
    const [scanMode, setScanMode] = useState<'unit' | 'manual'>('unit');

    // Inputs
    const [eanInput, setEanInput] = useState('');
    const [quantityInput, setQuantityInput] = useState<string>('1');

    // Data State
    const [items, setItems] = useState<LocalInventoryItem[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [lastScannedItem, setLastScannedItem] = useState<LocalInventoryItem | null>(null);

    const eanInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);

    // Monitor Network Status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Load Laboratories when branch changes
    useEffect(() => {
        async function fetchLabs() {
            if (!selectedBranch) return;
            setIsLoadingLabs(true);
            try {
                const rawLabs = await getLaboratoriesForBranch(selectedBranch);
                const labNames: string[] = (rawLabs || []).map((l: any) => String(typeof l === 'string' ? l : l.name));
                const uniqueLabs: string[] = Array.from(new Set<string>(labNames)).filter((name): name is string => Boolean(name));
                setLaboratories(uniqueLabs);
                if (uniqueLabs.length > 0) {
                    setSelectedLab(uniqueLabs[0]);
                }
            } catch (err) {
                console.error("Error loading labs:", err);
            } finally {
                setIsLoadingLabs(false);
            }
        }
        fetchLabs();
    }, [selectedBranch]);

    // Load Local Items when Lab changes
    useEffect(() => {
        if (selectedBranch && selectedLab) {
            loadLocalData();
        }
    }, [selectedBranch, selectedLab]);

    const loadLocalData = async () => {
        if (!selectedBranch || !selectedLab) return;
        const localItems = await collectorOfflineService.getLocalLabItems(selectedBranch, selectedLab);
        setItems(localItems);
    };

    // Download Master Data for Selected Lab
    const handleDownloadMasterData = async () => {
        if (!selectedBranch || !selectedLab) {
            toast.error("Seleccioná una sucursal y laboratorio primero");
            return;
        }

        setIsDownloading(true);
        try {
            const res = await collectorOfflineService.downloadLabData(selectedBranch, selectedLab);
            if (res.success) {
                toast.success(`Datos descargados: ${res.itemCount} productos listos para offline`);
                zebraAudio.playSuccess();
                await loadLocalData();
            } else {
                toast.error(res.message || "Error al descargar datos del laboratorio");
                zebraAudio.playError();
            }
        } catch (err) {
            toast.error("No se pudo conectar con el servidor para descargar");
            zebraAudio.playError();
        } finally {
            setIsDownloading(false);
        }
    };

    // Process Barcode Scan (from Hardware Scanner or Manual Input)
    const handleProcessBarcode = async (barcode: string, customQty?: number) => {
        const cleanEan = barcode.trim();
        if (!cleanEan) return;

        if (!selectedBranch || !selectedLab) {
            toast.error("Por favor seleccioná laboratorio primero");
            zebraAudio.playError();
            return;
        }

        const qtyToApply = customQty !== undefined ? customQty : Number(quantityInput) || 1;
        const mode = scanMode === 'unit' ? 'add' : 'set';

        try {
            const result = await collectorOfflineService.recordScan({
                branchName: selectedBranch,
                laboratory: selectedLab,
                ean: cleanEan,
                quantity: qtyToApply,
                mode
            });

            if (result.success) {
                zebraAudio.playSuccess();
                setLastScannedItem(result.item);
                setEanInput('');

                if (scanMode === 'unit') {
                    setQuantityInput('1');
                }

                await loadLocalData();

                if (result.isNew) {
                    toast.info(`Nuevo producto agregado: ${result.item.name}`);
                }
            }
        } catch (err) {
            console.error("Scan error:", err);
            zebraAudio.playError();
            toast.error("Error al registrar el producto");
        }
    };

    // Hardware Zebra Scanner Listener
    useZebraScanner({
        onScan: (barcode) => {
            if (scanMode === 'unit') {
                handleProcessBarcode(barcode);
            } else {
                // Modo Cantidad: Cargamos EAN y enfocamos input de cantidad para escribir en teclado numérico
                setEanInput(barcode);
                if (qtyInputRef.current) {
                    qtyInputRef.current.focus();
                    qtyInputRef.current.select();
                }
                zebraAudio.playModeChange();
            }
        },
        enabled: true
    });

    // Manual Form Submit
    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (eanInput) {
            handleProcessBarcode(eanInput);
        }
    };

    // Sync Pending Scans to Supabase
    const handleSync = async () => {
        if (!selectedBranch || !selectedLab) return;
        setIsSyncing(true);
        try {
            const res = await collectorOfflineService.syncPendingScans(selectedBranch, selectedLab);
            if (res.success) {
                toast.success(`Sincronizados ${res.syncedCount} productos con la nube.`);
                zebraAudio.playSuccess();
                await loadLocalData();
            } else {
                toast.error(res.message || "Error durante la sincronización");
                zebraAudio.playError();
            }
        } catch (err) {
            toast.error("No se pudo conectar a la nube para sincronizar");
            zebraAudio.playError();
        } finally {
            setIsSyncing(false);
        }
    };

    // Unsynced Items Count
    const unsyncedCount = useMemo(() => {
        return items.filter(it => !it.isSynced).length;
    }, [items]);

    const controlledCount = useMemo(() => {
        return items.filter(it => it.status === 'controlled').length;
    }, [items]);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto border-x border-border shadow-xl">
            {/* Header Optimizado Zebra TC22 */}
            <header className="p-3 bg-card border-b border-border sticky top-0 z-20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                        <Barcode className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base leading-tight">Colector Zebra TC22</h1>
                        <p className="text-xs text-muted-foreground">Perfil Conteo de Stock</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {isOnline ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs px-2 py-0.5 flex items-center gap-1">
                            <Wifi className="w-3 h-3" /> Online
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-xs px-2 py-0.5 flex items-center gap-1">
                            <WifiOff className="w-3 h-3" /> Offline
                        </Badge>
                    )}
                </div>
            </header>

            {/* Configuración de Sucursal y Laboratorio */}
            <div className="p-3 bg-muted/40 border-b border-border space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase block mb-1">Sucursal</label>
                        <select 
                            value={selectedBranch} 
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {BRANCHES.map(b => (
                                <option key={b.name} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase block mb-1">Laboratorio</label>
                        <select 
                            value={selectedLab} 
                            onChange={(e) => setSelectedLab(e.target.value)}
                            disabled={isLoadingLabs || laboratories.length === 0}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        >
                            {laboratories.map(lab => (
                                <option key={lab} value={lab}>{lab}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Botones de Descarga Offline & Sincronización */}
                <div className="flex items-center gap-2 pt-1">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleDownloadMasterData}
                        disabled={isDownloading || !selectedLab}
                        className="flex-1 text-xs h-8 gap-1.5"
                    >
                        <CloudDownload className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                        {isDownloading ? "Cargando..." : "Bajar Lab Offline"}
                    </Button>

                    <Button 
                        size="sm" 
                        variant={unsyncedCount > 0 ? "default" : "secondary"}
                        onClick={handleSync}
                        disabled={isSyncing || unsyncedCount === 0 || !isOnline}
                        className="flex-1 text-xs h-8 gap-1.5 font-bold"
                    >
                        <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? "Sincronizando..." : `Subir (${unsyncedCount})`}
                    </Button>
                </div>
            </div>

            {/* Selector de Modo de Escaneo (Unidad vs Cantidad) */}
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                    <button
                        type="button"
                        onClick={() => {
                            setScanMode('unit');
                            setQuantityInput('1');
                            zebraAudio.playModeChange();
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                            scanMode === 'unit' 
                                ? 'bg-primary text-primary-foreground shadow-sm' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Zap className="w-4 h-4" />
                        <span>Modo Unidad (+1)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setScanMode('manual');
                            zebraAudio.playModeChange();
                            if (qtyInputRef.current) qtyInputRef.current.focus();
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                            scanMode === 'manual' 
                                ? 'bg-primary text-primary-foreground shadow-sm' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Calculator className="w-4 h-4" />
                        <span>Modo Cantidad</span>
                    </button>
                </div>

                {/* Formulario / Input Barcode */}
                <form onSubmit={handleManualSubmit} className="space-y-2 bg-card p-3 rounded-xl border border-border shadow-sm">
                    <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                            Código EAN / Láser Zebra
                        </label>
                        <div className="relative">
                            <Input
                                ref={eanInputRef}
                                type="text"
                                placeholder="Escanear láser o teclear EAN..."
                                value={eanInput}
                                onChange={(e) => setEanInput(e.target.value)}
                                className="h-11 text-base font-mono font-bold pr-10"
                            />
                            <Search className="w-4 h-4 absolute right-3 top-3.5 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>

                    {scanMode === 'manual' && (
                        <div>
                            <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase block mb-1">
                                Cantidad a ingresar (Teclado TC22)
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    ref={qtyInputRef}
                                    type="number"
                                    min="0"
                                    value={quantityInput}
                                    onChange={(e) => setQuantityInput(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="h-11 text-lg font-bold text-center border-amber-500/50 bg-amber-500/5"
                                />
                                <Button type="submit" size="lg" className="h-11 px-5 font-bold">
                                    Cargar
                                </Button>
                            </div>
                        </div>
                    )}
                </form>

                {/* Último Producto Escaneado */}
                {lastScannedItem && (
                    <Card className="bg-emerald-500/10 border-emerald-500/30">
                        <CardContent className="p-3 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                                    Último registrado
                                </span>
                                <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-1">{lastScannedItem.name}</h3>
                                <p className="text-xs font-mono text-muted-foreground">EAN: {lastScannedItem.ean}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block">
                                    {lastScannedItem.countedQuantity} u.
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Lista de Ítems Contados */}
                <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                        <span>Items Contados ({items.length})</span>
                        <span>{controlledCount} controlados</span>
                    </div>

                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                        {items.length === 0 ? (
                            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                                Dispará el láser de la Zebra TC22 para comenzar a contar...
                            </div>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="p-2.5 bg-card border border-border rounded-lg flex items-center justify-between gap-2 shadow-2xs">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-bold text-xs line-clamp-1">{item.name}</span>
                                            {!item.isSynced && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Pendiente de subir" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                            <span>{item.ean}</span>
                                            <span>•</span>
                                            <span>Sis: {item.systemQuantity}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7"
                                            onClick={() => handleProcessBarcode(item.ean, -1)}
                                        >
                                            <Minus className="w-3 h-3" />
                                        </Button>

                                        <span className="font-bold text-sm w-7 text-center">
                                            {item.countedQuantity}
                                        </span>

                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7"
                                            onClick={() => handleProcessBarcode(item.ean, 1)}
                                        >
                                            <Plus className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Footer de Resumen y Estado Zebra */}
            <footer className="p-3 bg-card border-t border-border sticky bottom-0 z-20 flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-emerald-500" />
                    <span>Total: {items.reduce((acc, curr) => acc + curr.countedQuantity, 0)} unidades</span>
                </div>

                {unsyncedCount > 0 ? (
                    <span className="text-amber-500 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {unsyncedCount} sin subir
                    </span>
                ) : (
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Todo al día
                    </span>
                )}
            </footer>
        </div>
    );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Zap, 
    LayersTwo01 as Layers, 
    RefreshCcw01 as RefreshCcw, 
    Server01 as Server, 
    Scan as Barcode, 
    CheckCircle, 
    AlertCircle, 
    Copy01 as Copy, 
    Upload01 as Upload, 
    Download01 as Download, 
    SearchLg as Search, 
    Trash01 as Trash2, 
    Plus, 
    Minus, 
    ArrowLeft,
    ClockRewind as History,
    ShieldTick as ShieldCheck,
    File02 as FileText
} from '@untitledui/icons';
import { QRCodeSVG } from 'qrcode.react';
import { 
    isTauriEnvironment, 
    testPlexConnection, 
    fetchPlexStockDirect, 
    exportInventoryToPlexDirect, 
    convertPlexToMasterCatalog,
    PlexProduct 
} from '@/services/plexTauriBridge';
import { 
    createSession, 
    MasterCatalogItem, 
    PreCountSession 
} from '@/services/preCountDB';
import { toast } from 'sonner';

interface ScannedCountItem {
    id_producto: string;
    ean: string;
    name: string;
    systemStock: number;
    countedQuantity: number;
    lastUpdated: Date;
}

export default function PreCountAlpha() {
    const navigate = useNavigate();

    // Environment & Connection State
    const [isTauri, setIsTauri] = useState<boolean>(false);
    const [plexHost, setPlexHost] = useState<string>(() => localStorage.getItem('plex_alpha_host') || '192.168.1.50');
    const [plexPort, setPlexPort] = useState<number>(() => Number(localStorage.getItem('plex_alpha_port')) || 3144);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
    const [connectionMessage, setConnectionMessage] = useState<string>('');

    // Import / Session State
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importLogs, setImportLogs] = useState<string[]>([]);
    const [currentSession, setCurrentSession] = useState<PreCountSession | null>(null);
    const [masterCatalog, setMasterCatalog] = useState<MasterCatalogItem[]>([]);
    const [catalogMap, setCatalogMap] = useState<Map<string, MasterCatalogItem>>(new Map());

    // Scanner & Counting State
    const [barcodeInput, setBarcodeInput] = useState<string>('');
    const [countedItems, setCountedItems] = useState<ScannedCountItem[]>([]);
    const [lastScannedItem, setLastScannedItem] = useState<ScannedCountItem | null>(null);
    const [showQrModal, setShowQrModal] = useState<boolean>(false);
    const [searchFilter, setSearchFilter] = useState<string>('');
    const [isExporting, setIsExporting] = useState<boolean>(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Initial environment check
    useEffect(() => {
        setIsTauri(isTauriEnvironment());
    }, []);

    // Save host / port changes to localStorage
    useEffect(() => {
        localStorage.setItem('plex_alpha_host', plexHost);
        localStorage.setItem('plex_alpha_port', plexPort.toString());
    }, [plexHost, plexPort]);

    // Keep scanner input focused
    useEffect(() => {
        if (currentSession) {
            inputRef.current?.focus();
        }
    }, [currentSession]);

    // Test connection to Plex server
    const handleTestConnection = async () => {
        setConnectionStatus('testing');
        setConnectionMessage('Probando socket TCP con servidor Plex...');
        
        try {
            const res = await testPlexConnection(plexHost, plexPort);
            if (res.success) {
                setConnectionStatus('connected');
                setConnectionMessage(res.message);
                toast.success('Conexión con Plex confirmada (VPN OK)');
            } else {
                setConnectionStatus('error');
                setConnectionMessage(res.message);
                toast.error(res.message);
            }
        } catch (err: any) {
            setConnectionStatus('error');
            setConnectionMessage(err?.message || 'Error de conexión');
            toast.error('Error al probar conexión');
        }
    };

    // Import full stock catalog directly from Plex via TCP Socket
    const handleImportFromPlex = async () => {
        setIsImporting(true);
        setImportLogs([]);

        const addLog = (msg: string) => {
            setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        };

        try {
            addLog(`Iniciando conexión directa TCP a ${plexHost}:${plexPort}...`);
            
            const fetchResult = await fetchPlexStockDirect(plexHost, plexPort, (log) => {
                addLog(log);
            });

            if (!fetchResult.success || fetchResult.products.length === 0) {
                throw new Error(fetchResult.message || 'No se recibieron productos de Plex');
            }

            addLog(`Transformando ${fetchResult.total_products} productos a catálogo de inventario...`);
            const convertedCatalog = convertPlexToMasterCatalog(fetchResult.products);
            setMasterCatalog(convertedCatalog);

            // Create lookup map (ean -> item and id_producto -> item)
            const map = new Map<string, MasterCatalogItem>();
            for (const item of convertedCatalog) {
                map.set(item.ean, item);
                map.set(item.id_producto, item);
                if (item.eans) {
                    for (const e of item.eans) {
                        map.set(e, item);
                    }
                }
            }
            setCatalogMap(map);

            // Generate 6-digit PIN session
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            addLog(`Creando sesión de inventario con PIN: ${pin}...`);

            const newSession = await createSession(
                `Plex Direct Sync (${new Date().toLocaleDateString()})`,
                undefined,
                convertedCatalog,
                pin,
                'sucursal'
            );

            setCurrentSession(newSession);
            addLog(`¡Sesión #${pin} creada exitosamente con ${fetchResult.total_products} productos!`);
            toast.success(`Catálogo importado: ${fetchResult.total_products} productos listos para contar`);

        } catch (err: any) {
            addLog(`ERROR: ${err?.message || err}`);
            toast.error(err?.message || 'Fallo en la importación de Plex');
        } finally {
            setIsImporting(false);
        }
    };

    // Handle barcode scan
    const handleProcessBarcode = (code: string) => {
        const cleanCode = code.trim();
        if (!cleanCode) return;

        // Lookup product in catalog
        const match = catalogMap.get(cleanCode);

        let targetId = cleanCode;
        let targetName = 'Producto no catalogado';
        let targetStock = 0;
        let targetEan = cleanCode;

        if (match) {
            targetId = match.id_producto;
            targetName = match.name;
            targetStock = match.systemStock;
            targetEan = match.ean;
        }

        setCountedItems(prev => {
            const index = prev.findIndex(item => item.id_producto === targetId || item.ean === cleanCode);
            if (index >= 0) {
                const updated = [...prev];
                const item = updated[index];
                const newQty = item.countedQuantity + 1;
                const updatedItem = {
                    ...item,
                    countedQuantity: newQty,
                    lastUpdated: new Date()
                };
                updated[index] = updatedItem;
                setLastScannedItem(updatedItem);
                return updated;
            } else {
                const newItem: ScannedCountItem = {
                    id_producto: targetId,
                    ean: targetEan,
                    name: targetName,
                    systemStock: targetStock,
                    countedQuantity: 1,
                    lastUpdated: new Date()
                };
                setLastScannedItem(newItem);
                return [newItem, ...prev];
            }
        });

        setBarcodeInput('');
    };

    // Modify quantity
    const handleUpdateQuantity = (id_producto: string, delta: number) => {
        setCountedItems(prev => prev.map(item => {
            if (item.id_producto === id_producto) {
                const newQty = Math.max(0, item.countedQuantity + delta);
                return { ...item, countedQuantity: newQty, lastUpdated: new Date() };
            }
            return item;
        }).filter(item => item.countedQuantity > 0));
    };

    // Delete item
    const handleDeleteItem = (id_producto: string) => {
        setCountedItems(prev => prev.filter(item => item.id_producto !== id_producto));
        if (lastScannedItem?.id_producto === id_producto) {
            setLastScannedItem(null);
        }
    };

    // Export counted records back to Plex TCP
    const handleExportToPlex = async () => {
        if (countedItems.length === 0) {
            toast.error('No hay productos contados para exportar');
            return;
        }

        setIsExporting(true);
        try {
            const exportRecords = countedItems.map(item => ({
                idproducto: item.id_producto,
                codebar: item.ean,
                cantidad: item.countedQuantity
            }));

            const res = await exportInventoryToPlexDirect(plexHost, plexPort, exportRecords);
            toast.success(res || 'Inventario exportado a Plex con éxito');
        } catch (err: any) {
            toast.error(err?.message || 'Error al exportar inventario a Plex');
        } finally {
            setIsExporting(false);
        }
    };

    // Filtered items
    const filteredItems = useMemo(() => {
        if (!searchFilter.trim()) return countedItems;
        const q = searchFilter.toLowerCase();
        return countedItems.filter(item => 
            item.name.toLowerCase().includes(q) || 
            item.ean.includes(q) || 
            item.id_producto.includes(q)
        );
    }, [countedItems, searchFilter]);

    const totalCountedUnits = countedItems.reduce((sum, item) => sum + item.countedQuantity, 0);
    const totalUniqueProducts = countedItems.length;

    return (
        <PageLayout>
            <div className="space-y-6">

                {/* Top Banner & Mode */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-transparent p-6 rounded-2xl border border-blue-500/20 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate('/stock')}
                            className="rounded-xl hover:bg-blue-500/10"
                        >
                            <ArrowLeft className="w-5 h-5 text-foreground" />
                        </Button>
                        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-500">
                            <Zap className="w-8 h-8 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-foreground">Colector de Datos</h1>
                                <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    Alpha Preview · Plex Sync
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Conexión directa por socket TCP con Plex (sin archivos Excel) y recuento instantáneo.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium">
                            {isTauri ? (
                                <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    Tauri Desktop (TCP Habilitado)
                                </span>
                            ) : (
                                <span className="text-amber-500 font-semibold">
                                    Modo Web (Requiere Tauri Desktop para TCP)
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Configuration & Plex Import Section */}
                {!currentSession ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Server Connection Config Card */}
                        <Card className="lg:col-span-5 p-6 space-y-4 border-blue-500/20 shadow-lg bg-card/60 backdrop-blur-md">
                            <div className="flex items-center gap-2 font-semibold text-lg text-foreground">
                                <Server className="w-5 h-5 text-blue-500" />
                                <h3>Parámetros de Servidor Plex</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Ingresa la IP de la sucursal o VPN donde corre el servidor de Plex (puerto por defecto 3144).
                            </p>

                            <div className="space-y-3 pt-2">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">IP / Host Servidor</label>
                                    <Input 
                                        value={plexHost} 
                                        onChange={(e) => setPlexHost(e.target.value)} 
                                        placeholder="192.168.1.50"
                                        className="mt-1 font-mono text-sm bg-muted/30"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Puerto TCP</label>
                                    <Input 
                                        type="number" 
                                        value={plexPort} 
                                        onChange={(e) => setPlexPort(Number(e.target.value))} 
                                        placeholder="3144"
                                        className="mt-1 font-mono text-sm bg-muted/30"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={handleTestConnection}
                                    disabled={connectionStatus === 'testing'}
                                    className="flex-1 rounded-xl"
                                >
                                    <RefreshCcw className={`w-4 h-4 mr-2 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
                                    Probar Conexión
                                </Button>
                            </div>

                            {connectionMessage && (
                                <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                                    connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                    connectionStatus === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                                    'bg-muted/40 text-muted-foreground'
                                }`}>
                                    {connectionStatus === 'connected' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                                    <span>{connectionMessage}</span>
                                </div>
                            )}
                        </Card>

                        {/* Direct Stock Import Card */}
                        <Card className="lg:col-span-7 p-6 space-y-4 border-blue-500/20 shadow-lg bg-card/60 backdrop-blur-md flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-semibold text-lg text-foreground">
                                        <Zap className="w-5 h-5 text-blue-500" />
                                        <h3>Iniciar Inventario Instantáneo</h3>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 font-mono rounded">
                                        1-Click Sync
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Al presionar el botón, la aplicación se conecta directamente a Plex por socket TCP, descarga todos los productos con sus códigos de barra EAN y crea la sesión con el PIN de 6 dígitos automáticamente.
                                </p>
                            </div>

                            {/* Live Import Logs */}
                            {importLogs.length > 0 && (
                                <div className="bg-black/50 p-4 rounded-xl font-mono text-xs text-emerald-400 space-y-1 max-h-40 overflow-y-auto border border-emerald-500/20">
                                    {importLogs.map((log, idx) => (
                                        <div key={idx}>{log}</div>
                                    ))}
                                </div>
                            )}

                            <Button 
                                size="lg"
                                onClick={handleImportFromPlex}
                                disabled={isImporting}
                                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-600/20"
                            >
                                {isImporting ? (
                                    <div className="flex items-center gap-3">
                                        <RefreshCcw className="w-5 h-5 animate-spin" />
                                        <span>Importando Catálogo desde Plex...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-5 h-5" />
                                        <span>Conectar e Importar Stock desde Plex</span>
                                    </div>
                                )}
                            </Button>
                        </Card>

                    </div>
                ) : (

                    /* Active Inventory Session View */
                    <div className="space-y-6">

                        {/* PIN & Live Session Header */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            
                            {/* PIN Card */}
                            <Card className="md:col-span-4 p-5 bg-gradient-to-br from-blue-600/15 via-indigo-600/10 to-card border-blue-500/30 flex items-center justify-between">
                                <div>
                                    <span className="text-xs uppercase font-semibold text-blue-400 tracking-wider">PIN de Sincronización</span>
                                    <div className="text-3xl font-black font-mono tracking-widest text-foreground mt-1">
                                        {currentSession.sync_pin || '------'}
                                    </div>
                                    <span className="text-xs text-muted-foreground">Compartir con Zebras / Scanners</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => {
                                            if (currentSession.sync_pin) {
                                                navigator.clipboard.writeText(currentSession.sync_pin);
                                                toast.success('PIN copiado al portapapeles');
                                            }
                                        }}
                                        className="rounded-xl border-blue-500/30 hover:bg-blue-500/10"
                                    >
                                        <Copy className="w-4 h-4 text-blue-400" />
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => setShowQrModal(true)}
                                        className="rounded-xl border-blue-500/30 hover:bg-blue-500/10"
                                    >
                                        <Barcode className="w-4 h-4 text-blue-400" />
                                    </Button>
                                </div>
                            </Card>

                            {/* Totals Summary */}
                            <Card className="md:col-span-4 p-5 bg-card/60 border-border flex items-center justify-around">
                                <div className="text-center">
                                    <span className="text-xs text-muted-foreground">Productos Contados</span>
                                    <div className="text-2xl font-bold text-foreground mt-1">{totalUniqueProducts}</div>
                                </div>
                                <div className="h-8 w-px bg-border" />
                                <div className="text-center">
                                    <span className="text-xs text-muted-foreground">Unidades Totales</span>
                                    <div className="text-2xl font-bold text-blue-500 mt-1">{totalCountedUnits}</div>
                                </div>
                            </Card>

                            {/* Action Buttons */}
                            <Card className="md:col-span-4 p-5 bg-card/60 border-border flex items-center justify-end gap-3">
                                <Button 
                                    variant="outline"
                                    onClick={() => {
                                        if (confirm('¿Deseas cerrar esta sesión de inventario?')) {
                                            setCurrentSession(null);
                                            setCountedItems([]);
                                            setLastScannedItem(null);
                                        }
                                    }}
                                    className="rounded-xl text-xs"
                                >
                                    Nueva Sesión
                                </Button>
                                <Button 
                                    onClick={handleExportToPlex}
                                    disabled={isExporting || countedItems.length === 0}
                                    className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md"
                                >
                                    <Upload className="w-4 h-4 mr-1.5" />
                                    Exportar a Plex
                                </Button>
                            </Card>
                        </div>

                        {/* Live Scanner Barcode Input */}
                        <Card className="p-4 bg-muted/20 border-blue-500/30">
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleProcessBarcode(barcodeInput);
                                }}
                                className="flex gap-3"
                            >
                                <div className="relative flex-1">
                                    <Barcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                                    <Input 
                                        ref={inputRef}
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        placeholder="Escanear código de barra (EAN) o código de producto..."
                                        className="pl-11 h-12 text-base font-mono bg-background border-blue-500/30 focus-visible:ring-blue-500 rounded-xl"
                                        autoFocus
                                    />
                                </div>
                                <Button type="submit" className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-500">
                                    Contar (+1)
                                </Button>
                            </form>
                        </Card>

                        {/* Last Scanned Item Banner */}
                        <AnimatePresence>
                            {lastScannedItem && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                                            <CheckCircle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">{lastScannedItem.name}</h4>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                ID: {lastScannedItem.id_producto} | EAN: {lastScannedItem.ean} | Stock Plex: {lastScannedItem.systemStock}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-muted-foreground">Cantidad Contada</span>
                                        <div className="text-xl font-black text-emerald-400 font-mono">
                                            {lastScannedItem.countedQuantity}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Items Table */}
                        <Card className="border-border shadow-sm overflow-hidden bg-card">
                            <div className="p-4 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/20">
                                <div className="relative w-full md:w-80">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input 
                                        value={searchFilter}
                                        onChange={(e) => setSearchFilter(e.target.value)}
                                        placeholder="Filtrar registros..."
                                        className="pl-9 h-9 text-xs bg-background rounded-lg"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    Mostrando {filteredItems.length} de {countedItems.length} productos contados
                                </span>
                            </div>

                            {filteredItems.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground space-y-2">
                                    <Barcode className="w-10 h-10 mx-auto opacity-30" />
                                    <p className="text-sm">Aún no se han escaneado productos en esta sesión.</p>
                                    <p className="text-xs text-muted-foreground/60">Utiliza el lector de código de barras o ingresa el código manualmente arriba.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border overflow-x-auto">
                                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <div className="col-span-6">Producto / EAN</div>
                                        <div className="col-span-2 text-center">Stock Plex</div>
                                        <div className="col-span-2 text-center">Físico Contado</div>
                                        <div className="col-span-2 text-right">Acciones</div>
                                    </div>

                                    {filteredItems.map(item => {
                                        const diff = item.countedQuantity - item.systemStock;
                                        return (
                                            <div key={item.id_producto} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-muted/20 transition-colors text-sm">
                                                <div className="col-span-6">
                                                    <div className="font-medium text-foreground">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        ID: {item.id_producto} · EAN: {item.ean}
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-center font-mono text-muted-foreground">
                                                    {item.systemStock}
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <span className="font-mono font-bold text-foreground text-base">
                                                        {item.countedQuantity}
                                                    </span>
                                                    {diff !== 0 && (
                                                        <span className={`text-xs ml-1.5 font-mono ${diff > 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                                                            ({diff > 0 ? `+${diff}` : diff})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="col-span-2 flex items-center justify-end gap-1.5">
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={() => handleUpdateQuantity(item.id_producto, -1)}
                                                        className="h-8 w-8 rounded-lg hover:bg-muted"
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={() => handleUpdateQuantity(item.id_producto, 1)}
                                                        className="h-8 w-8 rounded-lg hover:bg-muted"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={() => handleDeleteItem(item.id_producto)}
                                                        className="h-8 w-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                    </div>
                )}

                {/* QR Code Modal for Mobile / Zebra sync */}
                {showQrModal && currentSession && (
                    <div 
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowQrModal(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-card p-8 rounded-3xl border border-border max-w-sm w-full text-center space-y-6 shadow-2xl"
                        >
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-foreground">Conectar Colector / Zebra</h3>
                                <p className="text-xs text-muted-foreground">
                                    Escaneá este código QR desde la app móvil o ingresá el PIN.
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
                                <QRCodeSVG 
                                    value={JSON.stringify({ pin: currentSession.sync_pin, host: plexHost, port: plexPort })} 
                                    size={200} 
                                />
                            </div>

                            <div className="text-4xl font-black font-mono tracking-widest text-blue-500">
                                {currentSession.sync_pin}
                            </div>

                            <Button 
                                variant="outline" 
                                onClick={() => setShowQrModal(false)}
                                className="w-full rounded-xl"
                            >
                                Cerrar
                            </Button>
                        </motion.div>
                    </div>
                )}

            </div>
        </PageLayout>
    );
}

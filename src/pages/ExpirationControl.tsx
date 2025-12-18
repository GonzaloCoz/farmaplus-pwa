import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Camera,
    Plus,
    CheckCircle2,
    Clock,
    Trash2,
    Calendar,
    Package,
    AlertTriangle,
    FileText,
    Bell,
    BellRing,
    ArrowRight,
    Play,
    History,
    Wifi,
    WifiOff,
    Search,
    Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { BarcodeScanner } from '@/components/BarcodeScanner';
// import { ProductSearchInput } from '@/components/ProductSearchInput'; // Replaced
import { SmartProductSearch } from '@/components/SmartProductSearch';
import { useExpirationControl } from '@/hooks/useExpirationControl';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { notify } from '@/lib/notifications';
import { getProductByEAN } from '@/services/preCountDB';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { FabMenu } from '@/components/FabMenu';
import jsPDF from 'jspdf';
import { BatchInfo, ExpirationItem } from '@/services/expirationDB';
import { ExpirationEntryModal } from '@/components/ExpirationEntryModal';

type Step = 'config' | 'counting';

export default function ExpirationControl() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('config');
    const [sector, setSector] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);

    // Scan/Product State
    const [manualEAN, setManualEAN] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<{ name: string, ean: string } | null>(null);

    // Batch Management State
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [currentBatches, setCurrentBatches] = useState<BatchInfo[]>([]);

    // Finish Modal State
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [responsibleName, setResponsibleName] = useState('');

    const {
        session,
        items,
        totalProducts,
        totalUnits,
        isLoading,
        startSession,
        addItem,
        deleteItem,
        finishSession,
        availableSessions,
        resumeSession,
        deleteSession
    } = useExpirationControl();

    const { isOnline } = useOfflineSync();

    // 1. Configurar Sesión
    const handleStartSession = async () => {
        if (!sector.trim()) {
            notify.error("Error", 'Ingresa el nombre del sector');
            return;
        }
        await startSession(sector.trim());
        setStep('counting');
    };

    // 2. Escaneo / Búsqueda
    const handleBarcodeScan = async (code: string) => {
        await processProductSelection(code);
        setScannerOpen(false);
    };

    const handleEditItem = (item: ExpirationItem) => {
        setManualEAN(item.ean);
        setSelectedProduct({ name: item.productName, ean: item.ean });
        setCurrentBatches(item.batches);
        setIsBatchModalOpen(true);
    };

    const handleProductSelect = async (product: any) => {
        await processProductSelection(product.ean, product.name);
    };

    const processProductSelection = async (ean: string, name?: string) => {
        setManualEAN(ean);
        let productName = name;

        if (!productName) {
            const found = await getProductByEAN(ean);
            productName = found ? found.name : `Producto ${ean}`;
        }

        setSelectedProduct({ name: productName, ean });

        // Cargar lotes existentes si el producto ya está en la lista
        const existingItem = items.find(i => i.ean === ean);
        if (existingItem) {
            setCurrentBatches([...existingItem.batches]);
            notify.info("Información", "Producto ya contado. Editando lotes existentes.");
        } else {
            setCurrentBatches([]);
        }

        // Abrir modal inmediatamente
        setIsBatchModalOpen(true);
    };



    const handleFinishClick = () => {
        setIsFinishModalOpen(true);
    };

    const handleSaveAndFinish = async () => {
        if (!responsibleName.trim()) {
            notify.error("Error", "Por favor ingresa el nombre del responsable");
            return;
        }

        const reportData = {
            id: crypto.randomUUID(),
            sector: session?.sector || sector,
            date: new Date().toISOString(),
            responsible: responsibleName,
            items: items,
            stats: {
                totalProducts,
                totalUnits
            }
        };

        const existingReports = JSON.parse(localStorage.getItem('expiration-reports') || '[]');
        localStorage.setItem('expiration-reports', JSON.stringify([reportData, ...existingReports]));

        await finishSession();
        notify.success("Operación exitosa", "Control guardado exitosamente");
        navigate('/reports');
    };

    const formatExpiryDate = (date: string) => {
        if (!date) return "";
        // If format is YYYY-MM (Legacy data from type="month")
        if (date.match(/^\d{4}-\d{2}$/)) {
            const [year, month] = date.split('-');
            return `${month}/${year.slice(2)}`;
        }
        return date;
    };

    // Export PDF (Original Function)
    const handleExportPDF = () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay datos');
            return;
        }

        const doc = new jsPDF();
        let y = 20;
        doc.setFontSize(16);
        doc.text(`Control de Vencimientos: ${session?.sector}`, 10, y);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 10, y + 6);

        y += 15;

        items.forEach(item => {
            if (y > 270) { doc.addPage(); y = 20; }

            doc.setFont("helvetica", "bold");
            doc.text(`${item.productName} (EAN: ${item.ean})`, 10, y);
            doc.text(`Total: ${item.totalQuantity}`, 180, y, { align: 'right' });
            y += 6;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            // Headers
            doc.text("Lote", 15, y);
            doc.text("Vencimiento", 80, y);
            doc.text("Cantidad", 150, y);
            y += 5;

            item.batches.forEach(batch => {
                doc.text(batch.batchNumber, 15, y);
                doc.text(formatExpiryDate(batch.expirationDate), 80, y);
                doc.text(batch.quantity.toString(), 150, y);
                y += 5;
            });

            y += 5; // Spacing between items
        });

        doc.save(`Vencimientos_${session?.sector}.pdf`);
        notify.success("Operación exitosa", "PDF Generado");
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <AnimatePresence mode="wait">
                {step === 'config' ? (
                    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                        {/* Online Status Indicator */}
                        <div className="flex justify-end">
                            {isOnline ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm">
                                    <Wifi className="w-4 h-4" />
                                    <span className="font-medium">En línea</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm">
                                    <WifiOff className="w-4 h-4" />
                                    <span className="font-medium">Sin conexión</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* Nueva Sesión */}
                            <Card className="border-muted/50 shadow-lg overflow-hidden relative group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                <CardContent className="p-6 md:p-8 space-y-6">
                                    <div className="flex items-center gap-4 text-primary">
                                        <div className="p-3 bg-primary/10 rounded-xl">
                                            <Plus className="w-6 h-6" />
                                        </div>
                                        <h2 className="text-xl font-semibold">Nueva Sesión</h2>
                                    </div>

                                    <p className="text-sm text-muted-foreground">
                                        Genera un reporte de control de fechas de vencimiento para un sector o estantería.
                                    </p>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-muted-foreground ml-1">
                                                Nombre del Sector
                                            </label>
                                            <Input
                                                value={sector}
                                                onChange={(e) => setSector(e.target.value)}
                                                placeholder="Ej: Estantería A1"
                                                className="h-12 text-lg bg-muted/30 border-muted-foreground/20 focus:border-primary transition-all"
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
                                            />
                                        </div>

                                        <Button
                                            className="w-full h-12 text-lg font-medium shadow-md hover:shadow-lg transition-all"
                                            onClick={handleStartSession}
                                            disabled={!sector.trim() || isLoading}
                                        >
                                            {isLoading ? 'Iniciando...' : 'Comenzar Control'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Sesiones Abiertas */}
                            <Card className="border-muted/50 shadow-lg h-full">
                                <CardHeader className="pb-4 border-b border-border/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-secondary rounded-lg text-secondary-foreground">
                                            <History className="w-5 h-5" />
                                        </div>
                                        <CardTitle className="text-lg">Sesiones Abiertas</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {availableSessions.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <p>No hay sesiones activas</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
                                            {availableSessions.map((s) => (
                                                <div key={s.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                                                    <div className="space-y-1">
                                                        <h3 className="font-medium text-lg leading-none group-hover:text-primary transition-colors">
                                                            {s.sector}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Calendar className="w-3 h-3" />
                                                            <span>
                                                                {format(new Date(s.startTime), "d MMM yyyy, HH:mm", { locale: es })}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                                            <span className="bg-primary/5 px-2 py-0.5 rounded text-primary font-medium">
                                                                {s.totalProducts || 0} prod.
                                                            </span>
                                                            <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground font-medium">
                                                                {s.totalUnits || 0} unid.
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => deleteSession(s.id)}
                                                            title="Eliminar sesión"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="gap-2 shadow-sm"
                                                            onClick={() => {
                                                                resumeSession(s);
                                                                setStep('counting'); // Assuming ExpirationControl also uses 'counting' step, checking line 237 implies step switch logic is managed or I need to explicitly set it? 
                                                                // Wait, ExpirationControl has setStep. I should check if resumeSession in hook handles step or if I need to do it here.
                                                                // In PreCount I did setStep('counting'). Detailed check: ExpirationControl.tsx uses 'step' state.
                                                            }}
                                                        >
                                                            Retomar
                                                            <ArrowRight className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                ) : (
                    <>
                        <motion.div
                            key="counting"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto"
                        >
                            {/* 1. Enhanced Status Bar - Full Width Single Row */}
                            <Card className="min-h-[120px] flex flex-col justify-center px-6 sm:px-8 bg-gradient-to-br from-secondary/40 to-secondary/20 border-muted/50 shadow-sm">
                                <div className="flex items-center justify-between gap-4 w-full">
                                    {/* Left: Sector Label + Name */}
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap">Sector</span>
                                        <span className="font-bold text-foreground text-lg sm:text-xl truncate">{session?.sector}</span>
                                    </div>

                                    <div className="h-10 sm:h-12 w-px bg-border/40 flex-shrink-0" />

                                    {/* Center: Counters - Horizontal Layout */}
                                    <div className="flex items-center gap-8 sm:gap-12 flex-1 justify-center">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap">Productos</span>
                                            <div className="text-2xl sm:text-3xl font-bold text-primary">
                                                <AnimatedCounter value={totalProducts} digits={4} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap">Unidades</span>
                                            <div className="text-2xl sm:text-3xl font-bold text-foreground">
                                                <AnimatedCounter value={totalUnits} digits={4} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Status Icons */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div
                                            className={`p-2 rounded-full ${isOnline ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}
                                            title={isOnline ? "En línea" : "Sin conexión"}
                                        >
                                            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* 2. Compact Hero Input Section */}
                            <Card className="p-2 sm:p-3 shadow-md border-primary/20 bg-card/80 backdrop-blur-sm relative z-50">
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1 relative z-20">
                                            <SmartProductSearch
                                                onSelect={(p) => processProductSelection(p.ean, p.name)}
                                                autoFocus={true}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                    {/* Removed ProductSearchInput as it is integrated now */}
                                </div>
                            </Card>

                            {/* 3. Dense List */}
                            <div className="space-y-2 relative z-10">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Registros ({items.length})
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {items.length === 0 ? (
                                            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg border-dashed bg-muted/20">
                                                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p>No hay productos registrados aún</p>
                                            </div>
                                        ) : (
                                            items.map((item, index) => (
                                                <motion.div
                                                    key={item.id}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2 }}
                                                    layout
                                                >
                                                    <Card className="h-full relative overflow-hidden group border-muted/60 shadow-sm hover:shadow-md transition-all">
                                                        {/* Selection indicator on hover */}
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

                                                        <div className="p-3 pl-4 flex flex-col h-full gap-2">
                                                            {/* Header */}
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="font-medium text-sm leading-tight line-clamp-2 text-foreground/90" title={item.productName}>
                                                                    {item.productName}
                                                                </h4>
                                                                <div className="text-xs font-bold bg-secondary/50 px-1.5 py-0.5 rounded text-foreground/70 text-right flex-shrink-0">
                                                                    #{items.length - index}
                                                                </div>
                                                            </div>

                                                            {/* EAN */}
                                                            <div>
                                                                <Badge variant="outline" className="text-[10px] h-5 font-mono text-muted-foreground border-border/50 px-1.5 font-normal">
                                                                    {item.ean}
                                                                </Badge>
                                                            </div>

                                                            {/* Batches (Compact) */}
                                                            <div className="flex flex-wrap gap-1.5 mt-2 content-start min-h-[1.5rem]">
                                                                {item.batches.slice(0, 3).map((batch, idx) => (
                                                                    <div key={idx} className="inline-flex items-center gap-2 text-xs bg-secondary/50 rounded px-2 py-1 border border-secondary-foreground/10">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal text-muted-foreground border-border/50">
                                                                                {formatExpiryDate(batch.expirationDate)}
                                                                            </Badge>
                                                                            <span className="font-bold tabular-nums text-[10px]">x{batch.quantity}</span>
                                                                        </div>

                                                                        {batch.reminderMonths && (
                                                                            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground border-l pl-1.5 border-border/50" title={`${batch.reminderMonths} meses de alerta`}>
                                                                                <Clock className="w-2.5 h-2.5" />
                                                                                <span className="sr-only sm:not-sr-only">{batch.reminderMonths}m</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {item.batches.length > 3 && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                                                                        +{item.batches.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Edit Action Overlay (Entire Card acts as edit trigger usually, but let's add specific button if needed) */}
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="secondary"
                                                                    size="icon"
                                                                    className="h-6 w-6 shadow-sm mr-1"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditItem(item); // Needs implementation or reuse existing
                                                                    }}
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="icon"
                                                                    className="h-6 w-6 shadow-sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        deleteItem(item.id);
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>

                                                            {/* Footer: Totals & Actions */}
                                                            <div className="flex items-center justify-between pt-2 mt-auto border-t border-border/30">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-xl font-bold tracking-tight text-foreground">
                                                                        {item.totalQuantity}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                                        total
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                                        onClick={() => deleteItem(item.id)}
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </motion.div>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <FabMenu
                                actions={[
                                    {
                                        label: "Finalizar",
                                        icon: <CheckCircle2 className="w-5 h-5" />,
                                        onClick: handleFinishClick,
                                        variant: 'default',
                                        color: 'bg-primary text-primary-foreground'
                                    },
                                    {
                                        label: "Exportar PDF",
                                        icon: <FileText className="w-5 h-5" />,
                                        onClick: handleExportPDF,
                                        variant: 'secondary'
                                    }
                                ]}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* New Batch Modal - REDESIGNED */}
            <ExpirationEntryModal
                open={isBatchModalOpen}
                onOpenChange={(open) => {
                    setIsBatchModalOpen(open);
                    if (!open) {
                        setManualEAN('');
                        setSelectedProduct(null);
                        setCurrentBatches([]);
                    }
                }}
                productName={selectedProduct?.name || ''}
                ean={selectedProduct?.ean || ''}
                initialBatches={currentBatches}
                onSave={async (batches) => {
                    if (selectedProduct) {
                        await addItem(selectedProduct.ean, selectedProduct.name, batches);
                        setIsBatchModalOpen(false);
                        setSelectedProduct(null);
                        setManualEAN('');
                        setCurrentBatches([]);
                        setTimeout(() => {
                            document.getElementById('smart-search-input')?.focus();
                        }, 50);
                    }
                }}
            />

            {/* Finish Confirmation Dialog */}
            <Dialog open={isFinishModalOpen} onOpenChange={setIsFinishModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Finalizar Control de Vencimientos</DialogTitle>
                        <DialogDescription>
                            Por favor confirma los datos para guardar el reporte.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Fecha</Label>
                                <div className="font-medium">{new Date().toLocaleDateString()}</div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Hora</Label>
                                <div className="font-medium">{new Date().toLocaleTimeString()}</div>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="responsible" className="mb-2 block">Responsable del Control *</Label>
                            <Input
                                id="responsible"
                                value={responsibleName}
                                onChange={(e) => setResponsibleName(e.target.value)}
                                placeholder="Nombre y Apellido"
                                autoFocus
                            />
                        </div>

                        <div className="bg-primary/5 p-4 rounded-lg flex justify-between items-center">
                            <span className="text-sm font-medium">Total Unidades Contadas</span>
                            <span className="text-2xl font-bold text-primary">{totalUnits}</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFinishModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveAndFinish}>Guardar y Finalizar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BarcodeScanner
                open={scannerOpen}
                onOpenChange={setScannerOpen}
                onScan={handleBarcodeScan}
            />
        </div >
    );
}

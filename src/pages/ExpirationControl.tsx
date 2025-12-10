import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
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
    FileText
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { ProductSearchInput } from '@/components/ProductSearchInput';
import { useExpirationControl } from '@/hooks/useExpirationControl';
import { getProductByEAN } from '@/services/preCountDB'; // Reuse product info service
import { toast } from 'sonner';
import { CounterAnimation } from '@/components/CounterAnimation';
import { FabMenu } from '@/components/FabMenu';
import { BatchInfo, ExpirationItem } from '@/services/expirationDB';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

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

    // New Batch Inputs
    const [newBatchNumber, setNewBatchNumber] = useState('');
    const [newBatchExpiry, setNewBatchExpiry] = useState('');
    const [newBatchQuantity, setNewBatchQuantity] = useState('');

    // Finish Modal State
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [responsibleName, setResponsibleName] = useState('');

    const {
        session,
        items,
        totalProducts,
        totalUnits,
        startSession,
        addItem,
        deleteItem,
        finishSession
    } = useExpirationControl();

    // 1. Configurar Sesión
    const handleStartSession = async () => {
        if (!sector.trim()) {
            toast.error('Ingresa el nombre del sector');
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
            toast.info("Producto ya contado. Editando lotes existentes.");
        } else {
            setCurrentBatches([]);
        }

        // Abrir modal inmediatamente
        setIsBatchModalOpen(true);
    };

    // 3. Gestión de Lotes
    const handleAddBatch = () => {
        if (!newBatchNumber.trim()) return toast.error("Falta número de lote");
        if (!newBatchExpiry.trim()) return toast.error("Falta fecha de vencimiento");
        if (!newBatchQuantity || Number(newBatchQuantity) <= 0) return toast.error("Cantidad inválida");

        const newBatch: BatchInfo = {
            batchNumber: newBatchNumber.toUpperCase(),
            expirationDate: newBatchExpiry,
            quantity: Number(newBatchQuantity)
        };

        setCurrentBatches([...currentBatches, newBatch]);

        // Reset inputs
        setNewBatchNumber('');
        setNewBatchQuantity('');
        // Keep expiry? Usually varies. Reset for safety.
        setNewBatchExpiry('');
    };

    const handleRemoveBatch = (index: number) => {
        const updated = [...currentBatches];
        updated.splice(index, 1);
        setCurrentBatches(updated);
    };

    const handleSaveProduct = async () => {
        if (!selectedProduct) return;
        if (currentBatches.length === 0) {
            toast.warning("Debes agregar al menos un lote");
            return;
        }

        await addItem(selectedProduct.ean, selectedProduct.name, currentBatches);

        // Close and reset
        setIsBatchModalOpen(false);
        setSelectedProduct(null);
        setManualEAN('');
        setCurrentBatches([]);
        setNewBatchNumber('');
        setNewBatchExpiry('');
        setNewBatchQuantity('');
    };

    const handleFinishClick = () => {
        setIsFinishModalOpen(true);
    };

    const handleSaveAndFinish = async () => {
        if (!responsibleName.trim()) {
            toast.error("Por favor ingresa el nombre del responsable");
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
        toast.success("Control guardado exitosamente");
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

    // Export PDF (Similar structure to PreCount but with Batches)
    const handleExportPDF = () => {
        if (items.length === 0) return toast.error('No hay datos');

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
        toast.success("PDF Generado");
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/stock')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Control de Vencimientos</h1>
                    {session && <p className="text-muted-foreground text-sm">Sector: {session.sector}</p>}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {step === 'config' ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Configurar Sesión</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Nombre del Sector</label>
                                    <Input
                                        value={sector}
                                        onChange={(e) => setSector(e.target.value)}
                                        placeholder="Ej: Estantería A1"
                                        autoFocus
                                    />
                                </div>
                                <Button onClick={handleStartSession} className="w-full" size="lg">
                                    Comenzar Control
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 bg-primary/5 border-primary/20">
                                <div className="text-center">
                                    <span className="text-sm text-muted-foreground">Productos</span>
                                    <div className="text-3xl font-bold text-primary">
                                        <CounterAnimation value={totalProducts} />
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 bg-secondary/5 border-secondary/20">
                                <div className="text-center">
                                    <span className="text-sm text-muted-foreground">Unidades Totales</span>
                                    <div className="text-3xl font-bold text-foreground">
                                        <CounterAnimation value={totalUnits} />
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Input Action */}
                        <Card className="p-6">
                            <div className="space-y-4">
                                <Button
                                    size="lg"
                                    className="w-full"
                                    onClick={() => setScannerOpen(true)}
                                >
                                    <Camera className="mr-2 h-5 w-5" />
                                    Escanear Producto
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">O buscar manualmente</span>
                                    </div>
                                </div>

                                <ProductSearchInput
                                    onSelect={handleProductSelect}
                                    placeholder="Buscar por nombre o EAN..."
                                />
                            </div>
                        </Card>

                        {/* List */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg">Registros ({items.length})</h3>
                            {items.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                                    <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p>No hay productos registrados aún</p>
                                </div>
                            ) : (
                                items.map((item) => (
                                    <Card key={item.id} className="p-4 group relative overflow-hidden">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium text-base">{item.productName}</h4>
                                                <p className="text-xs text-muted-foreground mb-2">EAN: {item.ean}</p>

                                                <div className="flex flex-wrap gap-2">
                                                    {item.batches.map((batch, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-xs font-normal">
                                                            <Clock className="w-3 h-3 mr-1 opacity-50" />
                                                            {formatExpiryDate(batch.expirationDate)}
                                                            <span className="mx-1 text-muted-foreground">|</span>
                                                            Lote: {batch.batchNumber}
                                                            <span className="mx-1 text-muted-foreground">|</span>
                                                            <strong>x{batch.quantity}</strong>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold">{item.totalQuantity}</div>
                                                <span className="text-xs text-muted-foreground">Total</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur rounded-lg p-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:text-blue-500"
                                                onClick={() => processProductSelection(item.ean, item.productName)}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:text-destructive"
                                                onClick={() => deleteItem(item.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))
                            )}
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
                )}
            </AnimatePresence>

            {/* Batch Modal */}
            <Dialog open={isBatchModalOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsBatchModalOpen(false);
                    setManualEAN('');
                    setSelectedProduct(null);
                    setCurrentBatches([]); // Discard changes if closed without saving
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Gestión de Vencimientos</DialogTitle>
                        <DialogDescription>
                            {selectedProduct?.name} <br />
                            <span className="text-xs">EAN: {selectedProduct?.ean}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* New Batch Input Row */}
                        <div className="p-3 bg-muted/30 rounded-lg space-y-3 border">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium mb-1 block">Nro. Lote</label>
                                    <Input
                                        value={newBatchNumber}
                                        onChange={(e) => setNewBatchNumber(e.target.value.toUpperCase())}
                                        placeholder="Ej: A123"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium mb-1 block">Vencimiento</label>
                                    <Input
                                        type="text"
                                        value={newBatchExpiry}
                                        onChange={(e) => {
                                            const input = e.target.value;
                                            // Allow backspace/deletion seamlessly
                                            if (input.length < newBatchExpiry.length) {
                                                setNewBatchExpiry(input);
                                                return;
                                            }

                                            let v = input.replace(/\D/g, '');

                                            // Month Validation (01-12)
                                            if (v.length >= 2) {
                                                const month = parseInt(v.slice(0, 2));
                                                if (month === 0 || month > 12) {
                                                    toast.error("Mes inválido (01-12)");
                                                    // Don't update state to invalid month part if we want to block
                                                    // But for UX flow, generally better to let them type but show error, or block.
                                                    // Blocking 3rd char if month is invalid:
                                                    v = v.slice(0, 1);
                                                }
                                            }

                                            if (v.length >= 2) {
                                                v = v.slice(0, 2) + '/' + v.slice(2, 4);
                                            }

                                            if (v.length > 5) v = v.slice(0, 5);
                                            setNewBatchExpiry(v);
                                        }}
                                        placeholder="MM/AA"
                                        maxLength={5}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium mb-1 block">Cantidad</label>
                                    <Input
                                        type="number"
                                        value={newBatchQuantity}
                                        onChange={(e) => setNewBatchQuantity(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <Button onClick={handleAddBatch} size="default" variant="secondary">
                                    <Plus className="w-4 h-4 lg:mr-2" />
                                    <span className="hidden lg:inline">Agregar</span>
                                </Button>
                            </div>
                        </div>

                        {/* List of batches to be added */}
                        <div className="max-h-[200px] overflow-y-auto space-y-2">
                            {currentBatches.length === 0 ? (
                                <p className="text-sm text-center text-muted-foreground py-4">
                                    No hay lotes cargados para este producto.
                                </p>
                            ) : (
                                currentBatches.map((batch, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-card border rounded shadow-sm">
                                        <div className="text-sm">
                                            <span className="font-mono font-bold bg-muted px-1 rounded">{batch.batchNumber}</span>
                                            <span className="mx-2 text-muted-foreground">•</span>
                                            <span>{formatExpiryDate(batch.expirationDate)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold">x{batch.quantity}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveBatch(idx)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:justify-between gap-2">
                        <div className="text-sm text-muted-foreground self-center">
                            Total Unidades: {currentBatches.reduce((acc, b) => acc + b.quantity, 0)}
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none"
                                onClick={() => setIsBatchModalOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 sm:flex-none"
                                onClick={handleSaveProduct}
                                disabled={currentBatches.length === 0}
                            >
                                Guardar Todo
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
        </div>
    );
}

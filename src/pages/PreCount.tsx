import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    Scanner as Barcode,
    Magnifer as Search,
    TrashBinMinimalistic as Trash2,
    Diskette as Save,
    Upload,
    AltArrowLeft as ArrowLeft,
    AddCircle as Plus,
    Restart as History,
    Play,
    Calendar,
    AltArrowRight as ArrowRight,
    Camera,
    CheckCircle,
    Widget as Wifi,
    CloseCircle as WifiOff,
    Widget as Package,
    Document as FileText,
    Restart as RotateCcw,
    Bolt as Zap,
    Forbidden as ZapOff
} from '@solar-icons/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { SmartProductSearch } from '@/components/SmartProductSearch';
import { PreCountList } from '@/components/PreCountList';
import { usePreCount } from '@/hooks/usePreCount';
import { Product, getProductByEAN, addProducts } from '@/services/productService';
import { notify } from '@/lib/notifications';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { enhancedProductCache } from '@/services/enhancedProductCache';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useHaptic } from '@/hooks/useHaptic';
import { playSound } from '@/utils/soundUtils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    NumberField,
    NumberFieldDecrement,
    NumberFieldIncrement,
    NumberFieldInput,
} from '@/components/ui/number-field';
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPopup,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Form } from '@/components/ui/form';

type Step = 'config' | 'counting';

export default function PreCount() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('config');
    const [sector, setSector] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [manualEAN, setManualEAN] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const lastScanTimeRef = useRef<number>(0);
    const [highSpeedMode, setHighSpeedMode] = useState(false);
    const [isNegativeMode, setIsNegativeMode] = useState(false);
    const [deviceName, setDeviceName] = useState(() => localStorage.getItem('precount_device_name') || '');
    const { trigger } = useHaptic();
    const [showFinishDialog, setShowFinishDialog] = useState(false);
    const [finishPassword, setFinishPassword] = useState('');
    const [finishPasswordError, setFinishPasswordError] = useState('');

    const {
        items,
        session,
        totalProducts,
        totalUnits,
        isLoading,
        startSession,
        addItem,
        updateItem,
        removeItem,
        finishSession,
        availableSessions, // Added for new config view
        deleteSession,    // Added for new config view
        resumeSession,    // Added for new config view
        errorCount,
        registerError,
    } = usePreCount();

    const isOnline = true; // Always online for cloud version

    // Paso 1: Configuración
    const handleStartSession = async () => {
        if (!sector.trim()) {
            notify.error("Error", 'Por favor, ingresa el nombre del sector');
            return;
        }

        // Save device name to localStorage
        if (deviceName.trim()) {
            localStorage.setItem('precount_device_name', deviceName.trim());
        }

        await startSession(sector.trim());
        setStep('counting');
    };

    // Manejar escaneo de código de barras
    const handleBarcodeScan = async (code: string) => {
        try {
            console.log('Barcode scanned (Hardware):', code);
            lastScanTimeRef.current = Date.now();

            // Check enhanced cache first (much faster)
            const cached = await enhancedProductCache.get(code);
            let productToUse: any = null;

            if (cached) {
                productToUse = {
                    ean: code,
                    name: cached.name,
                    cost: cached.cost,
                    salePrice: cached.salePrice,
                    stock: cached.stock,
                    category: cached.category,
                    laboratory: cached.laboratory,
                    id_producto: cached.id_producto
                };
            } else {
                // Not in cache, fetch from database
                const product = await getProductByEAN(code);
                if (product) {
                    productToUse = product;
                }
            }

            if (productToUse) {
                setSelectedProduct(productToUse);
                setManualEAN(code);

                if (highSpeedMode) {
                    // Fast flow: Add immediately with 1 (or -1 in negative mode)
                    const qtyToAdd = isNegativeMode ? -1 : 1;
                    await addItem(code, productToUse.name, qtyToAdd, productToUse.id_producto);
                    setManualEAN('');
                    setSelectedProduct(null);
                    trigger('success');
                    playSound('success');
                } else {
                    notify.success("Operación exitosa", `Producto encontrado: ${productToUse.name}`);
                    trigger('success');
                    // Focus quantity input for manual adjustment
                    setTimeout(() => {
                        const qtyInput = document.getElementById('quantity-input') as HTMLInputElement;
                        if (qtyInput) {
                            qtyInput.focus();
                            qtyInput.select();
                        }
                    }, 100);
                }
            } else {
                setManualEAN(code);
                notify.warning("Advertencia", 'Producto no encontrado en la base de datos', {
                    description: 'Puedes agregarlo manualmente',
                });
                registerError();
                trigger('warning');
                playSound('error');
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            notify.error("Error", 'Error al buscar el producto');
        }
    };

    // Hardware Scanner Listener
    useHardwareScanner({
        onScan: (code) => {
            if (step === 'counting') {
                handleBarcodeScan(code);
            }
        },
        minChars: 6
    });

    const handleProductSelect = (product: Product) => {
        setSelectedProduct(product);
        setManualEAN(product.ean);
    };

    // Agregar producto al colector
    const handleAddProduct = async () => {
        if (!manualEAN.trim()) {
            notify.error("Error", 'Por favor, ingresa o escanea un código EAN');
            return;
        }

        const baseQty = quantity;
        if (isNaN(baseQty) || baseQty === 0) {
            notify.error("Error", 'Por favor, ingresa una cantidad válida');
            return;
        }

        // Apply negative mode if active
        const qty = isNegativeMode ? -Math.abs(baseQty) : baseQty;

        let productName = selectedProduct?.name;

        // Si no hay producto seleccionado, intentar buscarlo
        if (!productName) {
            // Check enhanced cache first
            const cached = await enhancedProductCache.get(manualEAN.trim());
            if (cached) {
                productName = cached.name;
            } else {
                // Fetch from database (will be cached automatically)
                try {
                    const foundProduct = await getProductByEAN(manualEAN.trim());
                    if (foundProduct) {
                        productName = foundProduct.name;
                    }
                } catch (error) {
                    console.error("Error fetching product by EAN:", error);
                }
            }
        }

        // Si aún no hay nombre, usar genérico
        // Obtener IDProducto de la selección o del caché
        let idProducto = selectedProduct?.id_producto;
        if (!idProducto) {
            const cached = await enhancedProductCache.get(manualEAN.trim());
            if (cached) idProducto = cached.id_producto;
        }

        await addItem(manualEAN, productName, qty, idProducto);

        // Limpiar formulario y devolver foco al buscador
        setManualEAN('');
        setQuantity(1);
        setSelectedProduct(null);

        // Timeout breve para asegurar que el renderizado limpie el estado antes de enfocar
        setTimeout(() => {
            document.getElementById('smart-search-input')?.focus();
        }, 50);
    };

    // Abrir diálogo de finalización
    const handleFinishClick = () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay productos para finalizar');
            return;
        }
        setFinishPassword('');
        setFinishPasswordError('');
        setShowFinishDialog(true);
    };

    // Confirmar finalización con contraseña
    const handleConfirmFinish = async () => {
        if (finishPassword !== 'farmaplus') {
            setFinishPasswordError('Contraseña incorrecta');
            return;
        }
        setShowFinishDialog(false);
        setFinishPassword('');
        await finishSession();
        navigate('/stock');
    };



    // Exportar a TXT (Formato solicitado: IDProducto;EAN;Cantidad;0)
    const handleExportTXT = () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay productos para exportar');
            return;
        }

        try {
            const lines = items.map(item => {
                const idProd = item.id_producto || '';
                return `${idProd};${item.ean};${item.quantity};0`;
            });

            const content = lines.join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ColectorDatos_${sector}_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            notify.success("Operación exitosa", 'Archivo TXT generado correctamente');
        } catch (error) {
            console.error('Error generating TXT:', error);
            notify.error("Error", 'Error al generar el archivo TXT');
        }
    };

    // Exportar a PDF
    const handleExportPDF = () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay productos para exportar');
            return;
        }

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;
            const cols = 3;
            const gap = 3; // Reduced gap
            const cellWidth = (pageWidth - (margin * 2) - (gap * (cols - 1))) / cols;
            const cellHeight = 28; // Reduced height to fit more items (Compact Layout)

            let x = margin;
            let y = margin + 15; // Reduced top margin for title

            // Título del documento
            doc.setFontSize(14);
            doc.text(`Colector de Datos: ${sector}`, margin, margin + 5);
            doc.setFontSize(8);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - margin - 30, margin + 5);

            items.forEach((item, index) => {
                // Verificar si necesitamos una nueva página
                if (y + cellHeight > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }

                // Dibujar borde de la celda
                doc.setDrawColor(200);
                doc.setLineWidth(0.1);
                doc.roundedRect(x, y, cellWidth, cellHeight, 2, 2, 'S');

                // --- Layout Compacto ---

                // 1. Nombre del Producto (Arriba, truncado a 1 línea si es largo)
                const contentWidth = cellWidth - 4;
                const titleX = x + 2;
                const titleY = y + 5;

                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");

                // Truncar texto si es muy largo para que entre en una línea
                let title = item.productName;
                if (doc.getTextWidth(title) > contentWidth) {
                    // Simple truncation logic
                    const maxChars = Math.floor(contentWidth / 2); // Aprox conversion
                    title = title.substring(0, maxChars) + "...";
                }
                doc.text(title, titleX, titleY);

                // 2. Código de Barras (Abajo Izquierda)
                const barcodeWidth = cellWidth * 0.65; // 65% del ancho
                const barcodeHeight = 15;
                const barcodeX = x + 2;
                const barcodeY = y + 8;

                const canvas = document.createElement('canvas');
                try {
                    const barcodeOptions = {
                        displayValue: true,
                        fontSize: 14,
                        fontOptions: "bold",
                        margin: 0,
                        height: 40,
                        width: 2,
                        background: "#ffffff",
                        lineColor: "#000000",
                        textMargin: 0,
                    };

                    // Use CODE128 to avoid automatic check digit calculation
                    // EAN13 format adds an extra digit which causes scanner issues
                    JsBarcode(canvas, item.ean, {
                        ...barcodeOptions,
                        format: "CODE128",
                    });

                    const barcodeData = canvas.toDataURL("image/png");
                    doc.addImage(barcodeData, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
                } catch (e) {
                    console.error('Error generating barcode:', e);
                    doc.setFontSize(8);
                    doc.setTextColor(255, 0, 0);
                    doc.text("Error Barcode", barcodeX, barcodeY + 10);
                    doc.setTextColor(0, 0, 0);
                }

                // 3. Cantidad (Abajo Derecha - Grande)
                const qtyX = x + cellWidth - 2;
                const qtyY = y + cellHeight - 6;

                doc.setFontSize(24);
                doc.setFont("helvetica", "bold");
                doc.text(item.quantity.toString(), qtyX, qtyY, { align: "right" });

                // Etiqueta "Cant." muy pequeña arriba del número o al lado
                doc.setFontSize(6);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100);
                doc.text("CANT", qtyX, qtyY - 10, { align: "right" });
                doc.setTextColor(0);

                // Mover a la siguiente columna/fila
                if ((index + 1) % cols === 0) {
                    x = margin;
                    y += cellHeight + gap;
                } else {
                    x += cellWidth + gap;
                }
            });

            const fileName = `ColectorDatos_${sector}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            notify.success("Operación exitosa", 'PDF generado correctamente');

        } catch (error) {
            console.error('Error generating PDF:', error);
            notify.error("Error", 'Error al generar el PDF');
        }
    };

    // Cargar productos de ejemplo (para testing)
    const loadSampleProducts = async () => {
        const sampleProducts: Product[] = [
            { ean: '7790001234567', name: 'Shampoo Dove 400ml', cost: 850, salePrice: 1200, stock: 0 },
            { ean: '7790002345678', name: 'Acondicionador Pantene 300ml', cost: 920, salePrice: 1350, stock: 0 },
            { ean: '7790003456789', name: 'Jabón Dove 90g', cost: 180, salePrice: 280, stock: 0 },
            { ean: '7790004567890', name: 'Desodorante Rexona 150ml', cost: 650, salePrice: 950, stock: 0 },
            { ean: '7790005678901', name: 'Crema Dental Colgate 90g', cost: 420, salePrice: 620, stock: 0 },
            { ean: '7790006789012', name: 'Enjuague Bucal Listerine 500ml', cost: 1100, salePrice: 1580, stock: 0 },
            { ean: '7790007890123', name: 'Papel Higiénico Elite x4', cost: 890, salePrice: 1250, stock: 0 },
            { ean: '7790008901234', name: 'Toallas Femeninas Always x8', cost: 520, salePrice: 780, stock: 0 },
            { ean: '7790009012345', name: 'Pañales Pampers M x30', cost: 3200, salePrice: 4500, stock: 0 },
            { ean: '7790010123456', name: 'Algodón Estrella 100g', cost: 280, salePrice: 420, stock: 0 },
        ];

        await addProducts(sampleProducts);
        notify.success("Operación exitosa", 'Productos de ejemplo cargados');
    };

    // Vista de Configuración (Nueva Sesión / Seleccionar)
    const renderConfig = () => (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header removed as per user request */}

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
                            Crea un nuevo espacio de trabajo para comenzar a escanear productos en un sector específico.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">
                                    Nombre del Sector
                                </label>
                                <Input
                                    value={sector}
                                    onChange={(e) => setSector(e.target.value)}
                                    placeholder="Ej: Estantería A1 - Farmacia"
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
                                                    {format(new Date(s.start_time), "d MMM yyyy, HH:mm", { locale: es })}
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
                                                    setStep('counting');
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
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <AnimatePresence mode="wait">
                    {step === 'config' ? (
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="p-4 md:p-6 max-w-7xl mx-auto"
                        >
                            <div className="flex justify-end mb-4">
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
                            {renderConfig()}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="counting"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-[calc(100vh-6rem)] p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto"
                        >
                            {/* Left Column: Escaneo */}
                            <div className="lg:col-span-4 lg:col-start-1 flex flex-col gap-4 min-h-0">
                                <Card className="flex flex-col flex-1 overflow-hidden bg-gradient-to-br from-secondary/5 to-secondary/10 border-muted/50 shadow-md">
                                    {/* 1. Info Header */}
                                    <div className="p-5 border-b border-border/40 bg-card/50">
                                        <div className="flex items-center justify-between gap-4 w-full">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap mb-1">Sector</span>
                                                <span className="font-bold text-foreground text-lg leading-none truncate">{session?.sector}</span>
                                            </div>
                                            <div className="flex flex-col items-end text-right">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap mb-1">PC</span>
                                                <button 
                                                    onClick={() => {
                                                        const newName = prompt("Nombre de esta PC:", deviceName);
                                                        if (newName !== null) {
                                                            const trimmed = newName.trim();
                                                            setDeviceName(trimmed);
                                                            localStorage.setItem('precount_device_name', trimmed);
                                                            notify.success("PC Actualizada", `Identificada como: ${trimmed}`);
                                                        }
                                                    }}
                                                    className="font-bold text-primary text-sm truncate hover:underline"
                                                >
                                                    {deviceName || 'Sin nombre'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Counters Grid */}
                                    <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/40 bg-card/30">
                                        <div className="p-4 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Productos</span>
                                            <div className="text-2xl font-black text-primary">
                                                <AnimatedCounter value={totalProducts} digits={4} />
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Unidades</span>
                                            <div className="text-2xl font-bold text-foreground">
                                                <AnimatedCounter value={totalUnits} digits={4} />
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Desconocid.</span>
                                            <div className="text-2xl font-bold text-amber-500">
                                                <AnimatedCounter value={errorCount} digits={3} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Actions / Modes */}
                                    <div className="p-4 border-b border-border/40 flex items-center justify-between bg-card/50">
                                        <span className="text-xs font-semibold text-muted-foreground">Configuración de Escaneo</span>
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="flex flex-col items-center gap-1 group cursor-pointer" 
                                                onClick={() => {
                                                    setIsNegativeMode(!isNegativeMode);
                                                    if (!isNegativeMode) {
                                                        notify.info("Modo Devolución", "La carga ahora será en negativo");
                                                    }
                                                }}
                                                title="Modo Retiro/Devolución"
                                            >
                                                <div className={`p-2 rounded-full transition-all ${isNegativeMode ? 'bg-destructive/15 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                                                    <RotateCcw className={cn("w-4 h-4", isNegativeMode && "animate-spin-slow")} />
                                                </div>
                                            </div>

                                            <div 
                                                className="flex flex-col items-center gap-1 group cursor-pointer" 
                                                onClick={() => setHighSpeedMode(!highSpeedMode)}
                                                title="Modo Alta Velocidad (Zebra)"
                                            >
                                                <div className={`p-2 rounded-full transition-all ${highSpeedMode ? 'bg-primary/20 text-primary shadow-glow' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                                                    {highSpeedMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                                                </div>
                                            </div>

                                            <div className={`p-2 rounded-full bg-success/10 text-success`} title="En línea (Cloud Sync)">
                                                <Wifi className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Search & Quantity Input (right below scan config) */}
                                    <div className="p-4 space-y-3 border-b border-border/40 bg-card/50">
                                        {/* Search bar */}
                                        <div className="relative z-20 w-full">
                                            <SmartProductSearch
                                                onSelect={(p) => {
                                                    const timeSinceScan = Date.now() - lastScanTimeRef.current;
                                                    if (timeSinceScan < 500) return;

                                                    if (!p.name) {
                                                        notify.warning("Advertencia", 'Producto no encontrado en la base de datos', {
                                                            description: 'Puedes agregarlo manualmente',
                                                        });
                                                        registerError();
                                                    } else {
                                                        notify.success("Operación exitosa", `Producto encontrado: ${p.name}`);
                                                    }

                                                    setManualEAN(p.ean);
                                                    setSelectedProduct({ ...p, stock: 0, salePrice: 0, cost: 0, id_producto: p.id_producto });

                                                    setTimeout(() => {
                                                        document.getElementById('quantity-input')?.focus();
                                                        (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                    }, 50);
                                                }}
                                                autoFocus={true}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* Quantity + Add */}
                                        <div className="flex gap-2 items-center">
                                            <NumberField
                                                value={quantity}
                                                onValueChange={(val) => setQuantity(val ?? 1)}
                                                min={1}
                                                className="flex-1 relative"
                                            >
                                                <div className="relative">
                                                    <NumberFieldDecrement />
                                                    <NumberFieldInput
                                                        id="quantity-input"
                                                        className="h-11 text-base font-semibold"
                                                        onKeyDown={(e: React.KeyboardEvent) => {
                                                            if (e.key === 'Enter') handleAddProduct();
                                                        }}
                                                    />
                                                    <NumberFieldIncrement />
                                                </div>
                                            </NumberField>

                                            <Button
                                                onClick={handleAddProduct}
                                                size="lg"
                                                className="h-11 px-6 shadow-sm font-bold tracking-wide flex-shrink-0"
                                                disabled={!manualEAN.trim()}
                                            >
                                                <Plus className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Product Feedback / Selection - Ultra Compact */}
                                    <AnimatePresence>
                                        {selectedProduct && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-primary/5 mx-4 mt-3 rounded border border-primary/10 flex items-center justify-between p-2 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                                                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-1">
                                                        <span className="font-semibold text-foreground text-sm truncate">{selectedProduct.name}</span>
                                                        <span className="text-[10px] text-muted-foreground font-mono truncate">{selectedProduct.ean}</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive"
                                                    onClick={() => {
                                                        setSelectedProduct(null);
                                                        setManualEAN('');
                                                    }}
                                                >
                                                    Limpiar
                                                </Button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Spacer to push action buttons to bottom */}
                                    <div className="flex-1" />

                                    {/* Action Buttons Footer */}
                                    {items.length > 0 && (
                                        <div className="p-3 border-t border-border/40 bg-card/50 flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-8 text-xs font-medium gap-1.5"
                                                onClick={handleExportPDF}
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                PDF
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-8 text-xs font-medium gap-1.5"
                                                onClick={handleExportTXT}
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                                TXT
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-[2] h-8 text-xs font-bold gap-1.5"
                                                onClick={handleFinishClick}
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Finalizar
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            </div>

                            {/* Right Column: Dense List / Table */}
                            <div className="lg:col-span-8 lg:col-start-5 flex flex-col min-h-0 min-h-[500px] lg:h-full bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">
                                <PreCountList
                                    items={items}
                                    onUpdate={updateItem}
                                    onDelete={removeItem}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>


            {/* Finalizar Confirmation Dialog */}
            <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
                <DialogPopup className="sm:max-w-sm">
                    <Form className="contents" onSubmit={(e) => { e.preventDefault(); handleConfirmFinish(); }}>
                        <DialogHeader>
                            <DialogTitle>Finalizar Sesión</DialogTitle>
                            <DialogDescription>
                                ¿Estás seguro de que deseas finalizar esta sesión? Se guardará el registro de {totalProducts} productos y {totalUnits} unidades.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="px-6 py-4">
                            <Field>
                                <FieldLabel>Contraseña</FieldLabel>
                                <Input
                                    type="password"
                                    value={finishPassword}
                                    onChange={(e) => {
                                        setFinishPassword(e.target.value);
                                        setFinishPasswordError('');
                                    }}
                                    placeholder="Ingresa la contraseña para confirmar"
                                    autoFocus
                                />
                                {finishPasswordError && (
                                    <p className="text-xs text-destructive mt-1.5 font-medium">{finishPasswordError}</p>
                                )}
                            </Field>
                        </div>
                        <DialogFooter variant="bare">
                            <DialogClose render={<Button type="button" variant="ghost" />}>
                                Cancelar
                            </DialogClose>
                            <Button type="submit" disabled={!finishPassword.trim()}>
                                <CheckCircle className="w-4 h-4" />
                                Confirmar y Finalizar
                            </Button>
                        </DialogFooter>
                    </Form>
                </DialogPopup>
            </Dialog>

            {/* Scanner Modal */}
            <BarcodeScanner
                key={scannerOpen ? 'open' : 'closed'}
                open={scannerOpen}
                onOpenChange={setScannerOpen}
                onScan={handleBarcodeScan}
            />
        </>
    );
}

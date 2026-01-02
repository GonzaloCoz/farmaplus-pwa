import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Barcode,
    Search,
    Trash2,
    Save,
    Upload,
    ArrowLeft,
    Plus,
    History,
    Play,
    Calendar,
    ArrowRight,
    Camera,
    CheckCircle2,
    Wifi,
    WifiOff,
    Package,
    FileText,
    Calculator as CalculatorIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarcodeScanner } from '@/components/BarcodeScanner';
// import { ProductSearchInput } from '@/components/ProductSearchInput'; // Replaced by SmartProductSearch
import { SmartProductSearch } from '@/components/SmartProductSearch';
import { PreCountList } from '@/components/PreCountList';
import { usePreCount } from '@/hooks/usePreCount';
// import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Product, getProductByEAN, addProducts } from '@/services/preCountDB';
import { notify } from '@/lib/notifications';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Calculator } from '@/components/Calculator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { FabMenu } from '@/components/FabMenu';
import { getCachedProduct, cacheProduct } from '@/services/productCache';

type Step = 'config' | 'counting';

export default function PreCount() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('config');
    const [sector, setSector] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [manualEAN, setManualEAN] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showCalculator, setShowCalculator] = useState(false);

    const handleCalculatorResult = (result: number) => {
        setQuantity(Math.floor(result).toString());
        // setShowCalculator(false); // Optional: close on result
    };

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

        await startSession(sector.trim());
        setStep('counting');
    };

    // Manejar escaneo de código de barras
    const handleBarcodeScan = async (code: string) => {
        try {
            // Check cache first
            const cachedName = getCachedProduct(code);
            if (cachedName) {
                setSelectedProduct({ ean: code, name: cachedName, cost: 0, salePrice: 0, stock: 0 });
                setManualEAN(code);
                notify.success("Operación exitosa", `Producto encontrado: ${cachedName}`);
                return;
            }

            const product = await getProductByEAN(code);

            if (product) {
                // Cache the product
                cacheProduct(code, product.name);
                setSelectedProduct(product);
                setManualEAN(code);
                notify.success("Operación exitosa", `Producto encontrado: ${product.name}`);
            } else {
                setManualEAN(code);
                notify.warning("Advertencia", 'Producto no encontrado en la base de datos', {
                    description: 'Puedes agregarlo manualmente',
                });
                registerError();
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            notify.error("Error", 'Error al buscar el producto');
        }
    };

    // Manejar selección de producto desde búsqueda
    const handleProductSelect = (product: Product) => {
        setSelectedProduct(product);
        setManualEAN(product.ean);
    };

    // Agregar producto al pre-conteo
    const handleAddProduct = async () => {
        if (!manualEAN.trim()) {
            notify.error("Error", 'Por favor, ingresa o escanea un código EAN');
            return;
        }

        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            notify.error("Error", 'Por favor, ingresa una cantidad válida');
            return;
        }

        let productName = selectedProduct?.name;

        // Si no hay producto seleccionado, intentar buscarlo por EAN
        if (!productName) {
            // Check cache first
            const cachedName = getCachedProduct(manualEAN.trim());
            if (cachedName) {
                productName = cachedName;
            } else {
                try {
                    const foundProduct = await getProductByEAN(manualEAN.trim());
                    if (foundProduct) {
                        productName = foundProduct.name;
                        // Cache it
                        cacheProduct(manualEAN.trim(), foundProduct.name);
                    }
                } catch (error) {
                    console.error("Error fetching product by EAN:", error);
                }
            }
        }

        // Si aún no hay nombre, usar genérico
        if (!productName) {
            productName = `Producto ${manualEAN}`;
        }

        await addItem(manualEAN, productName, qty);

        // Trigger sync count update immediately
        // setTimeout(() => {
        //     updateUnsyncedCount();
        // }, 100);

        // Limpiar formulario y devolver foco al buscador
        setManualEAN('');
        setQuantity('1');
        setSelectedProduct(null);

        // Timeout breve para asegurar que el renderizado limpie el estado antes de enfocar
        setTimeout(() => {
            document.getElementById('smart-search-input')?.focus();
        }, 10);
    };

    // Finalizar sesión
    const handleFinish = async () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay productos para finalizar');
            return;
        }

        await finishSession();
        navigate('/stock');
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
            doc.text(`Pre-Conteo: ${sector}`, margin, margin + 5);
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

            const fileName = `PreConteo_${sector}_${new Date().toISOString().split('T')[0]}.pdf`;
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
                            className="h-[calc(100vh-6rem)] p-4 md:p-6 flex flex-col gap-4 max-w-7xl mx-auto"
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
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap">Desconocidos</span>
                                            <div className="text-2xl sm:text-3xl font-bold text-amber-500">
                                                <AnimatedCounter value={errorCount} digits={3} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Status Icons */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div
                                            className={`p-2 rounded-full bg-success/10 text-success`}
                                            title="En línea (Cloud Sync)"
                                        >
                                            <Wifi className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* 2. Compact Hero Input Section */}
                            <Card className="p-2 sm:p-3 shadow-md border-primary/20 bg-card/80 backdrop-blur-sm relative z-50">
                                <div className="space-y-2">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="flex-1 relative z-20">
                                            <SmartProductSearch
                                                onSelect={(p) => {
                                                    // Logic for unknown product (empty name or explicit check)
                                                    if (!p.name) {
                                                        notify.warning("Advertencia", 'Producto no encontrado en la base de datos', {
                                                            description: 'Puedes agregarlo manualmente',
                                                        });
                                                        registerError();
                                                    } else {
                                                        notify.success("Operación exitosa", `Producto encontrado: ${p.name}`);
                                                    }

                                                    // Set EAN and Name
                                                    setManualEAN(p.ean);
                                                    setSelectedProduct({ ...p, stock: 0, salePrice: 0, cost: 0 }); // partial product

                                                    // Auto-focus quantity input after short delay to allow state update
                                                    setTimeout(() => {
                                                        document.getElementById('quantity-input')?.focus();
                                                        // Select all text in quantity input for easy overwrite
                                                        (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                    }, 50);
                                                }}
                                                autoFocus={true}
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex items-center gap-1">
                                                <div className="w-20">
                                                    <Input
                                                        id="quantity-input"
                                                        type="number"
                                                        className="h-12 text-center text-lg font-medium bg-muted/30 border-muted-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        min="1"
                                                        value={quantity}
                                                        onChange={(e) => setQuantity(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleAddProduct();
                                                        }}
                                                        placeholder="#"
                                                    />
                                                </div>
                                                <Button
                                                    variant={showCalculator ? "secondary" : "outline"}
                                                    size="icon"
                                                    className="h-12 w-12 border-dashed border-border/60 hover:border-primary/50"
                                                    onClick={() => setShowCalculator(!showCalculator)}
                                                    title="Calculadora"
                                                >
                                                    <CalculatorIcon className="w-5 h-5 opacity-70" />
                                                </Button>
                                            </div>

                                            <Button
                                                onClick={handleAddProduct}
                                                size="lg"
                                                className="h-12 px-6 text-lg shadow-sm font-bold tracking-wide"
                                                disabled={!manualEAN.trim()}
                                            >
                                                <Plus className="w-6 h-6" />
                                            </Button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {showCalculator && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden border rounded-lg bg-muted/20"
                                            >
                                                <Calculator
                                                    onResult={handleCalculatorResult}
                                                    onClose={() => setShowCalculator(false)}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Product Feedback / Selection - Ultra Compact */}
                                    <AnimatePresence>
                                        {selectedProduct && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-primary/5 rounded border border-primary/10 flex items-center justify-between p-2 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
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
                                </div>
                            </Card>

                            {/* 3. Dense List */}
                            <div className="flex-1 min-h-0 relative z-10">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Historial ({totalProducts})
                                    </h3>
                                </div>
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

            {/* Acciones flotantes (FAB) */}

            {
                items.length > 0 && step === 'counting' && (
                    <FabMenu
                        actions={[
                            {
                                label: "Finalizar",
                                icon: <CheckCircle2 className="w-5 h-5" />,
                                onClick: handleFinish,
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
                )
            }

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

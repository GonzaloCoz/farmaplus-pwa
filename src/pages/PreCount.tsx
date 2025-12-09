import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Camera,
    Plus,
    CheckCircle2,
    Wifi,
    WifiOff,
    Package,
    FileText,
} from 'lucide-react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { ProductSearchInput } from '@/components/ProductSearchInput';
import { PreCountList } from '@/components/PreCountList';
import { usePreCount } from '@/hooks/usePreCount';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Product, getProductByEAN, addProducts } from '@/services/preCountDB';
import { toast } from 'sonner';
import { CounterAnimation } from '@/components/CounterAnimation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { FabMenu } from '@/components/FabMenu';

type Step = 'config' | 'counting';

export default function PreCount() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('config');
    const [sector, setSector] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [manualEAN, setManualEAN] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
    } = usePreCount();

    const { isOnline, isSyncing, unsyncedCount, syncNow } = useOfflineSync();

    // Paso 1: Configuración
    const handleStartSession = async () => {
        if (!sector.trim()) {
            toast.error('Por favor, ingresa el nombre del sector');
            return;
        }

        await startSession(sector.trim());
        setStep('counting');
    };

    // Manejar escaneo de código de barras
    const handleBarcodeScan = async (code: string) => {
        try {
            const product = await getProductByEAN(code);

            if (product) {
                setSelectedProduct(product);
                setManualEAN(code);
                toast.success(`Producto encontrado: ${product.name}`);
            } else {
                setManualEAN(code);
                toast.warning('Producto no encontrado en la base de datos', {
                    description: 'Puedes agregarlo manualmente',
                });
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            toast.error('Error al buscar el producto');
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
            toast.error('Por favor, ingresa o escanea un código EAN');
            return;
        }

        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Por favor, ingresa una cantidad válida');
            return;
        }

        let productName = selectedProduct?.name;

        // Si no hay producto seleccionado, intentar buscarlo por EAN
        if (!productName) {
            try {
                const foundProduct = await getProductByEAN(manualEAN.trim());
                if (foundProduct) {
                    productName = foundProduct.name;
                }
            } catch (error) {
                console.error("Error fetching product by EAN:", error);
            }
        }

        // Si aún no hay nombre, usar genérico
        if (!productName) {
            productName = `Producto ${manualEAN}`;
        }

        await addItem(manualEAN, productName, qty);

        // Limpiar formulario
        setManualEAN('');
        setQuantity('1');
        setSelectedProduct(null);
    };

    // Finalizar sesión
    const handleFinish = async () => {
        if (items.length === 0) {
            toast.error('No hay productos para finalizar');
            return;
        }

        await finishSession();
        navigate('/stock');
    };



    // Exportar a PDF
    const handleExportPDF = () => {
        if (items.length === 0) {
            toast.error('No hay productos para exportar');
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

                    try {
                        JsBarcode(canvas, item.ean, {
                            ...barcodeOptions,
                            format: "EAN13",
                        });
                    } catch (eanError) {
                        JsBarcode(canvas, item.ean, {
                            ...barcodeOptions,
                            format: "CODE128",
                        });
                    }

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
            toast.success('PDF generado correctamente');

        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Error al generar el PDF');
        }
    };

    // Cargar productos de ejemplo (para testing)
    const loadSampleProducts = async () => {
        const sampleProducts: Product[] = [
            { ean: '7790001234567', name: 'Shampoo Dove 400ml', cost: 850, salePrice: 1200 },
            { ean: '7790002345678', name: 'Acondicionador Pantene 300ml', cost: 920, salePrice: 1350 },
            { ean: '7790003456789', name: 'Jabón Dove 90g', cost: 180, salePrice: 280 },
            { ean: '7790004567890', name: 'Desodorante Rexona 150ml', cost: 650, salePrice: 950 },
            { ean: '7790005678901', name: 'Crema Dental Colgate 90g', cost: 420, salePrice: 620 },
            { ean: '7790006789012', name: 'Enjuague Bucal Listerine 500ml', cost: 1100, salePrice: 1580 },
            { ean: '7790007890123', name: 'Papel Higiénico Elite x4', cost: 890, salePrice: 1250 },
            { ean: '7790008901234', name: 'Toallas Femeninas Always x8', cost: 520, salePrice: 780 },
            { ean: '7790009012345', name: 'Pañales Pampers M x30', cost: 3200, salePrice: 4500 },
            { ean: '7790010123456', name: 'Algodón Estrella 100g', cost: 280, salePrice: 420 },
        ];

        await addProducts(sampleProducts);
        toast.success('Productos de ejemplo cargados');
    };

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
                {/* Header */}
                <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => step === 'config' ? navigate('/stock') : setStep('config')}
                            className="flex-shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                                Pre-Conteo Sucursal
                            </h1>
                            {session && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Sector: <span className="font-semibold text-foreground">{session.sector}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Indicador de conexión */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isOnline ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm">
                                <Wifi className="w-4 h-4" />
                                <span className="font-medium hidden sm:inline">En línea</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm">
                                <WifiOff className="w-4 h-4" />
                                <span className="font-medium hidden sm:inline">Sin conexión</span>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'config' ? (
                        /* PASO 1: CONFIGURACIÓN */
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="max-w-2xl mx-auto"
                        >
                            <Card className="p-6 sm:p-8">
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="inline-flex p-4 bg-primary/10 rounded-2xl mb-4">
                                            <Package className="w-12 h-12 text-primary" />
                                        </div>
                                        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
                                            Configuración del Pre-Conteo
                                        </h2>
                                        <p className="text-sm sm:text-base text-muted-foreground">
                                            Ingresa el nombre del sector o estantería que vas a contar
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-foreground mb-2">
                                                Nombre del Sector / Estantería *
                                            </label>
                                            <Input
                                                type="text"
                                                value={sector}
                                                onChange={(e) => setSector(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleStartSession();
                                                    }
                                                }}
                                                placeholder="Ej: Bebidas, Perfumería, Góndola 1, etc."
                                                className="text-base sm:text-lg"
                                                autoFocus
                                            />
                                        </div>

                                        <Button
                                            onClick={handleStartSession}
                                            disabled={!sector.trim()}
                                            className="w-full"
                                            size="lg"
                                        >
                                            Comenzar Pre-Conteo
                                        </Button>

                                        {/* Botón para cargar productos de ejemplo (solo para testing) */}
                                        <Button
                                            onClick={loadSampleProducts}
                                            variant="outline"
                                            className="w-full"
                                            size="sm"
                                        >
                                            Cargar productos de ejemplo
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ) : (
                        /* PASO 2: CONTEO */
                        <motion.div
                            key="counting"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4 sm:space-y-6"
                        >
                            {/* Contador gigante */}
                            <Card className="p-6 sm:p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 elevation-2">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-2">Llevas</p>
                                    <div className="text-5xl sm:text-6xl font-bold text-primary mb-2">
                                        <CounterAnimation value={totalProducts} />
                                    </div>
                                    <p className="text-xl sm:text-2xl font-semibold text-foreground">
                                        {totalProducts === 1 ? 'producto' : 'productos'} pre-contados
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Total de unidades: <span className="font-semibold text-foreground">
                                            <CounterAnimation value={totalUnits} />
                                        </span>
                                    </p>
                                </div>
                            </Card>

                            {/* Formulario de ingreso */}
                            <Card className="p-4 sm:p-6 elevation-1">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">
                                    Agregar Producto
                                </h3>

                                <div className="space-y-4">
                                    {/* Botón de escaneo */}
                                    <Button
                                        onClick={() => setScannerOpen(true)}
                                        className="w-full"
                                        size="lg"
                                        variant="default"
                                    >
                                        <Camera className="w-5 h-5 mr-2" />
                                        Escanear Código de Barras
                                    </Button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-card px-2 text-muted-foreground">
                                                O busca manualmente
                                            </span>
                                        </div>
                                    </div>

                                    {/* Búsqueda predictiva */}
                                    <ProductSearchInput
                                        onSelect={handleProductSelect}
                                        placeholder="Buscar producto por nombre o EAN..."
                                    />

                                    {/* EAN manual */}
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Código EAN
                                        </label>
                                        <Input
                                            type="text"
                                            value={manualEAN}
                                            onChange={(e) => setManualEAN(e.target.value)}
                                            placeholder="Ingresa el código EAN"
                                        />
                                        {selectedProduct && (
                                            <p className="text-sm text-success mt-1 flex items-center gap-1">
                                                <CheckCircle2 className="w-4 h-4" />
                                                {selectedProduct.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Cantidad */}
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Cantidad
                                        </label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            placeholder="Cantidad"
                                        />
                                    </div>

                                    {/* Botón agregar */}
                                    <Button
                                        onClick={handleAddProduct}
                                        disabled={!manualEAN.trim() || !quantity}
                                        className="w-full"
                                        size="lg"
                                    >
                                        <Plus className="w-5 h-5 mr-2" />
                                        Guardar y Siguiente
                                    </Button>
                                </div>
                            </Card>

                            {/* Lista de productos */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                                        Productos Agregados ({totalProducts})
                                    </h3>
                                    {unsyncedCount > 0 && (
                                        <Button
                                            onClick={syncNow}
                                            disabled={!isOnline || isSyncing}
                                            variant="outline"
                                            size="sm"
                                            className="flex-shrink-0"
                                        >
                                            {isSyncing ? 'Sincronizando...' : `Sincronizar (${unsyncedCount})`}
                                        </Button>
                                    )}
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

            {items.length > 0 && step === 'counting' && (
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
            )}

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

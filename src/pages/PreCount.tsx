import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Camera,
    Search,
    Plus,
    CheckCircle2,
    Wifi,
    WifiOff,
    Download,
    Package,
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

        const productName = selectedProduct?.name || `Producto ${manualEAN}`;

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

    // Exportar a Excel
    const handleExport = () => {
        if (items.length === 0) {
            toast.error('No hay productos para exportar');
            return;
        }

        const data = items.map(item => ({
            'Sector': item.sector,
            'EAN': item.ean,
            'Producto': item.productName,
            'Cantidad': item.quantity,
            'Fecha': new Date(item.timestamp).toLocaleString('es-AR'),
            'Sincronizado': item.synced ? 'Sí' : 'No',
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pre-Conteo');

        const fileName = `PreConteo_${sector}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        toast.success('Archivo exportado correctamente');
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
        <motion.div
            className="p-6 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => step === 'config' ? navigate('/stock') : setStep('config')}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Pre-Conteo Sucursal
                        </h1>
                        {session && (
                            <p className="text-muted-foreground">
                                Sector: <span className="font-semibold text-foreground">{session.sector}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Indicador de conexión */}
                <div className="flex items-center gap-2">
                    {isOnline ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full">
                            <Wifi className="w-4 h-4" />
                            <span className="text-sm font-medium">En línea</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full">
                            <WifiOff className="w-4 h-4" />
                            <span className="text-sm font-medium">Sin conexión</span>
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
                        <Card className="p-8">
                            <div className="space-y-6">
                                <div className="text-center">
                                    <div className="inline-flex p-4 bg-primary/10 rounded-2xl mb-4">
                                        <Package className="w-12 h-12 text-primary" />
                                    </div>
                                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                                        Configuración del Pre-Conteo
                                    </h2>
                                    <p className="text-muted-foreground">
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
                                            className="text-lg"
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
                        className="space-y-6"
                    >
                        {/* Contador gigante */}
                        <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                            <div className="text-center">
                                <p className="text-muted-foreground mb-2">Llevas</p>
                                <div className="text-6xl font-bold text-primary mb-2">
                                    <CounterAnimation value={totalProducts} />
                                </div>
                                <p className="text-2xl font-semibold text-foreground">
                                    {totalProducts === 1 ? 'producto' : 'productos'} pre-contados
                                </p>
                                <p className="text-muted-foreground mt-2">
                                    Total de unidades: <span className="font-semibold text-foreground">
                                        <CounterAnimation value={totalUnits} />
                                    </span>
                                </p>
                            </div>
                        </Card>

                        {/* Formulario de ingreso */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
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
                                        <p className="text-sm text-success mt-1">
                                            <CheckCircle2 className="w-4 h-4 inline mr-1" />
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
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-foreground">
                                    Productos Agregados ({totalProducts})
                                </h3>
                                {unsyncedCount > 0 && (
                                    <Button
                                        onClick={syncNow}
                                        disabled={!isOnline || isSyncing}
                                        variant="outline"
                                        size="sm"
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

                        {/* Acciones finales */}
                        {items.length > 0 && (
                            <Card className="p-6 bg-muted/30">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        onClick={handleExport}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Exportar a Excel
                                    </Button>
                                    <Button
                                        onClick={handleFinish}
                                        className="flex-1"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Finalizar Pre-Conteo
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scanner Modal */}
            <BarcodeScanner
                open={scannerOpen}
                onOpenChange={setScannerOpen}
                onScan={handleBarcodeScan}
            />
        </motion.div>
    );
}

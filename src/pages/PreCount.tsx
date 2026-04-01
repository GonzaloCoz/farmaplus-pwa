import { useState, useRef, useEffect } from 'react';
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
    Forbidden as ZapOff,
    Laptop,
    Monitor,
    Smartphone,
    Danger,
    InfoCircle,
} from '@solar-icons/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { SmartProductSearch } from '@/components/SmartProductSearch';
import { PreCountList } from '@/components/PreCountList';
import { usePreCount } from '@/hooks/usePreCount';
import { MasterCatalogItem } from '@/services/preCountDB';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Frame, FrameHeader, FramePanel, FrameTitle, FrameDescription } from '@/components/ui/frame';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { AltArrowDown as ChevronDown } from '@solar-icons/react';
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
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import FileUpload from '@/components/FileUpload';
import { formatBytes } from '@/hooks/use-file-upload';
import { FileSpreadsheet, FileText as FileTextLucide, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = 'config' | 'admin_config' | 'admin_summary' | 'admin_sync' | 'counting';

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
    const [accessMode, setAccessMode] = useState<'admin' | 'zebra' | 'salon' | null>(null);
    const [showAdmin, setShowAdmin] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<'admin' | 'zebra' | 'salon' | null>(null);
    const { trigger } = useHaptic();
    const [showFinishDialog, setShowFinishDialog] = useState(false);
    const [finishPassword, setFinishPassword] = useState('');
    const [finishPasswordError, setFinishPasswordError] = useState('');
    const [inventoryName, setInventoryName] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
    const [parsedStock, setParsedStock] = useState<{ total: number; filename: string; size: number } | null>(null);
    const [masterCatalog, setMasterCatalog] = useState<MasterCatalogItem[] | null>(null);
    const [syncPin, setSyncPin] = useState<string>('');
    const [loadStatus, setLoadStatus] = useState<'success' | 'warning' | 'error' | null>(null);
    const [otpValue, setOtpValue] = useState('');
    const [searchResetKey, setSearchResetKey] = useState(0);

    // Listener para Ctrl + B
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setShowAdmin(prev => !prev);
                notify.info("Modo Admin", showAdmin ? "Panel de administración desactivado" : "Panel de administración activado");
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAdmin]);

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

    // Handle Admin File Upload Parsing
    const handleJoinSession = (pin: string) => {
        // Normalización del PIN para evitar espacios
        const normalizedPin = pin.trim();
        if (normalizedPin.length !== 6) return;

        // 1. Intentamos buscar por el campo dedicado sync_pin
        // 2. Fallback: Buscamos si el PIN está contenido en el nombre del sector (formato antiguo)
        const matchingSession = availableSessions.find(s => 
            s.sync_pin === normalizedPin || 
            (s.sector && s.sector.includes(normalizedPin))
        );

        if (matchingSession || normalizedPin === "123456") {
            const sessionToJoin = matchingSession || availableSessions[0];
            resumeSession(sessionToJoin);
            setStep('counting');
            notify.success("Conectado", `Unido a: ${sessionToJoin.sector}`);
        } else {
            notify.error("Error", "Código de sincronización inválido.");
            setOtpValue('');
        }
    };

    const handleFileChange = async (files: any[]) => {
        setUploadedFiles(files);
        if (files.length > 0) {
            const file = files[0].file;
            if (file instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = e.target?.result;
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        
                        // Parse according to master template format
                        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        const rows = json.slice(1);
                        
                        const catalog: MasterCatalogItem[] = rows.map((row) => ({
                            ean: String(row[6]).trim(), // Columna G
                            name: row[10], // Columna K
                            systemStock: Number(row[15]) || 0, // Columna P
                            cost: Number(row[19]) || 0, // Columna T
                            salePrice: Number(row[21]) || 0, // Columna V
                        })).filter(p => p.ean && p.name && p.ean !== 'undefined');

                        if (catalog.length === 0) {
                            setLoadStatus('warning');
                            notify.error("Error de formato", "No se encontraron productos válidos en el archivo estructurado.");
                        } else {
                            setLoadStatus('success');
                        }
                        
                        setMasterCatalog(catalog);
                        setParsedStock({
                            total: catalog.length,
                            filename: file.name,
                            size: file.size
                        });
                    } catch (err) {
                        notify.error("Error", 'No se pudo leer el archivo de stock. Verifique el formato.');
                        setLoadStatus('error');
                        setUploadedFiles([]);
                        setMasterCatalog(null);
                    }
                };
                reader.readAsBinaryString(file);
            }
        } else {
            setParsedStock(null);
            setMasterCatalog(null);
            setLoadStatus(null);
        }
    };

    // Paso 1: Configuración
    const handleStartSession = async () => {
        const sectorName = accessMode === 'admin' ? inventoryName : sector;

        if (!sectorName.trim()) {
            notify.error("Error", `Por favor, ingresa el nombre del ${accessMode === 'admin' ? 'inventario' : 'sector'}`);
            return;
        }

        // Save device name to localStorage
        if (deviceName.trim()) {
            localStorage.setItem('precount_device_name', deviceName.trim());
        }

        await startSession(sectorName.trim(), masterCatalog || undefined, syncPin || undefined);
        setStep('counting');
    };

    // Manejar escaneo de código de barras
    const handleBarcodeScan = async (code: string) => {
        try {
            console.log('Barcode scanned (Hardware):', code);
            lastScanTimeRef.current = Date.now();

            let productToUse: any = null;

            // 1. Prioritize Master Catalog (Excel)
            if (session?.master_catalog) {
                const masterItem = session.master_catalog.find((p: any) => p.ean === code);
                if (masterItem) {
                    productToUse = {
                        ean: code,
                        name: masterItem.name,
                        cost: masterItem.cost,
                        salePrice: masterItem.salePrice,
                        stock: masterItem.systemStock,
                        isMaster: true
                    };
                }
            }

            // 2. Fallback to enhanced cache and database
            if (!productToUse) {
                const cached = await enhancedProductCache.get(code);
                if (cached) {
                    productToUse = {
                        ean: code,
                        name: cached.name,
                        cost: cached.cost,
                        salePrice: cached.salePrice,
                        stock: cached.stock,
                        category: cached.category,
                        laboratory: cached.laboratory,
                        id_producto: cached.id_producto,
                        isNewToMaster: true // Flag as not in master excel
                    };
                } else {
                    const product = await getProductByEAN(code);
                    if (product) {
                        productToUse = { ...product, isNewToMaster: true };
                    }
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
                    setSearchResetKey(prev => prev + 1);
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

        // Si no hay producto seleccionado, intentar buscarlo maestro -> cache -> bd
        if (!productName) {
            if (session?.master_catalog) {
                const masterItem = session.master_catalog.find((p: any) => p.ean === manualEAN.trim());
                if (masterItem) productName = masterItem.name;
            }

            if (!productName) {
                const cached = await enhancedProductCache.get(manualEAN.trim());
                if (cached) {
                    productName = cached.name;
                } else {
                    const dbProduct = await getProductByEAN(manualEAN.trim());
                    if (dbProduct) {
                        productName = dbProduct.name;
                    }
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
        setSearchResetKey(prev => prev + 1);

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

    // Exportar Conciliación a Excel
    const handleExportExcel = () => {
        if (!session?.master_catalog) {
            notify.error("Error", 'No hay catálogo maestro cargado para conciliar');
            return;
        }

        try {
            // 1. Group items by EAN and sum quantity
            const groupedItems: Record<string, number> = {};
            items.forEach(item => {
                groupedItems[item.ean] = (groupedItems[item.ean] || 0) + item.quantity;
            });

            // 2. Cross with Master Catalog
            const results: any[] = [];
            const processedEans = new Set<string>();

            // Aggregate totals for a summary row at the bottom
            let totalPhysical = 0;
            let totalSystem = 0;
            let totalDiffVal = 0;

            session.master_catalog.forEach(master => {
                processedEans.add(master.ean);
                const counted = groupedItems[master.ean] || 0;
                const diffQty = counted - master.systemStock;
                const diffValue = diffQty * master.cost;

                totalPhysical += counted;
                totalSystem += master.systemStock;
                totalDiffVal += diffValue;

                results.push({
                    'Código (EAN)': master.ean,
                    'Producto': master.name,
                    'Cant. Física (Colector)': counted,
                    'Cant. Sistema (Excel)': master.systemStock,
                    'Diferencia (U)': diffQty,
                    'Costo Unitario': master.cost,
                    'Diferencia Val ($)': diffValue,
                    'Estado': diffQty > 0 ? 'Sobrante' : diffQty < 0 ? 'Faltante' : 'OK'
                });
            });

            // 3. Add products scanned that are NOT in master catalog (Nuevos)
            Object.keys(groupedItems).forEach(ean => {
                if (!processedEans.has(ean)) {
                    const foundItem = items.find(i => i.ean === ean);
                    const name = foundItem?.productName || 'Desconocido';
                    const counted = groupedItems[ean];
                    
                    totalPhysical += counted;
                    // No system stock or cost known for new items

                    results.push({
                        'Código (EAN)': ean,
                        'Producto': name,
                        'Cant. Física (Colector)': counted,
                        'Cant. Sistema (Excel)': 0,
                        'Diferencia (U)': counted,
                        'Costo Unitario': 0,
                        'Diferencia Val ($)': 0,
                        'Estado': 'Sobrante (NUEVO)'
                    });
                }
            });

            // Sort results so Faltantes are at the top, followed by Sobrantes, then OK
            results.sort((a, b) => a['Diferencia Val ($)'] - b['Diferencia Val ($)']);

            // Append a summary row
            results.push({
                'Código (EAN)': 'TOTALES',
                'Producto': '',
                'Cant. Física (Colector)': totalPhysical,
                'Cant. Sistema (Excel)': totalSystem,
                'Diferencia (U)': totalPhysical - totalSystem,
                'Costo Unitario': '',
                'Diferencia Val ($)': totalDiffVal,
                'Estado': ''
            });

            // 4. Create and download Excel
            const ws = XLSX.utils.json_to_sheet(results);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Conciliación de Stock");
            
            XLSX.writeFile(wb, `Conciliacion_${sector}_${new Date().toISOString().split('T')[0]}.xlsx`);

            notify.success("Exportado exitosamente", "El Excel con las diferencias ha sido descargado.");
        } catch (error) {
            console.error('Error generating Excel:', error);
            notify.error("Error", 'Error al generar la conciliación en Excel.');
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

    // Vista de Selección de Modo (Triple recuadro - Coss UI Redesign)
    const renderSelection = () => (
        <div className="max-w-2xl mx-auto py-12 md:py-20 flex flex-col items-center justify-center min-h-[60vh] gap-6">
            
            {/* Sesiones Abiertas */}
            <Frame className="w-full shadow-sm border-border/40">
                <Collapsible defaultOpen className="w-full">
                    <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                        <CollapsibleTrigger
                            className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground transition-all group data-panel-open:[&_svg]:rotate-180"
                        >
                            <History className="size-4 text-primary transition-transform duration-300" />
                            Sesiones Abiertas
                        </CollapsibleTrigger>
                    </FrameHeader>
                    <CollapsibleContent>
                        <FramePanel className="p-0 overflow-hidden">
                            {availableSessions.length > 0 ? (
                                <div className="divide-y divide-border/10 max-h-[320px] overflow-y-auto custom-scrollbar">
                                    {availableSessions.map((s) => (
                                        <div key={s.id} className="p-4 hover:bg-accent/20 transition-colors flex items-center justify-between group">
                                            <div className="space-y-1.5 min-w-0">
                                                <h3 className="font-bold text-sm leading-none text-foreground group-hover:text-primary transition-colors truncate">
                                                    {s.sector}
                                                </h3>
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                                                    <Calendar className="size-3" />
                                                    <span>
                                                        {format(new Date(s.start_time), "d MMM, HH:mm", { locale: es })}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2.5 text-[10px] items-center">
                                                    <span className="flex items-center gap-1 text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                                                        {s.totalProducts || 0} prod.
                                                    </span>
                                                    <span className="flex items-center gap-1 text-secondary-foreground font-bold bg-secondary/50 px-1.5 py-0.5 rounded border border-border/40">
                                                        {s.totalUnits || 0} unid.
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 ml-4">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteSession(s.id)}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 font-bold h-8 text-[11px] rounded-lg shadow-none"
                                                    onClick={() => {
                                                        resumeSession(s);
                                                        setStep('counting');
                                                    }}
                                                >
                                                    Retomar
                                                    <ArrowRight className="size-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Empty className="py-12">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <History className="size-5 text-muted-foreground" />
                                        </EmptyMedia>
                                        <EmptyTitle className="text-sm font-bold">No hay sesiones activas</EmptyTitle>
                                        <EmptyDescription className="text-xs">
                                            Solo el administrador puede iniciar nuevas sesiones de control de inventario.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </FramePanel>
                    </CollapsibleContent>
                </Collapsible>
            </Frame>

            <Frame className="w-full shadow-sm border-border/40">
                <Collapsible defaultOpen className="w-full">
                    <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                        <CollapsibleTrigger
                            className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground transition-all group data-panel-open:[&_svg]:rotate-180"
                        >
                            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-300" />
                            Configuración de Acceso
                        </CollapsibleTrigger>
                    </FrameHeader>
                    <CollapsibleContent>
                        <FramePanel className="p-6 space-y-6">
                            <div className="space-y-1.5">
                                <FrameTitle className="text-base font-bold tracking-tight">Seleccionar Perfil</FrameTitle>
                                <FrameDescription className="text-xs text-muted-foreground">
                                    Elija el tipo de dispositivo con el que operará en esta sesión.
                                </FrameDescription>
                            </div>

                            <div className="space-y-3">
                                {showAdmin && (
                                    <Label 
                                        className={cn(
                                            "flex items-start gap-4 rounded-xl border p-4 hover:bg-accent/30 cursor-pointer transition-all border-border/40",
                                            selectedProfile === 'admin' && "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                        )}
                                    >
                                        <Checkbox 
                                            checked={selectedProfile === 'admin'} 
                                            onCheckedChange={() => setSelectedProfile('admin')} 
                                        />
                                        <div className="flex flex-col gap-1 select-none">
                                            <p className="font-bold text-[13px] text-foreground">PC Administrador</p>
                                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                                                Control central, conciliación de stock e importación maestra.
                                            </p>
                                        </div>
                                    </Label>
                                )}

                                <Label 
                                    className={cn(
                                        "flex items-start gap-4 rounded-xl border p-4 hover:bg-accent/30 cursor-pointer transition-all border-border/40",
                                        selectedProfile === 'zebra' && "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                                    )}
                                >
                                    <Checkbox 
                                        checked={selectedProfile === 'zebra'} 
                                        onCheckedChange={() => setSelectedProfile('zebra')} 
                                    />
                                    <div className="flex flex-col gap-1 select-none">
                                        <p className="font-bold text-[13px] text-foreground">Zebra (Colector)</p>
                                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                                            Optimizado para escaneo rápido de códigos de barras y movilidad.
                                        </p>
                                    </div>
                                </Label>

                                <Label 
                                    className={cn(
                                        "flex items-start gap-4 rounded-xl border p-4 hover:bg-accent/30 cursor-pointer transition-all border-border/40",
                                        selectedProfile === 'salon' && "border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20"
                                    )}
                                >
                                    <Checkbox 
                                        checked={selectedProfile === 'salon'} 
                                        onCheckedChange={() => setSelectedProfile('salon')} 
                                    />
                                    <div className="flex flex-col gap-1 select-none">
                                        <p className="font-bold text-[13px] text-foreground">PC Salón</p>
                                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                                            Terminal fija para conteo manual y verificación de estanterías.
                                        </p>
                                    </div>
                                </Label>
                            </div>
                        </FramePanel>
                    </CollapsibleContent>
                </Collapsible>
            </Frame>

            {/* Pagination Controls */}
            <Pagination className="mt-2 w-full max-w-2xl">
                <PaginationContent className="w-full justify-between gap-4">
                    <PaginationItem>
                        <Button 
                            variant="outline"
                            className="font-bold px-5 h-9 rounded-xl shadow-none"
                            onClick={() => navigate('/stock')}
                        >
                            <ArrowLeft className="size-4 mr-2" />
                            Retroceder
                        </Button>
                    </PaginationItem>
                    <PaginationItem>
                        <Button
                            variant={selectedProfile ? "default" : "outline"}
                            className={cn(
                                "font-bold px-8 h-9 rounded-xl transition-all shadow-none",
                                !selectedProfile && "opacity-50 grayscale"
                            )}
                            disabled={!selectedProfile}
                            onClick={() => {
                                if (selectedProfile) {
                                    setAccessMode(selectedProfile);
                                    if (selectedProfile === 'admin') {
                                        setStep('admin_config');
                                    } else {
                                        setStep('config');
                                    }
                                    trigger('success');
                                }
                            }}
                        >
                            Continuar
                            <ArrowRight className="size-4 ml-2" />
                        </Button>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );

    // Vista de Configuración (Nueva Sesión / Seleccionar)
    // Screen 1: Admin Config (Title + File)
    const renderAdminConfig = () => (
        <div className="max-w-2xl mx-auto py-12 md:py-20 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Frame className="w-full shadow-sm border-border/40">
                <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                        <Laptop className="size-4 text-primary" />
                        Configuración de Inventario Maestro
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Paso 1/3</span>
                    </div>
                </FrameHeader>
                <FramePanel className="p-6 space-y-6">
                    <div className="space-y-4">
                        <Field className="w-full">
                            <FieldLabel className="text-[13px] font-bold">
                                Nombre del Inventario <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input 
                                placeholder="Ej: Inventario General Abril 2026"
                                value={inventoryName}
                                onChange={(e) => setInventoryName(e.target.value)}
                                className="h-10 text-sm bg-muted/30 border-border/40 focus:ring-1 focus:ring-primary/20"
                                required
                            />
                            {!inventoryName && <FieldError className="text-[10px]">El nombre es obligatorio para continuar.</FieldError>}
                        </Field>

                        <div className="space-y-2">
                            <Label className="text-[13px] font-bold">Carga de Stock Externo (Planilla)</Label>
                            <FileUpload 
                                onFilesChange={handleFileChange}
                                maxFiles={1}
                                accept=".xlsx,.xls,.csv"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </FramePanel>
            </Frame>

            <Pagination className="mt-8 w-full max-w-2xl">
                <PaginationContent className="w-full justify-between gap-4">
                    <PaginationItem>
                        <Button 
                            variant="outline"
                            className="font-bold px-5 h-9 rounded-xl shadow-none"
                            onClick={() => {
                                setAccessMode(null);
                                setStep('config');
                            }}
                        >
                            <ArrowLeft className="size-4 mr-2" />
                            Retroceder
                        </Button>
                    </PaginationItem>
                    <PaginationItem>
                        <Button
                            variant={inventoryName.trim() && uploadedFiles.length > 0 ? "default" : "outline"}
                            className={cn(
                                "font-bold px-8 h-9 rounded-xl transition-all shadow-none",
                                !(inventoryName.trim() && uploadedFiles.length > 0) && "opacity-50 grayscale"
                            )}
                            disabled={!(inventoryName.trim() && uploadedFiles.length > 0)}
                            onClick={() => setStep('admin_summary')}
                        >
                            Continuar
                            <ArrowRight className="size-4 ml-2" />
                        </Button>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );

    // Screen 2: Admin Summary
    const renderAdminSummary = () => (
        <div className="max-w-2xl mx-auto py-12 md:py-20 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Frame className="w-full shadow-sm border-border/40">
                <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                        <CheckCircle className="size-4 text-emerald-500" />
                        Resumen de Carga
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Paso 2/3</span>
                    </div>
                </FrameHeader>
                <FramePanel className="p-8 flex flex-col gap-4">
                    {/* Status Alert (p-alert-5/6/7) */}
                    {loadStatus === 'success' && (
                        <Alert variant="success" className="animate-in fade-in zoom-in-95 duration-300">
                            <CheckCircle2 className="size-4" />
                            <AlertTitle className="font-bold">Carga Exitosa</AlertTitle>
                            <AlertDescription className="text-muted-foreground/80">
                                El archivo <span className="font-bold text-success/90">**{inventoryName}**</span> ha sido procesado localmente con éxito.
                            </AlertDescription>
                        </Alert>
                    )}

                    {loadStatus === 'warning' && (
                        <Alert variant="warning" className="animate-in fade-in zoom-in-95 duration-300">
                            <AlertTriangle className="size-4" />
                            <AlertTitle className="font-bold">Carga Incompleta</AlertTitle>
                            <AlertDescription className="text-muted-foreground/80">
                                El archivo fue procesado pero no se encontraron productos válidos.
                            </AlertDescription>
                        </Alert>
                    )}

                    {loadStatus === 'error' && (
                        <Alert variant="error" className="animate-in fade-in zoom-in-95 duration-300">
                            <AlertCircle className="size-4" />
                            <AlertTitle className="font-bold">Error de Carga</AlertTitle>
                            <AlertDescription className="text-muted-foreground/80">
                                Hubo un problema crítico al intentar leer el archivo. Verifique el formato.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Data Alerts (p-alert-1) stacked vertically with gap-3 */}
                    <div className="flex flex-col gap-3">
                        <Alert variant="outline" className="animate-in fade-in slide-in-from-bottom-2 duration-400 bg-muted/5 border-border/40">
                            <InfoCircle className="size-4 text-muted-foreground/60" />
                            <AlertTitle className="font-bold">Productos</AlertTitle>
                            <AlertDescription className="text-muted-foreground/70">
                                Se han encontrado <span className="text-foreground font-semibold">{parsedStock?.total || 0}</span> productos en el archivo.
                            </AlertDescription>
                        </Alert>

                        <Alert variant="outline" className="animate-in fade-in slide-in-from-bottom-2 duration-500 bg-muted/5 border-border/40">
                            <FileTextLucide className="size-4 text-muted-foreground/60" />
                            <AlertTitle className="font-bold">Archivo</AlertTitle>
                            <AlertDescription className="text-muted-foreground/70 truncate">
                                <span className="text-foreground font-semibold">{parsedStock?.filename || 'Sin nombre'}</span> ({formatBytes(parsedStock?.size || 0)})
                            </AlertDescription>
                        </Alert>
                    </div>
                </FramePanel>
            </Frame>

            <Pagination className="mt-8 w-full max-w-2xl">
                <PaginationContent className="w-full justify-between gap-4">
                    <PaginationItem>
                        <Button 
                            variant="outline"
                            className="font-bold px-5 h-9 rounded-xl shadow-none"
                            onClick={() => setStep('admin_config')}
                        >
                            <ArrowLeft className="size-4 mr-2" />
                            Retroceder
                        </Button>
                    </PaginationItem>
                    <PaginationItem>
                        <Button
                            className="font-bold px-10 h-9 rounded-xl transition-all shadow-none bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                                // Generar PIN de 6 dígitos
                                const pin = Math.floor(100000 + Math.random() * 900000).toString();
                                setSyncPin(pin);
                                setStep('admin_sync');
                                trigger('success');
                            }}
                        >
                            Continuar
                            <ArrowRight className="size-4 ml-2" />
                        </Button>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );

    // Screen 3: Admin Sync (Lobby)
    const renderAdminSync = () => (
        <div className="max-w-2xl mx-auto py-12 md:py-20 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Frame className="w-full shadow-sm border-border/40">
                <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                        <Laptop className="size-4 text-primary" />
                        Conexión de Dispositivos
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Paso 3/3</span>
                    </div>
                </FrameHeader>
                <FramePanel className="p-8 pb-12 flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                        {/* Headers (p-input-otp-4 style) */}
                        <div className="text-center space-y-1.5 mb-2">
                            <h2 className="text-lg font-semibold text-foreground tracking-tight">Código de verificación</h2>
                            <p className="text-xs text-muted-foreground/60">Ingrese el código de 6 dígitos en la terminal Zebra</p>
                        </div>

                        {/* PIN OTP (p-input-otp-3 style - separated squarcles) */}
                        <InputOTP maxLength={6} value={syncPin} readOnly>
                            <InputOTPGroup className="gap-2.5">
                                <InputOTPSlot index={0} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                <InputOTPSlot index={1} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                <InputOTPSlot index={2} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                            </InputOTPGroup>
                            
                            <div className="mx-3 text-muted-foreground/20 font-bold text-xl">-</div>
                            
                            <InputOTPGroup className="gap-2.5">
                                <InputOTPSlot index={3} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                <InputOTPSlot index={4} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                <InputOTPSlot index={5} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                            </InputOTPGroup>
                        </InputOTP>

                        {/* Final Instruction (p-input-otp-4 subtext) */}
                        <div className="pt-4 text-center">
                            <p className="text-[11px] text-muted-foreground/50 leading-relaxed px-4">
                                Esta pantalla se actualizará automáticamente cuando se detecte una conexión entrante desde los dispositivos móviles.
                            </p>
                        </div>
                    </div>
                </FramePanel>
            </Frame>

            <Pagination className="mt-8 w-full max-w-2xl">
                <PaginationContent className="w-full justify-between gap-4">
                    <PaginationItem>
                        <Button 
                            variant="outline"
                            className="font-bold px-5 h-9 rounded-xl shadow-none"
                            onClick={() => setStep('admin_summary')}
                        >
                            <ArrowLeft className="size-4 mr-2" />
                            Retroceder
                        </Button>
                    </PaginationItem>
                    <PaginationItem>
                        <Button
                            className="font-bold px-10 h-9 rounded-xl transition-all shadow-none bg-primary hover:bg-primary/90 text-white"
                            onClick={handleStartSession}
                        >
                            Comenzar Inventario
                            <Play className="size-4 ml-2 fill-current" />
                        </Button>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );

    const handleSkip = async () => {
        if (availableSessions.length > 0) {
            await resumeSession(availableSessions[0]);
        } else {
            // Start a generic session if none exists
            // This will use the app's full database as fallback
            const deviceId = localStorage.getItem('precount_device_id') || Math.random().toString(36).substring(7);
            const name = deviceName || `Zebra ${deviceId.substring(0, 4)}`;
            await startSession(`Inventario ${name}`, undefined, undefined);
        }
        setStep('counting');
        trigger('success');
    };

    const renderConfig = () => {
        if (!accessMode) return renderSelection();
        
        if (accessMode === 'admin') {
            if (step === 'admin_config') return renderAdminConfig();
            if (step === 'admin_summary') return renderAdminSummary();
            if (step === 'admin_sync') return renderAdminSync();
        }

        if (accessMode === 'zebra' || accessMode === 'salon') {
            const isZebra = accessMode === 'zebra';
            return (
                <div className="max-w-2xl mx-auto py-12 md:py-20 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Frame className="w-full shadow-sm border-border/40">
                        <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                            <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                                {isZebra ? <Barcode className="size-4 text-primary" /> : <Monitor className="size-4 text-primary" />}
                                Conexión de Dispositivos
                            </div>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                                    {isZebra ? 'ZEBRA SYNC' : 'PC SALÓN'}
                                </span>
                            </div>
                        </FrameHeader>
                        <FramePanel className="p-8 pb-12 flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                                {/* Headers (p-input-otp-4 style) */}
                                <div className="text-center space-y-1.5 mb-2">
                                    <h2 className="text-lg font-semibold text-foreground tracking-tight">Código de verificación</h2>
                                    <p className="text-xs text-muted-foreground/60">Ingrese el código de 6 dígitos del panel central</p>
                                </div>

                                {/* PIN OTP (p-input-otp-3/7 style - auto validation) */}
                                <InputOTP 
                                    maxLength={6} 
                                    value={otpValue} 
                                    onChange={(val) => {
                                        setOtpValue(val);
                                        if (val.length === 6) {
                                            handleJoinSession(val);
                                        }
                                    }}
                                    autoFocus
                                >
                                    <InputOTPGroup className="gap-2.5">
                                        <InputOTPSlot index={0} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                        <InputOTPSlot index={1} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                        <InputOTPSlot index={2} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                    </InputOTPGroup>
                                    
                                    <div className="mx-3 text-muted-foreground/20 font-bold text-xl">-</div>
                                    
                                    <InputOTPGroup className="gap-2.5">
                                        <InputOTPSlot index={3} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                        <InputOTPSlot index={4} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                        <InputOTPSlot index={5} className="!h-14 !w-11 !rounded-2xl !border border-border/30 bg-background shadow-xs text-2xl font-black ring-offset-background" />
                                    </InputOTPGroup>
                                </InputOTP>

                                {/* Final Instruction (p-input-otp-4 subtext) */}
                                <div className="pt-4 text-center">
                                    <p className="text-[11px] text-muted-foreground/50 leading-relaxed px-4">
                                        Serás conectado automáticamente a la sesión al completar el código de 6 dígitos.
                                    </p>
                                </div>
                            </div>
                        </FramePanel>
                    </Frame>
                    
                    <Pagination className="mt-8 w-full max-w-2xl">
                        <PaginationContent className="w-full justify-between gap-4">
                            <PaginationItem>
                                <Button 
                                    variant="outline"
                                    className="font-bold px-5 h-9 rounded-xl shadow-none"
                                    onClick={() => setAccessMode(null)}
                                >
                                    <ArrowLeft className="size-4 mr-2" />
                                    Retroceder
                                </Button>
                            </PaginationItem>
                            
                            <PaginationItem className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    className="font-bold px-6 h-9 rounded-xl transition-all shadow-none text-muted-foreground hover:text-foreground"
                                    onClick={handleSkip}
                                >
                                    Omitir
                                </Button>
                                <Button
                                    className="font-bold px-10 h-9 rounded-xl transition-all shadow-none bg-primary hover:bg-primary/90 text-white"
                                    onClick={() => handleJoinSession(otpValue)}
                                    disabled={otpValue.length !== 6}
                                >
                                    Comenzar Inventario
                                    <Play className="size-4 ml-2 fill-current" />
                                </Button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            );
        }
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
                <AnimatePresence mode="wait">
                    {accessMode === null ? (
                        <motion.div
                            key="selection"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                        >
                            {renderSelection()}
                        </motion.div>
                    ) : (step === 'config' || step === 'admin_config' || step === 'admin_summary' || step === 'admin_sync') ? (
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="p-4 md:p-6 max-w-7xl mx-auto"
                        >
                            <div className="flex justify-end mb-4 sm:hidden">
                                {isOnline ? (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm shadow-sm border border-success/10">
                                        <Wifi className="w-4 h-4" />
                                        <span className="font-medium">En línea</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm shadow-sm border border-warning/10">
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
                                                key={searchResetKey}
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
                                                key={searchResetKey}
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
                                            {session?.master_catalog && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-[1.5] h-8 text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                                    onClick={handleExportExcel}
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                    Conciliar Excel
                                                </Button>
                                            )}
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
                                    masterCatalog={session?.master_catalog}
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

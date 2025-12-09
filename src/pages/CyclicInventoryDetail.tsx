import { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, FileSpreadsheet, Download, Save, Search, Info, ScanBarcode, Trash2, ChevronLeft, ChevronRight, Loader2, TrendingUp, TrendingDown, DollarSign, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { CyclicInventoryList, CyclicItem } from '@/components/CyclicInventoryList';
import { CounterAnimation } from '@/components/CounterAnimation';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from '@/components/BarcodeScanner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Onboarding } from '@/components/Onboarding';
import { FabMenu, FabAction } from '@/components/FabMenu';
import { cn } from '@/lib/utils';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { useUser } from '@/contexts/UserContext';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

export default function CyclicInventoryDetail() {
    const { id } = useParams(); // This will be the Lab Name
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [items, setItems] = useState<CyclicItem[]>([]);
    const [labName, setLabName] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState("");
    const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);

    const [currentCategory, setCurrentCategory] = useState<string>(CATEGORIES[0]);
    const { user } = useUser();
    const branchName = user?.branchName || 'Sucursal Desconocida';

    // Save Dialog State
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [shortageId, setShortageId] = useState("");
    const [surplusId, setSurplusId] = useState("");

    useEffect(() => {
        if (id) {
            setLabName(decodeURIComponent(id));
        }
    }, [id]);

    // Load from Supabase on mount
    useEffect(() => {
        const loadData = async () => {
            if (labName) {
                setIsLoading(true);
                try {
                    const data = await cyclicInventoryService.getLabInventory(branchName, labName);
                    setItems(data);
                } catch (error) {
                    console.error("Failed to load inventory:", error);
                    toast.error("Error al cargar el inventario desde la nube.");
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadData();
    }, [labName]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Filter by search term
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (!item.name.toLowerCase().includes(search) && !item.ean.includes(search)) {
                    return false;
                }
            }

            // Filter by differences
            if (showDifferencesOnly) {
                return item.countedQuantity !== item.systemQuantity;
            }

            return true;
        });
    }, [items, searchTerm, showDifferencesOnly]);

    // Filter pending items by CURRENT CATEGORY
    const pendingItems = useMemo(() => filteredItems.filter(i =>
        i.status === 'pending' &&
        (i.category === currentCategory || (!i.category && currentCategory === "Varios")) // Default to Varios if no category
    ), [filteredItems, currentCategory]);

    // Controlled and Adjusted items are GLOBAL (as per user request "remain in all pages")
    const sortItemsByDifference = (items: CyclicItem[]) => {
        return [...items].sort((a, b) => {
            const diffA = a.countedQuantity - a.systemQuantity;
            const diffB = b.countedQuantity - b.systemQuantity;

            const isDiffA = diffA !== 0;
            const isDiffB = diffB !== 0;

            // 1. Items with differences go first
            if (isDiffA && !isDiffB) return -1;
            if (!isDiffA && isDiffB) return 1;

            // 2. If both have differences (or both don't), sort by difference value
            return diffA - diffB;
        });
    };

    const controlledItems = useMemo(() => sortItemsByDifference(filteredItems.filter(i => i.status === 'controlled')), [filteredItems]);
    const adjustedItems = useMemo(() => sortItemsByDifference(filteredItems.filter(i => i.status === 'adjusted')), [filteredItems]);

    // Financial Stats Calculation
    const financialStats = useMemo(() => {
        let negative = 0;
        let positive = 0;
        let net = 0;

        items.forEach(item => {
            const diff = item.countedQuantity - item.systemQuantity;
            const value = diff * item.cost;

            if (diff < 0) negative += value;
            else if (diff > 0) positive += value;

            net += value;
        });

        return { negative, positive, net };
    }, [items]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Start with existing items to preserve history
                const finalItems: CyclicItem[] = [...items];

                // Track EANs that are currently active OR adjusted to avoid duplicates
                const existingEans = new Set(items.map(i => i.ean));

                // Process file data
                let addedCount = 0;
                let ignoredCount = 0;

                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row || !row[3]) continue;

                    const ean = row[2]?.toString().trim();
                    if (!ean) continue;

                    if (existingEans.has(ean)) {
                        ignoredCount++;
                        continue;
                    }

                    // Parse Category from Column J (Index 9)
                    let category = row[9]?.toString().trim();

                    // Normalize Category
                    if (category) {
                        if (category === "Medicamento") category = "Medicamentos";
                        if (category === "Perfumeria") category = "Perfumería";
                    }

                    if (!category || !CATEGORIES.includes(category)) category = "Varios";

                    // Add new item
                    finalItems.push({
                        id: crypto.randomUUID(),
                        ean: ean,
                        name: row[3],
                        systemQuantity: Number(row[4]) || 0,
                        countedQuantity: Number(row[4]) || 0,
                        cost: Number(row[12]) || 0,
                        status: 'pending',
                        category: category
                    });

                    existingEans.add(ean);
                    addedCount++;
                }

                setItems(finalItems);

                if (ignoredCount > 0) {
                    toast.success(`Procesado. ${addedCount} nuevos, ${ignoredCount} ignorados (ya existentes/ajustados).`);
                } else {
                    toast.success(`Archivo procesado. Se agregaron ${addedCount} items nuevos.`);
                }

            } catch (error) {
                console.error("Error reading file:", error);
                toast.error('Error al procesar el archivo Excel.');
            } finally {
                setIsLoading(false);
                e.target.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleUpdateQuantity = useCallback((id: string, quantity: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const diff = quantity - item.systemQuantity;
                if (diff !== 0 && navigator.vibrate) {
                    navigator.vibrate([50, 50, 50]);
                } else if (navigator.vibrate) {
                    navigator.vibrate(50);
                }

                return {
                    ...item,
                    countedQuantity: quantity,
                    status: 'controlled'
                };
            }
            return item;
        }));
    }, []);


    const handleCheck = useCallback((id: string) => {
        if (navigator.vibrate) navigator.vibrate(50);

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        setItems(prev => prev.map(item =>
            item.id === id
                ? { ...item, status: 'controlled', countedQuantity: item.systemQuantity }
                : item
        ));
        toast.success('Producto controlado');
    }, []);

    const handleRevertItem = useCallback((id: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, status: 'pending' } : item
        ));
        toast.info('Producto devuelto a pendientes');
    }, []);

    const handleSaveProgress = async () => {
        setIsSaving(true);
        try {
            await cyclicInventoryService.saveInventory(branchName, labName, items);
            toast.success("Progreso guardado en la nube.");
        } catch (error) {
            console.error("Error saving progress:", error);
            toast.error("Error al guardar el progreso.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveInventory = async () => {
        // Calculate totals for validation
        const shortages = controlledItems.filter(i => i.countedQuantity < i.systemQuantity);
        const surpluses = controlledItems.filter(i => i.countedQuantity > i.systemQuantity);

        const hasShortages = shortages.length > 0;
        const hasSurpluses = surpluses.length > 0;

        if (hasShortages && !shortageId.trim()) {
            toast.error("Por favor ingresa el ID de ajuste para Faltantes");
            return;
        }

        if (hasSurpluses && !surplusId.trim()) {
            toast.error("Por favor ingresa el ID de ajuste para Sobrantes");
            return;
        }

        setIsSaving(true);
        try {
            // Update status of controlled items to adjusted, BUT KEEP pending items
            const updatedItems = items.map(item => {
                if (item.status === 'controlled') {
                    return { ...item, status: 'adjusted' as const };
                }
                return item;
            });

            setItems(updatedItems);

            // Save to Cloud
            await cyclicInventoryService.saveInventory(branchName, labName, updatedItems);

            toast.success("Inventario finalizado y guardado en la nube.");
            setShowSaveDialog(false);
            setShortageId("");
            setSurplusId("");
            navigate('/cyclic-inventory'); // Navigate back after finalize

        } catch (error) {
            console.error("Error saving inventory:", error);
            toast.error("Error al guardar en la nube.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeClick = async () => {
        // First save current progress
        await handleSaveProgress();
        // Then open dialog
        setShowSaveDialog(true);
    };

    // Calculate values for the dialog
    const shortageValue = controlledItems
        .filter(i => i.countedQuantity < i.systemQuantity)
        .reduce((acc, i) => acc + ((i.systemQuantity - i.countedQuantity) * i.cost), 0);

    const surplusValue = controlledItems
        .filter(i => i.countedQuantity > i.systemQuantity)
        .reduce((acc, i) => acc + ((i.countedQuantity - i.systemQuantity) * i.cost), 0);

    const handleExportExcel = () => {
        const exportData = items.map(item => ({
            'EAN': item.ean,
            'Producto': item.name,
            'Laboratorio': labName,
            'Rubro': item.category || 'Varios',
            'Cantidad Sistema': item.systemQuantity,
            'Cantidad Física': item.countedQuantity,
            'Diferencia': item.countedQuantity - item.systemQuantity,
            'Costo': item.cost,
            'Estado': item.status === 'controlled' ? 'CONTROLADO' : (item.status === 'adjusted' ? 'AJUSTADO' : 'PENDIENTE')
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        XLSX.writeFile(wb, `Inventario_${labName}.xlsx`);
        toast.success('Excel generado');
    };

    const [showScanner, setShowScanner] = useState(false);

    const handleScan = useCallback((code: string) => {
        const item = items.find(i => i.ean === code);
        if (item) {
            handleUpdateQuantity(item.id, item.countedQuantity + 1);
            toast.success(`Producto encontrado: ${item.name}`);
        } else {
            toast.error(`Producto no encontrado: ${code}`);
        }
    }, [items, handleUpdateQuantity]);

    const handleBatchScan = useCallback((codes: string[]) => {
        let foundCount = 0;
        let notFoundCount = 0;

        // Create a map of updates to apply all at once
        const updates = new Map<string, number>();

        // Pre-fill with current quantities
        items.forEach(i => updates.set(i.id, i.countedQuantity));

        codes.forEach(code => {
            const item = items.find(i => i.ean === code);
            if (item) {
                const currentQty = updates.get(item.id) || 0;
                updates.set(item.id, currentQty + 1);
                foundCount++;
            } else {
                notFoundCount++;
            }
        });

        if (foundCount > 0) {
            setItems(prev => prev.map(item => {
                if (updates.has(item.id)) {
                    const newQty = updates.get(item.id)!;
                    if (newQty !== item.countedQuantity) {
                        return { ...item, countedQuantity: newQty, status: 'controlled' };
                    }
                }
                return item;
            }));
            toast.success(`Procesados ${foundCount} items correctamente.`);
        }

        if (notFoundCount > 0) {
            toast.warning(`${notFoundCount} códigos no encontrados.`);
        }
    }, [items]);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Inventario Cíclico: ${labName}`, 10, 10);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 10, 18);

        let y = 30;
        const lineHeight = 10;
        const pageHeight = doc.internal.pageSize.height;

        // Headers
        doc.setFont("helvetica", "bold");
        doc.text("Producto", 10, y);
        doc.text("Rubro", 80, y);
        doc.text("Sistema", 100, y);
        doc.text("Físico", 130, y);
        doc.text("Dif", 160, y);
        doc.text("Estado", 180, y);
        y += lineHeight;
        doc.setFont("helvetica", "normal");

        items.forEach(item => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
            }

            const diff = item.countedQuantity - item.systemQuantity;
            doc.text(item.name.substring(0, 35), 10, y);
            doc.text((item.category || 'Varios').substring(0, 15), 80, y);
            doc.text(item.systemQuantity.toString(), 100, y);
            doc.text(item.countedQuantity.toString(), 130, y);

            doc.setTextColor(diff === 0 ? 0 : 255, 0, 0); // Red if diff
            doc.text(diff.toString(), 160, y);
            doc.setTextColor(0);

            doc.text(item.status === 'controlled' ? 'OK' : (item.status === 'adjusted' ? 'Ajust' : 'Pend'), 180, y);
            y += lineHeight;
        });

        doc.save(`Inventario_${labName}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Reporte PDF generado');
    };

    const handleResetData = async () => {
        if (confirm("¿Estás seguro de que quieres reiniciar los datos de este laboratorio? Se borrarán de la nube.")) {
            try {
                await cyclicInventoryService.deleteInventory(branchName, labName);
                setItems([]);
                toast.success("Datos reiniciados correctamente.");
                navigate('/cyclic-inventory');
            } catch (error) {
                console.error("Error resetting data:", error);
                toast.error("Error al reiniciar datos.");
            }
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-32 lg:pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/cyclic-inventory')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{labName}</h1>
                        <p className="text-muted-foreground text-sm">Control de Inventario Cíclico</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Onboarding />
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Cargando inventario desde la nube...</p>
                </div>
            ) : (
                <>
                    {/* Upload Section (if empty) */}
                    {items.length === 0 ? (
                        <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 bg-muted/20">
                            <div className="p-4 bg-primary/10 rounded-full">
                                <Upload className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Cargar Archivo de Inventario</h3>
                                <p className="text-muted-foreground max-w-md mx-auto mt-2">
                                    Sube el archivo Excel (.xlsx) descargado del sistema para comenzar el control de {labName}.
                                </p>
                            </div>
                            <div className="relative">
                                <Button disabled={isLoading}>
                                    {isLoading ? 'Procesando...' : 'Seleccionar Archivo'}
                                </Button>
                                <Input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                    disabled={isLoading}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                                Columnas requeridas: C (EAN), D (Producto), E (Cantidad), O (Laboratorio), J (Rubro)
                            </p>
                        </Card>
                    ) : (
                        /* Inventory Lists */
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Stats Cards */}
                            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="p-4 flex flex-col items-center justify-center bg-warning/5 border-warning/20">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Pendientes</span>
                                    <span className="text-2xl font-bold text-warning">
                                        <CounterAnimation value={items.filter(i => i.status === 'pending').length} />
                                    </span>
                                </Card>
                                <Card className="p-4 flex flex-col items-center justify-center bg-success/5 border-success/20">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Controlados</span>
                                    <span className="text-2xl font-bold text-success">
                                        <CounterAnimation value={items.filter(i => i.status === 'controlled').length} />
                                    </span>
                                </Card>
                                <Card className="p-4 flex flex-col items-center justify-center bg-blue-500/5 border-blue-500/20">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Ajustados</span>
                                    <span className="text-2xl font-bold text-blue-500">
                                        <CounterAnimation value={items.filter(i => i.status === 'adjusted').length} />
                                    </span>
                                </Card>
                                <Card className="p-4 flex flex-col items-center justify-center">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Avance</span>
                                    <span className="text-2xl font-bold">
                                        <CounterAnimation value={Math.round((items.filter(i => i.status === 'controlled' || i.status === 'adjusted').length / items.length) * 100)} />%
                                    </span>
                                </Card>
                            </div>

                            {/* Main Content */}
                            <div className="lg:col-span-3">
                                <div className="flex flex-col md:flex-row gap-4 mb-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                        <Input
                                            placeholder="Buscar por nombre o EAN..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border">
                                        <Switch
                                            id="diff-mode"
                                            checked={showDifferencesOnly}
                                            onCheckedChange={setShowDifferencesOnly}
                                        />
                                        <Label htmlFor="diff-mode" className="cursor-pointer">Solo Diferencias</Label>
                                    </div>
                                    <div className="flex gap-2 ml-auto">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleResetData}
                                        >
                                            <Trash2 className="w-4 h-4 lg:mr-2" />
                                            <span className="hidden lg:inline">Reiniciar</span>
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleFinalizeClick}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                            disabled={isSaving}
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                            Finalizar Inventario
                                        </Button>
                                    </div>
                                </div>
                                {/* Category Tabs (Rubros) */}
                                <div className="mb-6 overflow-x-auto pb-2">
                                    <div className="flex gap-2">
                                        {CATEGORIES.map(cat => (
                                            <Button
                                                key={cat}
                                                variant={currentCategory === cat ? "default" : "outline"}
                                                onClick={() => setCurrentCategory(cat)}
                                                className={cn(
                                                    "rounded-full px-6 transition-all",
                                                    currentCategory === cat ? "shadow-md" : "opacity-70 hover:opacity-100"
                                                )}
                                            >
                                                {cat}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Tabs defaultValue="pending" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 mb-4">
                                        <TabsTrigger value="pending" className="relative">
                                            Pendientes ({currentCategory})
                                            {pendingItems.length > 0 && (
                                                <span className="ml-2 bg-warning text-warning-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {pendingItems.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger value="controlled">
                                            Controlados
                                            {controlledItems.length > 0 && (
                                                <span className="ml-2 bg-success text-success-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {controlledItems.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger value="adjusted">
                                            Ajustados
                                            {adjustedItems.length > 0 && (
                                                <span className="ml-2 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {adjustedItems.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="pending" className="space-y-4">
                                        <Alert className="bg-muted/50 border-none mb-4">
                                            <Info className="h-4 w-4" />
                                            <AlertTitle>Instrucciones</AlertTitle>
                                            <AlertDescription>
                                                Desliza a la derecha para confirmar (verde) o a la izquierda para reportar diferencia (naranja).
                                            </AlertDescription>
                                        </Alert>
                                        <CyclicInventoryList
                                            items={pendingItems}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
                                        />
                                    </TabsContent>

                                    <TabsContent value="controlled" className="space-y-4">
                                        <CyclicInventoryList
                                            items={controlledItems}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
                                            onRevert={handleRevertItem}
                                            readOnly={false}
                                        />
                                    </TabsContent>

                                    <TabsContent value="adjusted" className="space-y-4">
                                        <CyclicInventoryList
                                            items={adjustedItems}
                                            onUpdateQuantity={() => { }} // Read only mostly
                                            onCheck={() => { }}
                                            readOnly={true}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Save Dialog */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Finalizar Inventario</DialogTitle>
                        <DialogDescription>
                            Ingresa el ID del ajuste generado en PLEX para guardar el estado de este inventario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        {/* Shortages Section */}
                        <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/10">
                            <div className="flex justify-between items-center">
                                <Label className="text-destructive font-bold">Faltantes (Negativos)</Label>
                                <span className="font-mono font-bold text-destructive">
                                    ${shortageValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <Input
                                value={shortageId}
                                onChange={(e) => setShortageId(e.target.value)}
                                placeholder="ID Ajuste Faltantes (PLEX)"
                            />
                        </div>

                        {/* Surpluses Section */}
                        <div className="space-y-2 p-4 bg-success/5 rounded-lg border border-success/10">
                            <div className="flex justify-between items-center">
                                <Label className="text-success font-bold">Sobrantes (Positivos)</Label>
                                <span className="font-mono font-bold text-success">
                                    ${surplusValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <Input
                                value={surplusId}
                                onChange={(e) => setSurplusId(e.target.value)}
                                placeholder="ID Ajuste Sobrantes (PLEX)"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancelar</Button>
                        <Button onClick={handleSaveInventory} disabled={isSaving}>
                            {isSaving ? 'Guardando...' : 'Guardar y Finalizar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <BarcodeScanner
                open={showScanner}
                onOpenChange={setShowScanner}
                onScan={handleScan}
                onBatchScan={handleBatchScan}
            />

            {items.length > 0 && (
                <FabMenu
                    actions={[
                        {
                            label: 'Finalizar',
                            icon: <CheckCircle2 className="w-5 h-5" />,
                            onClick: handleFinalizeClick,
                            variant: 'default',
                            color: 'bg-primary text-primary-foreground'
                        },
                        {
                            label: 'Exportar PDF',
                            icon: <Download className="w-5 h-5" />,
                            onClick: handleExportPDF,
                            variant: 'secondary'
                        },
                        {
                            label: 'Exportar Excel',
                            icon: <FileSpreadsheet className="w-5 h-5" />,
                            onClick: handleExportExcel,
                            variant: 'secondary',
                            color: 'text-green-600'
                        },
                        {
                            label: 'Escanear',
                            icon: <ScanBarcode className="w-5 h-5" />,
                            onClick: () => setShowScanner(true),
                            variant: 'secondary'
                        },
                        {
                            label: 'Cargar Excel',
                            icon: <Upload className="w-5 h-5" />,
                            onClick: () => document.getElementById('fab-upload-input')?.click(),
                            variant: 'secondary'
                        }
                    ]}
                />
            )}
            {/* Hidden Input for FAB Upload */}
            <input
                id="fab-upload-input"
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isLoading}
            />
        </div>
    );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Search, Info, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { CyclicInventoryList, CyclicItem } from '@/components/CyclicInventoryList';
import { CounterAnimation } from '@/components/CounterAnimation';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Onboarding } from '@/components/Onboarding';
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

    // History State (Moved here as per fix)
    const [history, setHistory] = useState<any[]>([]);

    // Fetch History
    useEffect(() => {
        if (branchName && labName) {
            cyclicInventoryService.getAdjustmentHistory(branchName, labName).then(setHistory);
        }
    }, [branchName, labName]);

    useEffect(() => {
        if (id) {
            setLabName(decodeURIComponent(id));
        }
    }, [id]);

    // Load from Supabase on mount
    // Load from Supabase on mount
    useEffect(() => {
        if (labName && branchName !== 'Sucursal Desconocida') {
            const loadData = async () => {
                setIsLoading(true);
                try {
                    const data = await cyclicInventoryService.getLabInventory(branchName, labName);
                    // Only set items if we actually got data to prevent overwriting with empty
                    if (data && data.length > 0) {
                        setItems(data);
                    }
                } catch (error) {
                    console.error("Failed to load inventory:", error);
                    toast.error("Error al cargar el inventario desde la nube.");
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        }
    }, [labName, branchName]);

    // Auto-Save Effect
    useEffect(() => {
        // Don't auto-save if empty or offline/unknown branch
        if (items.length === 0 || !labName || branchName === 'Sucursal Desconocida') return;

        const timeoutId = setTimeout(() => {
            // Save quietly
            cyclicInventoryService.saveInventory(branchName, labName, items)
                .then(() => console.log('Auto-saved'))
                .catch(err => console.error('Auto-save error', err));
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [items, branchName, labName]);

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

    // Controlled and Adjusted items are GLOBAL
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

                // Start with existing items
                const finalItems: CyclicItem[] = [...items];

                // Create a Map to check existing items
                const eanMap = new Map();
                finalItems.forEach((item, index) => {
                    eanMap.set(String(item.ean).trim(), index);
                });

                // Process file data
                let addedCount = 0;
                let updatedCount = 0;
                let ignoredCount = 0;

                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    // Verify row data
                    if (!row || !row[3]) continue;

                    // Parse EAN
                    const rawEan = row[2];
                    if (!rawEan) continue;

                    const ean = String(rawEan).trim();
                    if (!ean) continue;

                    // Parse Category
                    let category = row[9]?.toString().trim();
                    if (category) {
                        if (category === "Medicamento") category = "Medicamentos";
                        if (category === "Perfumeria") category = "Perfumería";
                    }
                    if (!category || !CATEGORIES.includes(category)) category = "Varios";

                    // LOGIC: 
                    // 1. If item is ADJUSTED -> Ignore (don't overwrite finished work).
                    // 2. If item is PENDING or CONTROLLED -> Update it (in case Excel has corrections).
                    // 3. If item is NEW -> Add it.

                    if (eanMap.has(ean)) {
                        const index = eanMap.get(ean);
                        const existingItem = finalItems[index];

                        if (existingItem.status === 'adjusted') {
                            ignoredCount++;
                        } else {
                            // Update existing non-adjusted item
                            // Reset countedQuantity to match the new system quantity to avoid "false" differences
                            finalItems[index] = {
                                ...existingItem,
                                name: row[3],
                                systemQuantity: Number(row[4]) || 0,
                                countedQuantity: Number(row[4]) || 0, // Reset to match system
                                cost: Number(row[12]) || 0,
                                category: category
                            };
                            updatedCount++;
                        }
                        continue;
                    }

                    // Add new item as Pending
                    finalItems.push({
                        id: crypto.randomUUID(),
                        ean: ean,
                        name: row[3],
                        systemQuantity: Number(row[4]) || 0,
                        countedQuantity: Number(row[4]) || 0, // Default to system quantity (no diff)
                        cost: Number(row[12]) || 0,
                        status: 'pending',
                        category: category,
                        wasReadjusted: false
                    });
                    addedCount++;
                }

                setItems(finalItems);

                // Save immediately
                cyclicInventoryService.saveInventory(branchName, labName, finalItems)
                    .then(() => console.log("Auto-save after upload success"))
                    .catch(err => console.error("Auto-save failed", err));

                if (addedCount > 0 || updatedCount > 0) {
                    toast.success(`Carga exitosa: ${addedCount} nuevos, ${updatedCount} actualizados.`);
                } else {
                    toast.info(`Sin cambios: ${ignoredCount} productos ya estaban ajustados.`);
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

                // Logic: 
                // If it was ALREADY adjusted (finalized previously), then this is a RE-ADJUSTMENT -> set flag.
                // If it is just 'controlled' (in process), it's a normal correction -> NO flag.
                const isReadjustment = item.status === 'adjusted';

                return {
                    ...item,
                    countedQuantity: quantity,
                    // If it was adjusted, keep it adjusted. If pending, make it controlled.
                    status: item.status === 'adjusted' ? 'adjusted' : 'controlled',
                    wasReadjusted: isReadjustment ? true : item.wasReadjusted
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

            // Save History Log
            await cyclicInventoryService.saveAdjustmentHistory(branchName, labName, {
                adjustment_id_shortage: shortageId,
                adjustment_id_surplus: surplusId,
                shortage_value: shortageValue,
                surplus_value: surplusValue,
                total_units_adjusted: controlledItems.length,
                user_name: user?.name,
            });

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
                                        <div className="relative">
                                            <Button variant="outline" size="sm" onClick={() => document.getElementById('header-upload-input')?.click()}>
                                                <Upload className="w-4 h-4 lg:mr-2" />
                                                <span className="hidden lg:inline">Cargar Excel</span>
                                            </Button>
                                            <input
                                                id="header-upload-input"
                                                type="file"
                                                accept=".xlsx, .xls"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={isLoading}
                                            />
                                        </div>
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
                                    <TabsList className="grid w-full grid-cols-4 mb-4">
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
                                        <TabsTrigger value="history">
                                            Historial
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
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={() => { }} // No check needed for adjusted
                                            readOnly={false} // Enable editing for readjustments
                                        />
                                    </TabsContent>

                                    <TabsContent value="history" className="space-y-4">
                                        {history.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                                                No hay historial de ajustes para este laboratorio.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {history.map((h: any) => (
                                                    <Card key={h.id} className="p-4 flex flex-col gap-2">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="text-sm font-bold text-primary">
                                                                    {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">Por: {h.user_name || 'Desconocido'}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                                                    {h.total_units_adjusted} items
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                                            <div className="bg-destructive/10 p-2 rounded border border-destructive/20">
                                                                <span className="font-semibold text-destructive block">Faltantes</span>
                                                                ID: {h.adjustment_id_shortage || '-'}
                                                                <div className="font-mono mt-1">${Number(h.shortage_value).toLocaleString()}</div>
                                                            </div>
                                                            <div className="bg-success/10 p-2 rounded border border-success/20">
                                                                <span className="font-semibold text-success block">Sobrantes</span>
                                                                ID: {h.adjustment_id_surplus || '-'}
                                                                <div className="font-mono mt-1">${Number(h.surplus_value).toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
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
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveInventory} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirmar y Finalizar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

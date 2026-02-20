import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, Info, Loader2, CheckCircle2, RotateCcw, DollarSign, ClipboardList, ArrowLeft } from 'lucide-react';
import { CyclicInventoryList } from '@/components/CyclicInventoryList';
import { AnimatedCounter } from '@/components/AnimatedCounter';
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
import { FabMenu } from '@/components/FabMenu';
import { DeleteConfirmationDialog } from '@/components/cyclic/DeleteConfirmationDialog';
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";

// Hooks & Components
import { useCyclicInventoryController } from '@/hooks/useCyclicInventoryController';
import { InventorySkeleton } from '@/components/InventorySkeleton';
import { useWindowManager } from '@/contexts/WindowManagerContext';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

export default function CyclicInventoryDetail() {
    const { id } = useParams(); // This will be the Lab Name
    const labName = id ? decodeURIComponent(id) : '';
    const navigate = useNavigate();
    const { activeWindowId, updateWindowMeta } = useWindowManager();

    // Update window tab title with lab name
    useEffect(() => {
        if (activeWindowId && labName) {
            updateWindowMeta(activeWindowId, labName, <ClipboardList className="w-4 h-4" />);
        }
    }, [activeWindowId, labName, updateWindowMeta]);

    const {
        // State
        items,
        isLoading,
        isUploading,
        isSaving,
        progressPercentage,
        branchName,

        // Stats
        stats: {
            searchTerm, setSearchTerm,
            showDifferencesOnly, setShowDifferencesOnly,
            currentCategory, setCurrentCategory,
            pendingItems, controlledItems, adjustedItems,
            globalPending, globalControlled, globalAdjusted
        },
        history,

        // Dialogs
        showSaveDialog, setShowSaveDialog,
        shortageId, setShortageId,
        surplusId, setSurplusId,
        shortageValue, surplusValue,

        showDeleteDialog, setShowDeleteDialog,
        verificationText,
        isDeleting,

        // Actions
        handleFileUpload,
        handleUpdateQuantity,
        handleCheck,
        handleRevertItem,
        handleFinalizeClick,
        handleSaveInventory,
        handleResetData,
        handleConfirmDelete,

        // Advanced Logic
        sortBy, setSortBy,
        getSortedItems

    } = useCyclicInventoryController({ labName });

    return (
        <PageLayout className="pb-32 lg:pb-10">

            {/* Loading State */}
            {isLoading ? (
                <InventorySkeleton />
            ) : (
                <>
                    {/* Header Info Bar */}
                    {items.length > 0 && (
                        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 p-2 rounded-lg border border-dashed border-muted/30">
                            <Info className="w-3.5 h-3.5 opacity-70" />
                            <span>
                                Última actualización del inventario:
                                <span className="font-mono ml-1 font-medium text-foreground opacity-80">
                                    {new Date(Math.max(...items.map(i => new Date(i.updatedAt || new Date()).getTime()))).toLocaleString()}
                                </span>
                            </span>
                        </div>
                    )}

                    {/* Upload Section (if completely empty) */}
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
                                    disabled={isUploading || isLoading}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                                Columnas requeridas: C (EAN), D (Producto), E (Cantidad), K (Costo), J (Rubro), O (Laboratorio)
                            </p>
                        </Card>
                    ) : (
                        /* Inventory Lists */
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Stats Cards */}
                            {/* 1. Enhanced Status Bar - Full Width Single Row */}
                            <Card className="lg:col-span-3 min-h-[110px] mb-8 flex flex-col justify-center px-6 sm:px-8 bg-muted/20 border-muted/40 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between gap-4 w-full">
                                    {/* Left: Navigation + Lab Label + Name */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-muted/50 -ml-2"
                                            onClick={() => navigate('/cyclic-inventory')}
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </Button>
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap opacity-60">Lab</span>
                                            <span className="font-bold text-foreground text-lg sm:text-xl truncate">{labName}</span>
                                        </div>
                                    </div>

                                    <div className="h-10 sm:h-12 w-px bg-border/40 flex-shrink-0 mx-2" />

                                    {/* Center: Counters - Horizontal Layout */}
                                    <div className="flex items-center gap-6 sm:gap-12 flex-1 justify-center">
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap opacity-60">Pendientes</span>
                                            <div className="flex items-center">
                                                <div className="text-2xl sm:text-3xl font-bold text-warning leading-none flex items-center">
                                                    <AnimatedCounter value={globalPending} digits={4} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap opacity-60">Controlados</span>
                                            <div className="flex items-center">
                                                <div className="text-2xl sm:text-3xl font-bold text-success leading-none flex items-center">
                                                    <AnimatedCounter value={globalControlled} digits={4} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap opacity-60">Ajustados</span>
                                            <div className="flex items-center">
                                                <div className="text-2xl sm:text-3xl font-bold text-blue-500 leading-none flex items-center">
                                                    <AnimatedCounter value={globalAdjusted} digits={4} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold whitespace-nowrap opacity-60">Avance</span>
                                            <div className="flex items-center gap-1">
                                                <div className="text-2xl sm:text-3xl font-bold text-foreground leading-none flex items-center">
                                                    <AnimatedCounter value={progressPercentage} digits={3} />
                                                </div>
                                                <span className="text-xl font-bold opacity-40 leading-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Main Content */}
                            <div className="lg:col-span-3">
                                <div className="flex flex-col md:flex-row gap-6 mb-8">
                                    <div className="relative flex-1 group">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
                                        <Input
                                            placeholder="Buscar por nombre o EAN..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 rounded-full bg-muted/20 border-muted/40 transition-all focus-visible:ring-primary/20"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 bg-muted/20 p-2 rounded-full border border-muted/40 transition-all hover:bg-muted/30">
                                        <Switch
                                            id="diff-mode"
                                            checked={showDifferencesOnly}
                                            onCheckedChange={setShowDifferencesOnly}
                                        />
                                        <Label htmlFor="diff-mode" className="cursor-pointer text-sm font-medium mr-2">Solo Diferencias</Label>
                                    </div>
                                    <Button
                                        variant={sortBy === 'financial' ? "default" : "outline"}
                                        onClick={() => setSortBy(prev => prev === 'default' ? 'financial' : 'default')}
                                        className="h-10 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                                        title="Ordenar por Impacto Financiero"
                                    >
                                        {sortBy === 'financial' ? <DollarSign className="w-4 h-4 mr-2" /> : <div className="w-4 h-4 mr-2 flex items-center justify-center font-bold">$</div>}
                                        {sortBy === 'financial' ? 'Impacto $' : 'Orden A-Z'}
                                    </Button>
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
                                                    "rounded-xl px-6 h-12 transition-all duration-300 border-2",
                                                    currentCategory === cat
                                                        ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
                                                        : "bg-muted/10 border-muted/20 opacity-70 hover:opacity-100 hover:bg-muted/20 hover:scale-102"
                                                )}
                                            >
                                                <span className={cn(
                                                    "font-bold tracking-tight",
                                                    currentCategory === cat ? "text-primary-foreground" : "text-muted-foreground"
                                                )}>
                                                    {cat}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Tabs defaultValue="pending" className="w-full transition-all duration-500">
                                    <TabsList className="grid w-full grid-cols-4 mb-6 p-1 bg-muted/20 rounded-2xl h-14 border border-muted/40">
                                        <TabsTrigger
                                            value="pending"
                                            className="relative rounded-xl transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:scale-[0.98] h-full"
                                        >
                                            <span className="font-bold">Pendientes</span>
                                            {pendingItems.length > 0 && (
                                                <span className="ml-2 bg-warning text-warning-foreground text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                                                    {pendingItems.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="controlled"
                                            className="relative rounded-xl transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:scale-[0.98] h-full"
                                        >
                                            <span className="font-bold">Controlados</span>
                                            {controlledItems.length > 0 && (
                                                <span className="ml-2 bg-success text-success-foreground text-[10px] px-2 py-0.5 rounded-full font-black">
                                                    {controlledItems.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="adjusted"
                                            className="relative rounded-xl transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:scale-[0.98] h-full"
                                        >
                                            <span className="font-bold">Ajustados</span>
                                            {adjustedItems.length > 0 && (
                                                <span className="ml-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                                                    {adjustedItems.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="history"
                                            className="relative rounded-xl transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:scale-[0.98] h-full"
                                        >
                                            <span className="font-bold">Historial</span>
                                            {history.length > 0 && (
                                                <span className="ml-2 bg-muted-foreground text-background text-[10px] px-2 py-0.5 rounded-full font-black opacity-60">
                                                    {history.length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="pending" className="space-y-4">
                                        <Alert className="bg-muted/10 border-muted/20 mb-4 rounded-2xl py-3 shadow-none">
                                            <Info className="h-4 w-4 text-primary" />
                                            <AlertDescription className="text-sm font-medium text-muted-foreground ml-2">
                                                Desliza a la derecha para confirmar (verde) o a la izquierda para reportar diferencia (naranja).
                                            </AlertDescription>
                                        </Alert>
                                        <CyclicInventoryList
                                            items={getSortedItems(pendingItems)}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
                                            isPending={true}
                                        />
                                    </TabsContent>

                                    <TabsContent value="controlled" className="space-y-4">
                                        <CyclicInventoryList
                                            items={getSortedItems(controlledItems)}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
                                            onRevert={handleRevertItem}
                                            readOnly={false}
                                        />
                                    </TabsContent>

                                    <TabsContent value="adjusted" className="space-y-4">
                                        <CyclicInventoryList
                                            items={getSortedItems(adjustedItems)}
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
                                                                <div className="flex gap-2 items-center">
                                                                    <p className="text-xs text-muted-foreground">Por: {h.user_name || 'Desconocido'}</p>
                                                                    {h.category && (
                                                                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                                                            {h.category}
                                                                        </span>
                                                                    )}
                                                                </div>
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

            {/* Security Delete Dialog */}
            <DeleteConfirmationDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                onConfirm={handleConfirmDelete}
                verificationText={verificationText}
                isDeleting={isDeleting}
                title={`Reiniciar ${labName}`}
                description={
                    <div className="space-y-2">
                        <p>¿Estás seguro de que quieres reiniciar todo el progreso de este laboratorio?</p>
                        <ul className="list-disc pl-4 text-sm text-muted-foreground">
                            <li>Se eliminarán todos los conteos actuales (Pendientes, Controlados, Ajustados).</li>
                            <li>Esta acción <strong>NO</strong> se puede deshacer.</li>
                            <li>Deberás comenzar desde cero o cargar un nuevo Excel.</li>
                        </ul>
                    </div>
                }
            />

            {/* Hidden Input for Excel Upload */}
            <input
                id="inventory-upload-hidden"
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading || isLoading}
            />

            {/* Inventory Floating Action Button (FabMenu) */}
            <FabMenu
                actions={[
                    {
                        label: "Cargar Excel",
                        icon: <Upload className="w-5 h-5" />,
                        onClick: () => document.getElementById('inventory-upload-hidden')?.click(),
                        disabled: isUploading || isSaving,
                        variant: 'secondary' as const
                    },
                    {
                        label: "Reiniciar",
                        icon: <RotateCcw className="w-5 h-5" />,
                        onClick: handleResetData,
                        disabled: isUploading || isSaving,
                        variant: 'destructive' as const,
                        color: 'bg-red-100 text-red-600 hover:bg-red-200'
                    },
                    {
                        label: "Finalizar",
                        icon: <CheckCircle2 className="w-5 h-5" />,
                        onClick: handleFinalizeClick,
                        disabled: isSaving,
                        variant: 'default' as const, // Primary style
                        color: 'bg-primary text-primary-foreground'
                    }
                ].filter(action => {
                    // Filter out Finalize if no items (optional, or just disable it)
                    if (action.label === "Finalizar" && (pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length === 0)) return false;
                    return true;
                })}
            />

            {/* Onboarding Overlay */}
            <Onboarding />
        </PageLayout>
    );
}

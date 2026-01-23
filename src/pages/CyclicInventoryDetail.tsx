import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, Info, Loader2, CheckCircle2, RotateCcw, DollarSign } from 'lucide-react';
import { CyclicInventoryList } from '@/components/CyclicInventoryList';
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
import { FabMenu } from '@/components/FabMenu';
import { DeleteConfirmationDialog } from '@/components/cyclic/DeleteConfirmationDialog';
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";

// Hooks & Components
import { useCyclicInventoryController } from '@/hooks/useCyclicInventoryController';
import { InventorySkeleton } from '@/components/InventorySkeleton';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

export default function CyclicInventoryDetail() {
    const { id } = useParams(); // This will be the Lab Name
    const labName = id ? decodeURIComponent(id) : '';

    const {
        // State
        items,
        isLoading,
        isUploading,
        isSaving,
        branchName,

        // Stats
        stats: {
            searchTerm, setSearchTerm,
            showDifferencesOnly, setShowDifferencesOnly,
            currentCategory, setCurrentCategory,
            pendingItems, controlledItems, adjustedItems
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
            <PageHeader
                title={labName}
                subtitle="Control de Inventario Cíclico"
                showBackButton
            />

            {/* Loading State */}
            {isLoading ? (
                <InventorySkeleton />
            ) : (
                <>
                    {/* Header Info Bar */}
                    {items.length > 0 && (
                        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-dashed">
                            <Info className="w-3.5 h-3.5" />
                            <span>
                                Última actualización del inventario:
                                <span className="font-mono ml-1 font-medium text-foreground">
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
                            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="p-4 flex flex-col items-center justify-center bg-warning/5 border-warning/20">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Pendientes</span>
                                    <span className="text-2xl font-bold text-warning">
                                        <CounterAnimation value={pendingItems.length} />
                                    </span>
                                </Card>
                                <Card className="p-4 flex flex-col items-center justify-center bg-success/5 border-success/20">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Controlados</span>
                                    <span className="text-2xl font-bold text-success">
                                        <CounterAnimation value={controlledItems.length} />
                                    </span>
                                </Card>
                                <Card className="p-4 flex flex-col items-center justify-center bg-blue-500/5 border-blue-500/20">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Ajustados</span>
                                    <span className="text-2xl font-bold text-blue-500">
                                        <CounterAnimation value={adjustedItems.length} />
                                    </span>
                                </Card>
                                <Card className="p-4 flex flex-col items-center justify-center">
                                    <span className="text-muted-foreground text-xs uppercase font-bold">Avance</span>
                                    <span className="text-2xl font-bold">
                                        <CounterAnimation value={Math.round(((controlledItems.length + adjustedItems.length) / (pendingItems.length + controlledItems.length + adjustedItems.length || 1)) * 100)} />%
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
                                    <Button
                                        variant={sortBy === 'financial' ? "default" : "outline"}
                                        onClick={() => setSortBy(prev => prev === 'default' ? 'financial' : 'default')}
                                        className="h-10"
                                        title="Ordenar por Impacto Financiero"
                                    >
                                        <DollarSign className="w-4 h-4 mr-2" />
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
                                            {history.length > 0 && (
                                                <span className="ml-2 bg-muted-foreground text-background text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {history.length}
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
                                            items={getSortedItems(pendingItems)}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
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

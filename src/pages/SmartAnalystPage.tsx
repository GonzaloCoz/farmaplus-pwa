
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Search,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    PackageX,
    Trash2,
    Calendar,
    Filter,
    ArrowUpRight,
    FileText
} from 'lucide-react';
import { FabMenu } from '@/components/FabMenu';
import { ExportOptionsModal, ExportOptions } from '@/components/modals/ExportOptionsModal';
import { generateExport } from '@/services/ExportService';
import { useExpirationControl } from '@/hooks/useExpirationControl';
import { SmartFilters, FilterState } from '@/components/SmartFilters';
import { getAllExpirationItems, updateExpirationItem, processTransfer, ExpirationItem, BatchInfo } from '@/services/expirationDB';
import { notify } from '@/lib/notifications';
import { format, parse, differenceInDays, differenceInMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface AnalyzedBatch extends BatchInfo {
    itemId: string;
    productName: string;
    ean: string;
    daysUntilExpiry: number;
    monthsUntilExpiry: number;
    remainingDays: number;
}

import { TransferModal } from '@/components/modals/TransferModal';
import { BRANCH_NAMES } from '@/config/users';
import { useUser } from '@/contexts/UserContext';

export default function SmartAnalystPage() {
    const { user } = useUser();
    const navigate = useNavigate();
    const { session, isLoading: isControlLoading } = useExpirationControl(); // Assuming useExpirationControl exists
    const [items, setItems] = useState<ExpirationItem[]>([]);
    const [batches, setBatches] = useState<AnalyzedBatch[]>([]); // Renamed from analyzedBatches
    const [searchTerm, setSearchTerm] = useState(''); // Renamed from filterQuery
    const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
    const [isLoading, setIsLoading] = useState(true);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [batchToTransfer, setBatchToTransfer] = useState<AnalyzedBatch | null>(null);

    // Export Logic
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // Smart Filters State
    const [filterState, setFilterState] = useState<FilterState>({
        status: [],
        date: undefined
    });

    const handleExportConfirm = (options: ExportOptions) => {
        if (user?.branchName) {
            generateExport(items, options, user.branchName);
        }
    };

    const fabActions = [
        {
            icon: <FileText className="h-5 w-5" />,
            label: "Exportar Reporte",
            onClick: () => setExportModalOpen(true)
        }
    ];

    useEffect(() => {
        loadData();
    }, [user?.branchName]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const allItems = await getAllExpirationItems(user?.branchName);
            setItems(allItems);
            processBatches(allItems);
        } catch (error) {
            console.error("Error loading analyzed data", error);
            notify.error("Error", "No se pudieron cargar los datos");
        } finally {
            setIsLoading(false);
        }
    };

    const processBatches = (allItems: ExpirationItem[]) => {
        const batchList: AnalyzedBatch[] = [];
        const today = new Date();

        allItems.forEach(item => {
            item.batches.forEach(batch => {
                // Parse date (DD/MM/YYYY or MM/YYYY)
                let expiryDate: Date;
                const parts = batch.expirationDate.split('/');

                let year = parseInt(parts[parts.length - 1]);
                if (year < 100) year += 2000; // Handle 2-digit year

                if (parts.length === 2) { // MM/YYYY
                    expiryDate = new Date(year, parseInt(parts[0]), 0); // Last day of month
                } else { // DD/MM/YYYY
                    expiryDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
                }

                const months = differenceInMonths(expiryDate, today);
                const dateAfterMonths = addMonths(today, months);
                const extraDays = differenceInDays(expiryDate, dateAfterMonths);

                batchList.push({
                    ...batch,
                    itemId: item.id,
                    productName: item.productName,
                    ean: item.ean,
                    daysUntilExpiry: differenceInDays(expiryDate, today),
                    monthsUntilExpiry: months,
                    remainingDays: extraDays
                });
            });
        });

        // Sort by urgency (lowest days first)
        batchList.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        setBatches(batchList);
    };

    const handleAction = async (batch: AnalyzedBatch, action: 'sold' | 'transfer' | 'return' | 'destroyed') => {
        if (action === 'transfer') {
            setBatchToTransfer(batch);
            setTransferModalOpen(true);
            return;
        }
        await processAction(batch, action);
    };

    const confirmTransfer = async (destinationBranch: string, plexShipmentNumber: string) => {
        if (!batchToTransfer) return;

        try {
            const parentItem = items.find(i => i.id === batchToTransfer.itemId);
            if (!parentItem) return;

            // Use the new service that handles both source and destination updates
            await processTransfer(parentItem, batchToTransfer, destinationBranch, plexShipmentNumber);

            notify.success("Transferencia Exitosa", `Producto transferido a ${destinationBranch}`);

            // Reload to reflect changes
            loadData();
        } catch (error) {
            console.error("Error processing transfer:", error);
            notify.error("Error", "Falló la transferencia");
        }

        setTransferModalOpen(false);
        setBatchToTransfer(null);
    };

    const processAction = async (batch: AnalyzedBatch, action: string, extraData: any = {}) => {
        try {
            const parentItem = items.find(i => i.id === batch.itemId);
            if (!parentItem) return;

            // Updated batches array
            const updatedBatches = parentItem.batches.map(b => {
                if (b.batchNumber === batch.batchNumber && b.expirationDate === batch.expirationDate) {
                    return {
                        ...b,
                        status: action as any,
                        actionDate: Date.now(),
                        ...extraData
                    };
                }
                return b;
            });

            await updateExpirationItem(parentItem.id, { batches: updatedBatches });

            // Optimistic update
            setItems(prev => prev.map(i => i.id === parentItem.id ? { ...i, batches: updatedBatches as BatchInfo[] } : i));
            processBatches(items.map(i => i.id === parentItem.id ? { ...i, batches: updatedBatches as BatchInfo[] } : i));

            const actionLabels: Record<string, string> = {
                sold: "Marcado como Vendido/Promo",
                transfer: "Marcado para Transferencia",
                return: "Marcado para Devolución",
                destroyed: "Marcado para Destrucción"
            };
            notify.success("Acción registrada", actionLabels[action]);
            loadData();
        } catch (error) {
            console.error("Error updating batch", error);
            notify.error("Error", "No se pudo actualizar el estado");
        }
    };

    const filteredBatches = batches.filter(b => {
        const matchesQuery = b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());

        if (activeTab === 'pending') {
            return matchesQuery && (!b.status || b.status === 'active');
        } else {
            return matchesQuery && (b.status && b.status !== 'active');
        }
    });

    const getUrgencyColor = (days: number) => {
        if (days < 0) return "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10";
        if (days < 30) return "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10";
        if (days < 60) return "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/20";
        return "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'sold': return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
            case 'transfer': return <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
            case 'return': return <PackageX className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
            case 'destroyed': return <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />;
            default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getStatusLabel = (status?: string, batch?: AnalyzedBatch) => {
        switch (status) {
            case 'sold': return "Vendido / Promo";
            case 'transfer': return batch?.destinationBranch ? `Transferido a ${batch.destinationBranch}` : "Inter-Sucursal";
            case 'return': return "Devolución";
            case 'destroyed': return "Destrucción";
            default: return "Pendiente";
        }
    };


    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-6 pb-24">

            {/* Metrics Summary (Optional) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm border-muted/50">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Críticos ({"<"}30d)</p>
                            <h3 className="text-xl font-bold text-destructive">
                                {batches.filter(b => (!b.status || b.status === 'active') && b.daysUntilExpiry < 30).length}
                            </h3>
                        </div>
                        <div className="p-2 bg-destructive/10 rounded-full">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-muted/50">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Próximos (30-60d)</p>
                            <h3 className="text-xl font-bold text-warning">
                                {batches.filter(b => (!b.status || b.status === 'active') && b.daysUntilExpiry >= 30 && b.daysUntilExpiry < 60).length}
                            </h3>
                        </div>
                        <div className="p-2 bg-warning/10 rounded-full">
                            <Calendar className="w-4 h-4 text-warning" />
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card p-1.5 rounded-xl border border-border/40 shadow-sm">
                    <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
                        <TabsTrigger value="pending" className="gap-2 h-9 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Pendientes
                            <Badge variant="secondary" className="ml-1 h-4 px-1 min-w-[18px] justify-center text-[10px]">
                                {batches.filter(b => !b.status || b.status === 'active').length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="resolved" className="gap-2 h-9 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resueltos
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <SmartFilters
                            activeFilters={filterState}
                            onFilterChange={setFilterState}
                        />
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar producto o lote..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 bg-muted/50 border-muted-foreground/20"
                            />
                        </div>
                    </div>
                </div>

                <TabsContent value="pending" className="space-y-4 data-[state=inactive]:hidden focus-visible:outline-none">
                    <AnimatePresence mode="popLayout">
                        {filteredBatches.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center p-12 text-center space-y-4 border-2 border-dashed border-muted rounded-xl bg-muted/5"
                            >
                                <div className="p-4 bg-background rounded-full shadow-sm">
                                    <CheckCircle2 className="w-8 h-8 text-success" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold">¡Todo al día!</h3>
                                    <p className="text-muted-foreground max-w-sm mt-1">No tienes productos pendientes de revisión con tus criterios de búsqueda.</p>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="grid gap-3">
                                {filteredBatches.map((batch) => (
                                    <motion.div
                                        key={`${batch.itemId}-${batch.batchNumber}`}
                                        layout
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Card className={`overflow-hidden border-l-4 ${getUrgencyColor(batch.daysUntilExpiry).split(' ')[1]} transition-colors hover:bg-muted/5 group`}>
                                            <CardContent className="p-0">
                                                <div className="flex flex-col md:flex-row items-center">
                                                    {/* Info Section */}
                                                    <div className="flex-1 py-3 px-4 flex items-center gap-4 min-w-0">
                                                        <div className="flex-1 min-w-0 space-y-2">
                                                            <div>
                                                                <h3 className="font-bold text-base leading-tight truncate" title={batch.productName}>
                                                                    {batch.productName}
                                                                </h3>
                                                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 font-mono">
                                                                    <span className="bg-muted px-2 py-0.5 rounded text-[10px] border border-border/40 font-medium">EAN: {batch.ean}</span>
                                                                    <span className="text-border/40">•</span>
                                                                    <span className="text-[10px] opacity-80">Lote: {batch.batchNumber}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-5 text-xs pl-0.5">
                                                                <div className="flex items-center gap-1.5 text-muted-foreground/90">
                                                                    <Calendar className="w-3.5 h-3.5 opacity-70" />
                                                                    <span>Venc: <span className="font-medium text-foreground">{batch.expirationDate}</span></span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-muted-foreground/90">
                                                                    <PackageX className="w-3.5 h-3.5 opacity-70" />
                                                                    <span>Stock: <span className="font-medium text-foreground">{batch.quantity} un.</span></span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className={`flex flex-col items-center justify-center flex-shrink-0 px-4 py-1.5 min-w-[170px] rounded-xl border ${getUrgencyColor(batch.daysUntilExpiry)} select-none bg-background/40 backdrop-blur-sm shadow-sm`}>
                                                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60 mb-0.5 leading-none">
                                                                {batch.monthsUntilExpiry <= 0 ? (Math.abs(batch.daysUntilExpiry) === 0 ? 'HOY' : 'VENCE EN') : 'TIEMPO RESTANTE'}
                                                            </span>

                                                            <div className="flex items-baseline justify-center gap-1 leading-none">
                                                                {batch.monthsUntilExpiry <= 0 ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-2xl font-black tracking-tight">{Math.abs(batch.daysUntilExpiry)}</span>
                                                                        <span className="text-[8px] uppercase font-bold tracking-wider opacity-50 mt-0.5">Días</span>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-2xl font-black tracking-tight">{batch.monthsUntilExpiry}</span>
                                                                            <span className="text-[8px] uppercase font-bold tracking-wider opacity-50 mt-0.5">Meses</span>
                                                                        </div>
                                                                        {batch.remainingDays > 0 && (
                                                                            <span className="text-xl font-thin opacity-20 mx-2">/</span>
                                                                        )}
                                                                        {batch.remainingDays > 0 && (
                                                                            <div className="flex flex-col items-center">
                                                                                <span className="text-2xl font-black tracking-tight">{batch.remainingDays}</span>
                                                                                <span className="text-[8px] uppercase font-bold tracking-wider opacity-50 mt-0.5">Días</span>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions Section */}
                                                    <div className="w-full md:w-auto p-2 md:pr-4 flex flex-row gap-1 md:gap-2 justify-center md:justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <ActionTooltip label="Vendido / Promoción">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full hover:bg-success/10 hover:text-success hover:scale-105 active:scale-95 transition-all text-muted-foreground/70"
                                                                onClick={() => handleAction(batch, 'sold')}
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </Button>
                                                        </ActionTooltip>

                                                        <ActionTooltip label="Inter-Sucursal">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-500 hover:scale-105 active:scale-95 transition-all text-muted-foreground/70"
                                                                onClick={() => handleAction(batch, 'transfer')}
                                                            >
                                                                <RefreshCw className="w-4 h-4" />
                                                            </Button>
                                                        </ActionTooltip>

                                                        <ActionTooltip label="Devolución">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full hover:bg-warning/10 hover:text-warning hover:scale-105 active:scale-95 transition-all text-muted-foreground/70"
                                                                onClick={() => handleAction(batch, 'return')}
                                                            >
                                                                <PackageX className="w-4 h-4" />
                                                            </Button>
                                                        </ActionTooltip>

                                                        <ActionTooltip label="Destrucción">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive hover:scale-105 active:scale-95 transition-all text-muted-foreground/70"
                                                                onClick={() => handleAction(batch, 'destroyed')}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </ActionTooltip>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </TabsContent>

                <TabsContent value="resolved" className="space-y-4">
                    <div className="grid gap-3">
                        {filteredBatches.map((batch) => (
                            <Card key={`${batch.itemId}-${batch.batchNumber}`} className="bg-muted/30 opacity-75 hover:opacity-100 transition-opacity">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-background rounded-full shadow-sm border">
                                            {getStatusIcon(batch.status)}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold line-through text-muted-foreground text-sm">{batch.productName}</h4>
                                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>{batch.batchNumber}</span>
                                                <span>•</span>
                                                <span className="font-medium text-foreground">{getStatusLabel(batch.status, batch)}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right text-[10px] text-muted-foreground">
                                        <p>Acción realizada</p>
                                        <p className="font-mono">{batch.actionDate ? format(batch.actionDate, 'dd/MM/yyyy HH:mm') : '-'}</p>
                                        {batch.plexShipmentNumber && (
                                            <p className="font-mono text-[9px] text-blue-500 mt-1">Plex: {batch.plexShipmentNumber}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {filteredBatches.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No hay items resueltos.</p>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <TransferModal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                onConfirm={confirmTransfer}
                batch={batchToTransfer}
                branches={BRANCH_NAMES}
            />

            {/* <ScrollHideFAB actions={fabActions} /> Replaced with FabMenu */}
            <FabMenu
                actions={[
                    {
                        label: "Exportar Reporte",
                        icon: <FileText className="w-5 h-5" />,
                        onClick: () => setExportModalOpen(true),
                        variant: 'secondary'
                    }
                ]}
            />

            <ExportOptionsModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                onConfirm={handleExportConfirm}
            />
        </div>
    );
}

// Helper component for tooltips
function ActionTooltip({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div className="relative group/tooltip">
            {children}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover"></div>
            </div>
        </div>
    );
}

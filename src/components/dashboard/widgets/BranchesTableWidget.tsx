import { useState, useMemo } from 'react';
import { CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Magnifer as Search, SortByTime as ArrowUpDown, GraphUp as TrendingUp, CheckCircle, DangerCircle as AlertCircle, ClockCircle as Clock, Download } from '@solar-icons/react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { useUser } from '@/contexts/UserContext';
import { useUserBranches } from '@/hooks/useUserBranches';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const INITIAL_BRANCHES_TO_SHOW = 8;

interface BranchSummary {
    branchName: string;
    deploymentDate: string;
    assignedDays: number;
    remainingDays: number;
    cyclicRound: number;
    monthlyGoal: number;
    elapsedDays: number;
    progress: number;
    inventoryUnits: number;
    differenceUnits: number;
    adjustmentsValue: number;
    status: 'controlado' | 'por_controlar' | 'pendiente';
}

interface BranchesTableWidgetProps {
    branches?: any[];
}

export function BranchesTableWidget({ branches: initialBranches }: BranchesTableWidgetProps) {
    const { selectBranch, clearBranchSelection, user } = useUser();
    const { availableBranches } = useUserBranches();
    const [searchTerm, setSearchTerm] = useState("");
    const [showAllBranches, setShowAllBranches] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof BranchSummary; direction: 'ascending' | 'descending' }>({
        key: 'progress',
        direction: 'descending'
    });

    // Implementation 2: Client-side Caching with React Query
    const { data: branchSummaries = [], isLoading: loading } = useQuery({
        queryKey: ['branch-summaries-lite', availableBranches],
        queryFn: async () => {
            const data = await cyclicInventoryService.getBranchesSummaryLite();
            // Filter branches based on user permissions
            return data.filter(branch =>
                availableBranches.length === 0 || availableBranches.includes(branch.branchName)
            );
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
    });

    const filteredBranches = useMemo(() => {
        return branchSummaries.filter(
            (branch) =>
                branch.branchName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [branchSummaries, searchTerm]);

    const sortedBranches = useMemo(() => {
        let sortableItems = [...filteredBranches];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredBranches, sortConfig]);

    const requestSort = (key: keyof BranchSummary) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const branchesToShow = showAllBranches
        ? sortedBranches
        : sortedBranches.slice(0, INITIAL_BRANCHES_TO_SHOW);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    };

    const handleBranchClick = (branchName: string) => {
        if (user?.branchName === branchName) {
            clearBranchSelection?.();
        } else if (selectBranch) {
            selectBranch(branchName);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const isActiveBranch = (branchName: string) => user?.branchName === branchName;

    const exportToExcel = () => {
        const exportData = sortedBranches.map(branch => ({
            'Sucursal': branch.branchName,
            'Fecha Inicio': branch.deploymentDate,
            'Días (Pte / Asig)': `${branch.remainingDays} / ${branch.assignedDays}`,
            'Progreso %': branch.progress,
            'Diferencia Neta (Unidades)': branch.differenceUnits,
            'Valor de Ajustes': formatMoney(branch.adjustmentsValue),
            'Estado': branch.status === 'controlado' ? 'Controlado' :
                branch.status === 'por_controlar' ? 'Por Controlar' : 'Pendiente',
            'Días Transcurridos': branch.elapsedDays,
            'Meta Mensual': branch.monthlyGoal
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Monitor de Sucursales');

        const fileName = `monitor_sucursales_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full h-full"
        >
            <div className="h-full flex flex-col">
                <CardHeader className="p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <TrendingUp className="w-6 h-6 text-primary" />
                                Monitor de Sucursales
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Estado en tiempo real de inventarios cíclicos y cumplimiento.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar sucursal..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
                                />
                            </div>
                            <Button
                                onClick={exportToExcel}
                                variant="outline"
                                size="sm"
                                className="h-10 gap-2"
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Exportar</span>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="rounded-xl border bg-card/50 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/40 hover:bg-muted/50 transition-colors">
                                <TableRow>
                                    <TableHead className="w-[200px] cursor-pointer" onClick={() => requestSort('branchName')}>
                                        <div className="flex items-center font-semibold text-foreground">
                                            Sucursal
                                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-center cursor-pointer hidden md:table-cell" onClick={() => requestSort('deploymentDate')}>
                                        Fecha Inicio
                                    </TableHead>
                                    <TableHead className="text-center cursor-pointer hidden md:table-cell" onClick={() => requestSort('assignedDays')}>
                                        Días
                                    </TableHead>
                                    <TableHead className="text-center hidden lg:table-cell">Vuelta</TableHead>
                                    <TableHead className="text-center hidden lg:table-cell">Obj. Mensual</TableHead>
                                    <TableHead className="text-center cursor-pointer" onClick={() => requestSort('progress')}>
                                        <div className="flex items-center justify-center font-semibold text-foreground">
                                            % Avance
                                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-center hidden md:table-cell">Un. Inventario</TableHead>
                                    <TableHead className="text-center cursor-pointer hidden md:table-cell" onClick={() => requestSort('differenceUnits')}>
                                        Diferencia
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => requestSort('adjustmentsValue')}>
                                        $ Ajustes
                                    </TableHead>
                                    <TableHead className="text-center w-[120px]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><div className="h-5 w-32 bg-muted rounded animate-pulse" /></TableCell>
                                            <TableCell className="hidden md:table-cell"><div className="h-5 w-20 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell className="hidden md:table-cell"><div className="h-5 w-12 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell className="hidden lg:table-cell"><div className="h-5 w-10 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell className="hidden lg:table-cell"><div className="h-5 w-12 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell><div className="h-5 w-16 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell className="hidden md:table-cell"><div className="h-5 w-16 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell className="hidden md:table-cell"><div className="h-5 w-16 bg-muted rounded animate-pulse mx-auto" /></TableCell>
                                            <TableCell className="text-right"><div className="h-5 w-24 bg-muted rounded animate-pulse ml-auto" /></TableCell>
                                            <TableCell><div className="h-6 w-20 bg-muted rounded-full animate-pulse mx-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : branchesToShow.length > 0 ? (
                                    branchesToShow.map((branch, index) => (
                                        <motion.tr
                                            key={branch.branchName}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => handleBranchClick(branch.branchName)}
                                            className={cn(
                                                "group cursor-pointer hover:bg-muted/50 transition-all border-b last:border-0",
                                                isActiveBranch(branch.branchName) && "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary"
                                            )}
                                        >
                                            <TableCell className="font-medium text-foreground relative">
                                                {isActiveBranch(branch.branchName) && (
                                                    <motion.div
                                                        layoutId="active-indicator"
                                                        className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                                                    />
                                                )}
                                                {branch.branchName}
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground text-sm hidden md:table-cell">{branch.deploymentDate}</TableCell>
                                            <TableCell className="text-center text-sm hidden md:table-cell">
                                                <span className={cn(
                                                    "font-medium",
                                                    branch.remainingDays <= 5 ? "text-red-500 font-bold" : "text-primary"
                                                )}>
                                                    {branch.remainingDays}
                                                </span>
                                                <span className="text-muted-foreground mx-1">/</span>
                                                <span className="text-muted-foreground">{branch.assignedDays}</span>
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground text-sm hidden lg:table-cell">{branch.cyclicRound}ª</TableCell>
                                            <TableCell className="text-center text-muted-foreground text-sm hidden lg:table-cell">{branch.monthlyGoal}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={cn(
                                                        "font-bold text-sm",
                                                        branch.progress > 0 ? "text-green-600" : "text-muted-foreground"
                                                    )}>
                                                        {branch.progress}%
                                                    </span>
                                                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                                                        <div
                                                            className={cn("h-full rounded-full transition-all",
                                                                branch.progress >= 100 ? "bg-green-500" :
                                                                    branch.progress > 0 ? "bg-green-400" : "bg-muted-foreground/20"
                                                            )}
                                                            style={{ width: `${Math.min(branch.progress, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm hidden md:table-cell">{branch.inventoryUnits}</TableCell>
                                            <TableCell className="text-center font-mono text-sm hidden md:table-cell">
                                                <span className={branch.differenceUnits === 0 ? 'text-muted-foreground' : branch.differenceUnits > 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {branch.differenceUnits > 0 ? '+' : ''}{branch.differenceUnits}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                <span className={branch.adjustmentsValue === 0 ? 'text-muted-foreground' : branch.adjustmentsValue > 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {formatMoney(branch.adjustmentsValue)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {branch.status === 'controlado' ? (
                                                    <Badge variant="outline" className="font-normal border bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> FINALIZADA
                                                    </Badge>
                                                ) : branch.status === 'por_controlar' ? (
                                                    <Badge variant="outline" className="font-normal border bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                                                        <Clock className="w-3 h-3 mr-1" /> EN PROCESO
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="font-normal border bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                                                        <AlertCircle className="w-3 h-3 mr-1" /> PENDIENTE
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                            No se encontraron sucursales con esa búsqueda.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {sortedBranches.length > INITIAL_BRANCHES_TO_SHOW && (
                        <div className="mt-4 flex justify-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAllBranches(!showAllBranches)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                {showAllBranches ? 'Mostrar menos' : `Ver todas las sucursales (${sortedBranches.length})`}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </div>
        </motion.div>
    );
}

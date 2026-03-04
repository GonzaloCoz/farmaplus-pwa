import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";
import { BRANCH_NAMES } from "@/config/users";
import { Checkbox } from "@/components/ui/checkbox";
import { Magnifer as Search, CheckRead as CheckAll, Calendar, Restart as ClockIcon } from "@solar-icons/react";

interface ConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    currentAssignedDays: number;
    currentStartDate: Date | string | null;
    onSave: (branches: string[], days: number, startDate?: string) => Promise<any>;
}

export function ConfigDialog({
    open,
    onOpenChange,
    user,
    currentAssignedDays,
    currentStartDate,
    onSave
}: ConfigDialogProps) {
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [configDays, setConfigDays] = useState(90);
    const [extensionDays, setExtensionDays] = useState(0);
    const [configStartDate, setConfigStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            const currentTotal = currentAssignedDays || 90;
            const standards = [180, 150, 120, 90];
            const foundBase = standards.find(s => s <= currentTotal) || 90;

            // Default: only current branch selected if available
            setSelectedBranches(user?.branchName ? [user.branchName] : []);
            setConfigDays(foundBase);
            setExtensionDays(Math.max(0, currentTotal - foundBase));

            if (currentStartDate) {
                const dateStr = currentStartDate instanceof Date ? currentStartDate.toISOString() : String(currentStartDate);
                setConfigStartDate(dateStr.split('T')[0]);
            } else {
                setConfigStartDate(new Date().toISOString().split('T')[0]);
            }
        }
    }, [open, currentAssignedDays, currentStartDate, user]);

    const filteredBranches = useMemo(() => {
        return BRANCH_NAMES.filter(b => b.toLowerCase().includes(searchQuery.toLowerCase())).sort();
    }, [searchQuery]);

    const toggleBranch = (branch: string) => {
        setSelectedBranches(prev =>
            prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
        );
    };

    const toggleAll = () => {
        if (selectedBranches.length === BRANCH_NAMES.length) {
            setSelectedBranches([]);
        } else {
            setSelectedBranches([...BRANCH_NAMES]);
        }
    };

    const handleSave = async () => {
        if (selectedBranches.length === 0) {
            notify.error("Atención", "Seleccione al menos una sucursal");
            return;
        }

        const total = configDays + extensionDays;
        setIsSaving(true);
        try {
            await onSave(selectedBranches, total, configStartDate);
            notify.success("Operación exitosa", `Plazo actualizado para ${selectedBranches.length} sucursales`);
            onOpenChange(false);
        } catch (e) {
            notify.error("Error", "Error al guardar la configuración masiva");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md md:max-w-lg lg:max-w-xl max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col p-0 border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl">
                <div className="p-6 pb-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">Configurar Plazo de Inventario</DialogTitle>
                        <DialogDescription className="text-muted-foreground/80 mt-1">
                            Ajusta los parámetros del ciclo de inventario para las sucursales seleccionadas.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 px-6 py-4 space-y-7 overflow-y-auto custom-scrollbar">
                    {/* Branch Multi-Selection Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                                <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs">{selectedBranches.length}</span>
                                Sucursales Seleccionadas
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[11px] uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-all rounded-full border border-primary/10"
                                onClick={toggleAll}
                            >
                                <CheckAll className="mr-1.5 h-3.5 w-3.5" />
                                {selectedBranches.length === BRANCH_NAMES.length ? "Limpiar Todo" : "Marcar Todas"}
                            </Button>
                        </div>

                        {/* Search Input with Premium Styling */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            </div>
                            <Input
                                placeholder="Buscar farmacia..."
                                className="pl-10 h-11 bg-muted/30 border-primary/5 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Branch List with Card styling */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-2xl bg-muted/10 h-[220px] overflow-y-auto p-3 hover:border-primary/20 transition-all shadow-inner custom-scrollbar">
                            {filteredBranches.map(branch => (
                                <div
                                    key={branch}
                                    className={cn(
                                        "flex items-center space-x-3 p-3 rounded-xl transition-all border border-transparent cursor-pointer select-none",
                                        selectedBranches.includes(branch)
                                            ? "bg-primary/10 border-primary/20 shadow-sm"
                                            : "hover:bg-muted/40 hover:border-muted/60"
                                    )}
                                    onClick={() => toggleBranch(branch)}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                        selectedBranches.includes(branch)
                                            ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20"
                                            : "border-muted-foreground/30 bg-background"
                                    )}>
                                        {selectedBranches.includes(branch) && <CheckAll className="h-3.5 w-3.5 text-white stroke-[3px]" />}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium transition-colors",
                                        selectedBranches.includes(branch) ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {branch}
                                    </span>
                                </div>
                            ))}
                            {filteredBranches.length === 0 && (
                                <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                                    <Search className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-xs italic">Sin resultados</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Parameters Section */}
                    <div className="space-y-6">
                        {/* Base Days Cards */}
                        <div className="space-y-3">
                            <Label className="text-sm font-bold tracking-tight px-1 flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                Ciclo Base (Días)
                            </Label>
                            <div className="grid grid-cols-4 gap-3">
                                {[90, 120, 150, 180].map((days) => (
                                    <button
                                        key={days}
                                        onClick={() => setConfigDays(days)}
                                        className={cn(
                                            "flex flex-col items-center justify-center py-2.5 rounded-xl border-2 transition-all group relative overflow-hidden",
                                            configDays === days
                                                ? "border-primary bg-primary/10 text-primary font-bold shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
                                                : "border-muted/50 hover:border-primary/30 text-muted-foreground hover:bg-muted/20"
                                        )}
                                    >
                                        <span className="text-lg relative z-10">{days}</span>
                                        {configDays === days && <div className="absolute inset-0 bg-primary opacity-5 animate-pulse" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                            {/* Extension Input */}
                            <div className="space-y-3">
                                <Label className="text-sm font-bold tracking-tight px-1 flex items-center gap-2 text-warning">
                                    <ClockIcon className="h-4 w-4" />
                                    Próroga Adicional
                                </Label>
                                <div className="space-y-2">
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="h-12 font-bold text-lg bg-muted/40 border-muted rounded-xl"
                                        value={extensionDays}
                                        onChange={(e) => setExtensionDays(Number(e.target.value))}
                                        min={0}
                                    />
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total del Ciclo</span>
                                        <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                            {configDays + extensionDays} días
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Start Date Selection */}
                            <div className="space-y-3">
                                <Label className="text-sm font-bold tracking-tight px-1 flex items-center gap-2 text-success">
                                    <Calendar className="h-4 w-4" />
                                    Fecha de Inicio
                                </Label>
                                <Input
                                    type="date"
                                    value={configStartDate}
                                    onChange={(e) => setConfigStartDate(e.target.value)}
                                    className="bg-muted/40 h-12 border-muted rounded-xl font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer with Floating Action Button style */}
                <div className="p-6 pt-2 bg-gradient-to-t from-background to-transparent sticky bottom-0 z-20">
                    <Button
                        className="w-full h-14 text-lg font-bold shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Actualizando...
                            </div>
                        ) : (
                            `Guardar para ${selectedBranches.length} sucursales`
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

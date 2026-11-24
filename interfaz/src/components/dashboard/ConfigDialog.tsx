import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox-group";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { useIcon } from "@/lib/icon-context";
import { User, useUser } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";
import { normalizeString } from "@/lib/utils";

interface ConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    currentAssignedDays: number;
    currentStartDate: Date | string | null;
    onSave: (branches: string[], days: number, startDate?: string) => Promise<any>;
}

const DAY_OPTIONS = [90, 120, 150, 180];

export function ConfigDialog({
    open,
    onOpenChange,
    user,
    currentAssignedDays,
    currentStartDate,
    onSave
}: ConfigDialogProps) {
    const SearchIcon = useIcon("search");
    const ClockIcon = useIcon("clock");
    const { allBranches } = useUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [selectedDaysIndex, setSelectedDaysIndex] = useState(0);
    const [extensionDays, setExtensionDays] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [startDate, setStartDate] = useState("");

    // Initial load and reset when opening
    useEffect(() => {
        if (open) {
            setSearchQuery("");
            
            // Set days index and extension based on current branch days (default to 90 / index 0)
            const currentTotal = currentAssignedDays || 90;
            const standards = [180, 150, 120, 90];
            const foundBase = standards.find(s => s <= currentTotal) || 90;
            const idx = DAY_OPTIONS.indexOf(foundBase);
            setSelectedDaysIndex(idx !== -1 ? idx : 0);
            setExtensionDays(Math.max(0, currentTotal - foundBase));

            // Set start date string formatted for <input type="date"> (YYYY-MM-DD)
            if (currentStartDate) {
                const dateObj = new Date(currentStartDate);
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                setStartDate(`${yyyy}-${mm}-${dd}`);
            } else {
                setStartDate("");
            }

            // Default: select current user's branch (only if it is not Casa Central / admin view)
            const isSingleBranch = user?.role === 'branch' || (user?.branchName && user.branchName !== 'Casa Central');
            setSelectedBranches(isSingleBranch && user?.branchName ? [user.branchName] : []);
        }
    }, [open, currentAssignedDays, currentStartDate, user]);

    // Filter branches list
    const filteredBranches = useMemo(() => {
        return allBranches
            .filter(b => normalizeString(b).includes(normalizeString(searchQuery)))
            .sort();
    }, [searchQuery, allBranches]);

    // Map selected branches to indices in filtered list
    const checkedIndices = useMemo(() => {
        const set = new Set<number>();
        filteredBranches.forEach((branch, idx) => {
            if (selectedBranches.includes(branch)) {
                set.add(idx);
            }
        });
        return set;
    }, [filteredBranches, selectedBranches]);

    const handleToggleBranch = (index: number) => {
        const branchName = filteredBranches[index];
        if (!branchName) return;

        setSelectedBranches(prev =>
            prev.includes(branchName)
                ? prev.filter(b => b !== branchName)
                : [...prev, branchName]
        );
    };

    const handleSave = async () => {
        if (selectedBranches.length === 0) {
            notify.error("Atención", "Seleccione al menos una sucursal");
            return;
        }

        const total = (DAY_OPTIONS[selectedDaysIndex] || 90) + extensionDays;
        setIsSaving(true);
        try {
            // Convert 'YYYY-MM-DD' back to ISO string at local noon
            let startDateStr = undefined;
            if (startDate) {
                const [yyyy, mm, dd] = startDate.split('-').map(Number);
                const dateObj = new Date(yyyy, mm - 1, dd, 12, 0, 0);
                startDateStr = dateObj.toISOString();
            }

            await onSave(selectedBranches, total, startDateStr);
            notify.success("Operación exitosa", `Plazo y fecha actualizados para ${selectedBranches.length} sucursales`);
            onOpenChange(false);
        } catch (e) {
            notify.error("Error", "Error al guardar la configuración");
        } finally {
            setIsSaving(false);
        }
    };

    const totalDays = (DAY_OPTIONS[selectedDaysIndex] || 90) + extensionDays;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg" className="flex flex-col gap-8 p-8 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Configurar Plazo de Inventario</DialogTitle>
                    <DialogDescription>
                        Ajusta los parámetros del ciclo de inventario para las sucursales seleccionadas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6">
                    {/* Buscador de Sucursales */}
                    <div className="space-y-2">
                        <label className="text-[14px] text-foreground leading-tight block" style={{ fontVariationSettings: "'wght' 700" }}>
                            Buscar sucursal
                        </label>
                        <InputGroup>
                            <InputField
                                index={0}
                                placeholder="Escribe el nombre de la farmacia..."
                                icon={SearchIcon}
                                value={searchQuery}
                                onChange={setSearchQuery}
                                alwaysShowBorder
                            />
                        </InputGroup>
                    </div>

                    {/* Contenido en Paralelo (2 Columnas) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Columna Izquierda: Listado de Sucursales */}
                        <div className="space-y-3">
                            <label className="text-[14px] text-foreground leading-tight flex justify-between items-center" style={{ fontVariationSettings: "'wght' 700" }}>
                                <span>Sucursales ({selectedBranches.length} seleccionadas)</span>
                                {filteredBranches.length === 0 && (
                                    <span className="text-red-500 text-sm font-medium">Sin resultados</span>
                                )}
                            </label>
                            <div className="max-h-[200px] md:max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                <CheckboxGroup checkedIndices={checkedIndices}>
                                    {filteredBranches.map((branch, i) => (
                                        <CheckboxItem
                                            key={branch}
                                            index={i}
                                            label={branch}
                                            checked={selectedBranches.includes(branch)}
                                            onToggle={() => handleToggleBranch(i)}
                                        />
                                    ))}
                                </CheckboxGroup>
                            </div>
                        </div>

                        {/* Columna Derecha: Plazo del Ciclo */}
                        <div className="space-y-5">
                            <div className="space-y-3">
                                <label className="text-[14px] text-foreground leading-tight block" style={{ fontVariationSettings: "'wght' 700" }}>
                                    Plazo del ciclo (Días)
                                </label>
                                <RadioGroup selectedIndex={selectedDaysIndex} className="flex flex-col w-full gap-2">
                                    {DAY_OPTIONS.map((days, i) => (
                                        <RadioItem
                                            key={days}
                                            index={i}
                                            label={`${days} Días`}
                                            selected={selectedDaysIndex === i}
                                            onSelect={() => setSelectedDaysIndex(i)}
                                        />
                                    ))}
                                </RadioGroup>
                            </div>

                            {/* Prórroga adicional */}
                            <div className="space-y-3 pt-2">
                                <label className="text-[14px] text-foreground leading-tight block" style={{ fontVariationSettings: "'wght' 700" }}>
                                    Prórroga adicional (Días)
                                </label>
                                <InputGroup>
                                    <InputField
                                        index={0}
                                        type="number"
                                        min={0}
                                        placeholder="Escribe los días..."
                                        value={extensionDays === 0 ? "" : String(extensionDays)}
                                        onChange={(val) => setExtensionDays(Math.max(0, parseInt(val) || 0))}
                                        alwaysShowBorder
                                    />
                                </InputGroup>
                            </div>

                            {/* Fecha de Inicio */}
                            <div className="space-y-3 pt-2">
                                <label className="text-[14px] text-foreground leading-tight block" style={{ fontVariationSettings: "'wght' 700" }}>
                                    Fecha de Inicio del Ciclo
                                </label>
                                <InputGroup>
                                    <InputField
                                        index={0}
                                        type="date"
                                        placeholder="Seleccione la fecha de inicio..."
                                        value={startDate}
                                        onChange={(val) => setStartDate(val)}
                                        alwaysShowBorder
                                    />
                                </InputGroup>
                            </div>

                            {/* Resumen Total del Ciclo */}
                            <div className="flex justify-between items-center pt-4 border-t border-border/10">
                                <span className="text-[14px] text-muted-foreground">Total del ciclo:</span>
                                <span className="text-[14px] text-foreground" style={{ fontVariationSettings: "'wght' 700" }}>
                                    {totalDays} días
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-2">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        loading={isSaving}
                        className="bg-foreground text-background hover:bg-foreground/90 rounded-xl"
                    >
                        Guardar para {selectedBranches.length} {selectedBranches.length === 1 ? 'sucursal' : 'sucursales'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";

interface ConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    currentAssignedDays: number;
    currentStartDate: string | null;
    onSave: (branch: string, days: number, startDate?: string) => Promise<any>;
}

export function ConfigDialog({
    open,
    onOpenChange,
    user,
    currentAssignedDays,
    currentStartDate,
    onSave
}: ConfigDialogProps) {
    const [configBranch, setConfigBranch] = useState("");
    const [configDays, setConfigDays] = useState(90);
    const [extensionDays, setExtensionDays] = useState(0);
    const [configStartDate, setConfigStartDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (open) {
            const currentTotal = currentAssignedDays || 90;
            const standards = [180, 150, 120, 90];
            // Find largest standard less than or equal to current
            const foundBase = standards.find(s => s <= currentTotal) || 90;

            setConfigBranch(user?.branchName || '');
            setConfigDays(foundBase);
            setExtensionDays(Math.max(0, currentTotal - foundBase));
            setConfigStartDate(currentStartDate ? currentStartDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        }
    }, [open, currentAssignedDays, currentStartDate, user]);

    const handleSave = async () => {
        if (!user?.branchName) return;
        const total = configDays + extensionDays;
        try {
            await onSave(user.branchName, total, configStartDate);
            notify.success("Operación exitosa", `Plazo actualizado a ${total} días`);
            onOpenChange(false);
        } catch (e) {
            notify.error("Error", "Error al guardar");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Configurar Plazo de Inventario</DialogTitle>
                    <DialogDescription>
                        Ajusta los parámetros del ciclo de inventario para esta sucursal.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Branch Display (Read Only) */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Sucursal Seleccionada</Label>
                        <div className="text-lg font-semibold border p-3 rounded-md bg-muted/50">
                            {user?.branchName || 'Sin sucursal asignada'}
                        </div>
                    </div>

                    {/* Standard Days Selection */}
                    <div className="space-y-3">
                        <Label>Días Base</Label>
                        <div className="grid grid-cols-4 gap-3">
                            {[90, 120, 150, 180].map((days) => (
                                <button
                                    key={days}
                                    onClick={() => setConfigDays(days)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                        configDays === days
                                            ? "border-primary bg-primary/10 text-primary font-bold"
                                            : "border-muted hover:border-primary/50 text-muted-foreground"
                                    )}
                                >
                                    <span className="text-xl">{days}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Extension Input */}
                    <div className="space-y-2">
                        <Label>Próroga (Días adicionales)</Label>
                        <div className="flex gap-4 items-center">
                            <Input
                                type="number"
                                placeholder="0"
                                className="text-lg font-medium"
                                value={extensionDays}
                                onChange={(e) => setExtensionDays(Number(e.target.value))}
                                min={0}
                            />
                            <div className="text-sm text-muted-foreground text-nowrap">
                                Total: <span className="font-bold text-foreground mx-1 text-lg">
                                    {configDays + extensionDays}
                                </span> días
                            </div>
                        </div>
                    </div>

                    {/* Start Date Selection */}
                    <div className="space-y-2">
                        <Label>Fecha de Inicio del Ciclo</Label>
                        <Input
                            type="date"
                            value={configStartDate}
                            onChange={(e) => setConfigStartDate(e.target.value)}
                            className="bg-background"
                        />
                        <p className="text-[10px] text-muted-foreground">Esta fecha se usa para calcular los días restantes y el ritmo de avance.</p>
                    </div>

                    <Button
                        className="w-full mt-2"
                        onClick={handleSave}
                    >
                        Guardar Configuración
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

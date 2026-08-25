import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { requestsService } from "@/services/requestsService";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import { normalizeString } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface LabRemovalModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    labName: string;
    category?: string;
    branchName?: string;
    onSuccess?: () => void;
}

const PRESET_REASONS = [
    "Stock 0 en Plex / Sin existencias",
    "Laboratorio discontinuado / no se comercializa",
    "Asignación incorrecta de rubro",
    "Laboratorio duplicado en el listado",
    "Otro motivo (especificar)"
];

export function LabRemovalModal({
    open,
    onOpenChange,
    labName,
    category = "MEDICAMENTOS",
    branchName,
    onSuccess
}: LabRemovalModalProps) {
    const { user } = useUser();
    
    // Rubros detectados dinámicamente para este laboratorio
    const [availableRubros, setAvailableRubros] = useState<string[]>([]);
    const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
    const [rubroError, setRubroError] = useState<string | null>(null);

    // Motivos y observaciones
    const [reason, setReason] = useState(PRESET_REASONS[0]);
    const [customReason, setCustomReason] = useState("");
    const [comments, setComments] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const targetBranch = branchName || user?.branchSheet || "SUCURSAL";

    // Cargar rubros reales en los que existe este laboratorio
    useEffect(() => {
        if (!open || !labName) return;

        let isMounted = true;
        const fetchCategories = async () => {
            try {
                const found = new Set<string>();
                const cleanBranch = normalizeString(targetBranch);
                const upperBranch = (targetBranch || '').trim().toUpperCase();
                const labUpper = labName.trim().toUpperCase();

                // 1. Buscar en branch_laboratories para la sucursal y laboratorio
                const { data: branchLabs } = await (supabase as any)
                    .from('branch_laboratories')
                    .select('category')
                    .ilike('laboratory', labUpper)
                    .or(`branch_name.eq.${cleanBranch},branch_name.eq.${targetBranch.trim()},branch_name.eq.${upperBranch}`);

                if (branchLabs && branchLabs.length > 0) {
                    branchLabs.forEach((item: any) => {
                        if (item.category) {
                            found.add(item.category.trim().toUpperCase());
                        }
                    });
                }

                // 2. Si no hay registros específicos, consultar catálogo de productos
                if (found.size === 0) {
                    const { data: prodData } = await (supabase as any)
                        .from('products')
                        .select('category')
                        .ilike('laboratory', labUpper)
                        .limit(50);

                    if (prodData && prodData.length > 0) {
                        prodData.forEach((p: any) => {
                            if (p.category) {
                                found.add(p.category.trim().toUpperCase());
                            }
                        });
                    }
                }

                // Si aún no se encontró ninguno, incluir el rubro actual o MEDICAMENTOS
                if (found.size === 0) {
                    found.add(category ? category.toUpperCase() : "MEDICAMENTOS");
                }

                const catList = Array.from(found);
                if (isMounted) {
                    setAvailableRubros(catList);
                    // Por defecto seleccionar el rubro en el que se hizo click o el único existente
                    if (category && catList.includes(category.toUpperCase())) {
                        setSelectedRubros([category.toUpperCase()]);
                    } else if (catList.length === 1) {
                        setSelectedRubros([catList[0]]);
                    } else {
                        setSelectedRubros(["TOTAL"]);
                    }
                }
            } catch (e) {
                console.error("Error al obtener rubros:", e);
                if (isMounted) {
                    const fallback = category ? category.toUpperCase() : "MEDICAMENTOS";
                    setAvailableRubros([fallback]);
                    setSelectedRubros([fallback]);
                }
            }
        };

        // Resetear formulario
        setReason(PRESET_REASONS[0]);
        setCustomReason("");
        setComments("");
        setRubroError(null);

        fetchCategories();

        return () => {
            isMounted = false;
        };
    }, [open, labName, targetBranch, category]);

    const handleRubrosChange = (values: string[]) => {
        setRubroError(null);
        if (!values || values.length === 0) {
            setSelectedRubros([]);
            return;
        }

        const lastVal = values[values.length - 1];
        if (lastVal === "TOTAL") {
            setSelectedRubros(["TOTAL"]);
            return;
        }

        const filtered = values.filter(v => v !== "TOTAL");
        setSelectedRubros(filtered.length > 0 ? filtered : ["TOTAL"]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedRubros || selectedRubros.length === 0) {
            setRubroError("Debes seleccionar al menos un rubro.");
            return;
        }
        
        const finalReason = reason === "Otro motivo (especificar)" 
            ? (customReason.trim() || "Otro motivo") 
            : reason;

        const finalCategory = selectedRubros.includes("TOTAL") 
            ? "Baja Total" 
            : selectedRubros.join(", ");

        setIsSubmitting(true);
        try {
            await requestsService.createRequest({
                type: "Baja de Laboratorio",
                branchName: targetBranch,
                targetName: labName,
                category: finalCategory,
                reason: finalReason,
                comments: comments.trim() || undefined,
                requestedBy: user?.username || user?.branchSheet || "Operador"
            });

            notify.success(
                "Solicitud Enviada", 
                `Se solicitó la baja de ${labName} (${finalCategory}). El equipo administrativo evaluará tu pedido.`
            );
            
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error("Error creating removal request:", error);
            notify.error("Error", "No se pudo enviar la solicitud. Intenta nuevamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg" className="sm:max-w-xl font-sans">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold font-sans">
                        Solicitar Baja de Laboratorio
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1 font-sans">
                        Registra un pedido formal para dar de baja este laboratorio de los ciclos de conteo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2 font-sans">
                    {/* Información simplificada del laboratorio */}
                    <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-base text-foreground font-sans">
                            {labName}
                        </span>
                        <span className="text-xs text-muted-foreground font-sans">
                            Sucursal solicitante: <span className="text-foreground font-medium">{targetBranch}</span>
                        </span>
                    </div>

                    {/* Rubros a dar de baja (Mismo Select que Motivos con soporte múltiple) */}
                    <div className="flex flex-col gap-1.5 pt-1">
                        <label className="text-xs font-semibold text-foreground font-sans flex items-center justify-between">
                            <span>Rubros a dar de baja:</span>
                            <span className="text-[10px] text-muted-foreground font-normal">Obligatorio</span>
                        </label>
                        <Select 
                            multiple 
                            value={selectedRubros} 
                            onValueChange={handleRubrosChange}
                        >
                            <SelectTrigger placeholder="Seleccionar rubros..." className="h-9 text-xs w-full font-sans" />
                            <SelectContent className="max-h-[220px]">
                                <SelectItem index={0} value="TOTAL" className="font-sans text-xs">
                                    Baja Total
                                </SelectItem>
                                {availableRubros.map((rubro, idx) => (
                                    <SelectItem key={rubro} index={idx + 1} value={rubro} className="font-sans text-xs">
                                        {rubro}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {rubroError && (
                            <span className="text-[11px] font-medium text-red-500 font-sans">
                                {rubroError}
                            </span>
                        )}
                    </div>

                    {/* Motivo de la baja */}
                    <div className="flex flex-col gap-1.5 pt-1">
                        <label className="text-xs font-semibold text-foreground font-sans">
                            Motivo de la baja:
                        </label>
                        <Select value={reason} onValueChange={(val) => setReason(val || PRESET_REASONS[0])}>
                            <SelectTrigger placeholder="Selecciona un motivo..." className="h-9 text-xs w-full font-sans" />
                            <SelectContent className="max-h-[220px]">
                                {PRESET_REASONS.map((r, idx) => (
                                    <SelectItem key={r} value={r} index={idx} className="font-sans text-xs">
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Motivo personalizado si seleccionó Otro */}
                    {reason === "Otro motivo (especificar)" && (
                        <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in-50">
                            <label className="text-xs font-semibold text-foreground font-sans">
                                Especificar motivo:
                            </label>
                            <Input
                                placeholder="Describe brevemente el motivo..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="h-9 text-xs font-sans bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 rounded-xl px-3 border border-border"
                                required
                            />
                        </div>
                    )}

                    {/* Observaciones o detalles */}
                    <div className="flex flex-col gap-1.5 pt-1">
                        <label className="text-xs font-semibold text-foreground font-sans">
                            Observaciones o detalles: <span className="text-muted-foreground font-normal">(opcional)</span>
                        </label>
                        <Input
                            placeholder="Ej: Verificado físicamente en salón y depósito..."
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            className="h-9 text-xs font-sans bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 rounded-xl px-3 border border-border"
                        />
                    </div>

                    <DialogFooter className="pt-3 gap-2 sm:gap-0">
                        <DialogClose render={<Button type="button" variant="ghost" className="font-sans text-xs" />}>
                            Cancelar
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-foreground text-background hover:bg-foreground/90 font-sans text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
                        >
                            {isSubmitting ? "Enviando..." : "Confirmar Solicitud"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

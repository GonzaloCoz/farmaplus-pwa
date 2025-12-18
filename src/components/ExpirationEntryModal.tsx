
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BatchInfo } from "@/services/expirationDB";
import { Plus, Trash2, Calendar, BellRing, Package, X, Calculator as CalculatorIcon, Clock, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { notify } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "@/components/Calculator";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface ExpirationEntryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productName: string;
    ean: string;
    initialBatches: BatchInfo[]; // Batches already saved for this product
    onSave: (batches: BatchInfo[]) => void;
}

export function ExpirationEntryModal({
    open,
    onOpenChange,
    productName,
    ean,
    initialBatches,
    onSave,
}: ExpirationEntryModalProps) {
    const [batches, setBatches] = useState<BatchInfo[]>([]);

    // Input State
    const [batchNumber, setBatchNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [quantity, setQuantity] = useState("");
    const [reminder, setReminder] = useState<number>(1); // Default 1 month
    const [showCalculator, setShowCalculator] = useState(false);
    const [manualReminder, setManualReminder] = useState("");

    const handleCalculatorResult = (result: number) => {
        setQuantity(Math.floor(result).toString());
        // setShowCalculator(false); 
    };

    // Load initial batches when opening
    useEffect(() => {
        if (open) {
            setBatches([...initialBatches]);
            resetInputs();
        }
    }, [open, initialBatches]);

    const resetInputs = () => {
        setBatchNumber("");
        setExpiry("");
        setQuantity("");
        setReminder(1);
        setManualReminder("");
    };

    const handleExpiryChange = (val: string) => {
        // Detect deletion to allow backspace over '/'
        if (val.length < expiry.length) {
            setExpiry(val);
            return;
        }

        // MM/YY Logic
        let v = val.replace(/\D/g, "");
        if (v.length >= 2) {
            const month = parseInt(v.slice(0, 2));
            if (month === 0 || month > 12) v = v.slice(0, 1); // Basic validation
        }
        if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
        if (v.length > 5) v = v.slice(0, 5);
        setExpiry(v);
    };

    const handleAddBatch = () => {
        if (!batchNumber.trim()) return notify.error("Datos incompletos", "Falta el número de lote");
        if (expiry.length < 5) return notify.error("Fecha incompleta", "Ingresa la fecha en formato MM/AA");
        if (!quantity || Number(quantity) <= 0) return notify.error("Cantidad inválida", "La cantidad debe ser mayor a 0");

        const reminderVal = manualReminder ? parseInt(manualReminder) : reminder;
        if (isNaN(reminderVal) || reminderVal <= 0) return notify.error("Alerta inválida", "Meses de alerta inválidos");

        // Date Validation
        const [monthStr, yearStr] = expiry.split('/');
        const month = parseInt(monthStr);
        const year = 2000 + parseInt(yearStr);

        // Create date for the LAST day of the expiry month
        const expiryDate = new Date(year, month, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        if (expiryDate < today) {
            return notify.error("Fecha inválida", "El producto ya está vencido. No se puede ingresar.");
        }


        const newBatch: BatchInfo = {
            batchNumber: batchNumber.toUpperCase(),
            expirationDate: expiry,
            quantity: Number(quantity),
            reminderMonths: reminderVal,
            status: 'active'
        };

        setBatches((prev) => [...prev, newBatch]);
        notify.success("Lote agregado", "El lote se agregó correctamente");
        resetInputs();

        // Optional: Focus back on Lote input? Needs ref.
        // For now, flow is naturally robust enough.
    };

    const handleRemoveBatch = (index: number) => {
        setBatches((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave(batches);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-md p-0 overflow-hidden gap-0 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl"
                onInteractOutside={(e) => e.preventDefault()}
            >
                {/* Header */}
                <div className="bg-primary px-6 py-5 relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/3">
                        <Package size={120} />
                    </div>

                    <DialogHeader className="relative z-10 text-primary-foreground text-left space-y-1">
                        <DialogTitle className="text-xl font-bold leading-tight pr-8 line-clamp-2">
                            {productName}
                        </DialogTitle>
                        <DialogDescription className="text-primary-foreground/70 text-xs font-mono">
                            EAN: {ean}
                        </DialogDescription>
                    </DialogHeader>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 text-primary-foreground/50 hover:text-primary-foreground hover:bg-white/10 rounded-full h-8 w-8 z-20"
                        onClick={() => onOpenChange(false)}
                    >
                        <X size={18} />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Add Batch Form */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-3">
                            {/* Lote */}
                            <div className="col-span-5 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1">Nro. Lote</label>
                                <div className="relative">
                                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <Input
                                        value={batchNumber}
                                        onChange={(e) => setBatchNumber(e.target.value)}
                                        placeholder="A123"
                                        className="pl-9 bg-muted/30 border-muted-foreground/20 focus:bg-background h-10 transition-colors uppercase"
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            {/* Vencimiento */}
                            <div className="col-span-4 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1">Vence</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <Input
                                        value={expiry}
                                        onChange={(e) => handleExpiryChange(e.target.value)}
                                        placeholder="MM/AA"
                                        className="pl-9 bg-muted/30 border-muted-foreground/20 focus:bg-background h-10 transition-colors text-center"
                                        maxLength={5}
                                    />
                                </div>
                            </div>

                            {/* Cantidad + Reminder */}
                            <div className="col-span-3 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1 text-center">Cant.</label>
                                <div className="flex gap-1">
                                    <div className="relative flex-1">
                                        <Input
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            placeholder="0"
                                            className="px-1 text-center bg-muted/30 border-muted-foreground/20 focus:bg-background h-10 transition-colors font-bold"
                                            type="number"
                                        />
                                    </div>

                                    {/* Reminder Popover */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 shrink-0 border-muted-foreground/20 bg-muted/30 hover:bg-background relative"
                                                title="Alerta de vencimiento"
                                            >
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground font-bold border border-background">
                                                    {manualReminder || reminder}
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-3" align="end">
                                            <div className="space-y-3">
                                                <h4 className="font-medium text-sm leading-none flex items-center gap-2">
                                                    <BellRing className="w-4 h-4 text-primary" />
                                                    Anticipación de Alerta
                                                </h4>
                                                <p className="text-xs text-muted-foreground">
                                                    ¿Cuantos meses antes quieres que te avisemos?
                                                </p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[1, 2, 3, 4, 6, 12].map((m) => (
                                                        <Button
                                                            key={m}
                                                            variant={reminder === m && !manualReminder ? "default" : "outline"}
                                                            size="sm"
                                                            className="h-8 text-xs"
                                                            onClick={() => {
                                                                setReminder(m);
                                                                setManualReminder("");
                                                            }}
                                                        >
                                                            {m} Mes{m > 1 ? 'es' : ''}
                                                        </Button>
                                                    ))}
                                                </div>
                                                <div className="pt-2 border-t mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Personalizado:</span>
                                                        <Input
                                                            className="h-7 text-xs"
                                                            placeholder="#"
                                                            type="number"
                                                            value={manualReminder}
                                                            onChange={(e) => setManualReminder(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {showCalculator && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border rounded-lg bg-muted/20"
                                >
                                    <Calculator
                                        onResult={handleCalculatorResult}
                                        onClose={() => setShowCalculator(false)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>



                        {/* Add Button - Full Width for mobile ergonomics */}
                        <Button
                            className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-11"
                            onClick={handleAddBatch}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Agregar Lote
                        </Button>
                    </div>

                    {/* Batches List - Animated */}
                    <div className="bg-muted/30 rounded-xl p-1 min-h-[120px] max-h-[220px] overflow-y-auto border border-border/50">
                        <AnimatePresence initial={false} mode="popLayout">
                            {batches.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-muted-foreground py-8"
                                >
                                    <Package className="w-8 h-8 opacity-20 mb-2" />
                                    <p className="text-xs">No hay lotes agregados</p>
                                </motion.div>
                            ) : (
                                batches.map((batch, idx) => (
                                    <motion.div
                                        key={`${batch.batchNumber}-${idx}`}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                        className="bg-card p-3 rounded-lg shadow-sm border mb-2 flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-1 ring-primary/20 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-mono font-bold text-sm tracking-tight truncate max-w-[80px] sm:max-w-none">{batch.batchNumber}</span>
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-border whitespace-nowrap">
                                                        Vence: {batch.expirationDate}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Reminder Info */}
                                            {batch.reminderMonths && (
                                                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium bg-muted/50 px-2 py-1 rounded text-muted-foreground whitespace-nowrap" title={`${batch.reminderMonths} meses de alerta`}>
                                                    <Clock className="w-3 h-3" />
                                                    <span>{batch.reminderMonths}m</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 border-l pl-3 ml-1 h-8">
                                                <span className="text-lg font-bold tabular-nums">x{batch.quantity}</span>

                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                        onClick={() => {
                                                            setBatchNumber(batch.batchNumber);
                                                            setExpiry(batch.expirationDate);
                                                            setQuantity(batch.quantity.toString());
                                                            setReminder(batch.reminderMonths || 1);
                                                            handleRemoveBatch(idx);
                                                        }}
                                                        title="Editar lote"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                        {/* Using FileText as Edit icon alternative or could import Pencil */}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveBatch(idx)}
                                                        title="Eliminar lote"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-muted/30 border-t flex-row gap-3">
                    <div className="flex-1 flex items-center text-sm font-medium text-muted-foreground">
                        Total: <span className="ml-1 text-foreground font-bold">{batches.reduce((acc, b) => acc + b.quantity, 0)} u.</span>
                    </div>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={batches.length === 0} className="px-8">
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

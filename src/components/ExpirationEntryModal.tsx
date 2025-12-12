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
import { Plus, Trash2, Calendar, BellRing, Package, X, Calculator as CalculatorIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "@/components/Calculator";

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
    const [reminder, setReminder] = useState<number | string>(1);
    const [showCalculator, setShowCalculator] = useState(false);

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
        if (!batchNumber.trim()) return toast.error("Falta el Lote");
        if (expiry.length < 5) return toast.error("Fecha incompleta (MM/AA)");
        if (!quantity || Number(quantity) <= 0) return toast.error("Cantidad inválida");

        const newBatch: BatchInfo = {
            batchNumber: batchNumber.toUpperCase(),
            expirationDate: expiry,
            quantity: Number(quantity),
            reminderMonths: typeof reminder === "string" ? parseInt(reminder) : reminder,
        };

        setBatches((prev) => [...prev, newBatch]);
        toast.success("Lote agregado", { position: "top-center" }); // Center toast for focus
        resetInputs();

        // Optional: Focus back on Lote input? Needs ref.
        // For now, flow is naturally robust enough.
    };

    const handleRemoveBatch = (index: number) => {
        setBatches((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSaveAll = () => {
        if (batches.length === 0) return toast.warning("Debes agregar al menos un lote");
        onSave(batches);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0 bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl">
                {/* Header - High Contrast */}
                <div className="bg-primary px-6 py-5 text-primary-foreground relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Package className="w-24 h-24 rotate-12" />
                    </div>
                    <DialogTitle className="text-xl font-bold leading-tight pr-8 relative z-10">
                        {productName}
                    </DialogTitle>
                    <DialogDescription className="text-primary-foreground/80 mt-1 font-mono text-xs relative z-10">
                        EAN: {ean}
                    </DialogDescription>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/10"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Input Section - Grouped with visual hierarchy */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-12 sm:col-span-5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block ml-1">
                                    Nro. Lote
                                </label>
                                <div className="relative">
                                    <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        value={batchNumber}
                                        onChange={e => setBatchNumber(e.target.value.toUpperCase())}
                                        className="pl-9 font-mono bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                        placeholder="A123"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="col-span-7 sm:col-span-4">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block ml-1">
                                    Vence
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        value={expiry}
                                        onChange={e => handleExpiryChange(e.target.value)}
                                        className="pl-9 text-center bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                        placeholder="MM/AA"
                                        maxLength={5}
                                    />
                                </div>
                            </div>

                            <div className="col-span-5 sm:col-span-3">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block ml-1">
                                    Cant.
                                </label>
                                <div className="flex gap-1">
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        className="text-center font-bold text-lg bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                        placeholder="0"
                                    />
                                    <Button
                                        variant={showCalculator ? "secondary" : "outline"}
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
                                        onClick={() => setShowCalculator(!showCalculator)}
                                        title="Calculadora"
                                    >
                                        <CalculatorIcon className="w-4 h-4" />
                                    </Button>
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
                        <Button onClick={handleAddBatch} className="w-full text-sm h-11 shadow-lg shadow-primary/20" size="lg">
                            <Plus className="w-5 h-5 mr-2" /> Agregar Lote
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
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-1 ring-primary/20">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-mono font-bold text-sm tracking-tight">{batch.batchNumber}</span>
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-border">
                                                        Vence: {batch.expirationDate}
                                                    </Badge>
                                                </div>

                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-bold tabular-nums">x{batch.quantity}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveBatch(idx)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
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
                    <Button onClick={handleSaveAll} disabled={batches.length === 0} className="px-8">
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

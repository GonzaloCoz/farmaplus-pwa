import { useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { searchProducts, Product } from "@/services/preCountDB"
import { useUser } from "@/contexts/UserContext"
import { CreateReturnDTO } from "@/services/returnsService"
import { useDebounce } from "@/hooks/useDebounce"
import { Loader2, Search } from "lucide-react"

interface CreateReturnDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: CreateReturnDTO) => Promise<void>
}

export function CreateReturnDialog({ open, onOpenChange, onSubmit }: CreateReturnDialogProps) {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState<"expired" | "damaged" | "recall" | "other">("expired");
    const [notes, setNotes] = useState("");

    const handleSearch = async () => {
        if (!searchTerm) return;
        setIsSearching(true);
        try {
            const results = await searchProducts(searchTerm);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    }

    const handleSubmit = async () => {
        if (!selectedProduct) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                branch_name: user?.branchName || 'Unknown',
                product_ean: selectedProduct.ean,
                product_name: selectedProduct.name,
                supplier: selectedProduct.laboratory,
                quantity,
                reason,
                notes
            });
            onOpenChange(false);
            // Reset form
            setSelectedProduct(null);
            setQuantity(1);
            setNotes("");
            setSearchTerm("");
            setSearchResults([]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Devolución</DialogTitle>
                    <DialogDescription>
                        Busca el producto y especifica el motivo de la devolución.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Product Search */}
                    {!selectedProduct ? (
                        <div className="space-y-3">
                            <Label>Buscar Producto</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="EAN o Nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button onClick={handleSearch} disabled={isSearching} size="icon">
                                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>

                            {/* Results List */}
                            {searchResults.length > 0 && (
                                <div className="max-h-[200px] overflow-y-auto border rounded-md p-1 space-y-1">
                                    {searchResults.map(p => (
                                        <div
                                            key={p.ean}
                                            className="p-2 hover:bg-muted rounded cursor-pointer text-sm"
                                            onClick={() => setSelectedProduct(p)}
                                        >
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-xs text-muted-foreground flex justify-between">
                                                <span>{p.ean}</span>
                                                <span>{p.laboratory}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="border rounded-md p-3 bg-muted/20 relative">
                            <Label className="text-xs text-muted-foreground">Producto Seleccionado</Label>
                            <div className="font-medium text-lg">{selectedProduct.name}</div>
                            <div className="text-sm text-muted-foreground">{selectedProduct.ean} - {selectedProduct.laboratory}</div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2 text-xs h-6"
                                onClick={() => setSelectedProduct(null)}
                            >
                                Cambiar
                            </Button>
                        </div>
                    )}

                    {/* Details Form */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cantidad</Label>
                            <Input
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Motivo</Label>
                            <Select value={reason} onValueChange={(v: any) => setReason(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="expired">Vencido</SelectItem>
                                    <SelectItem value="damaged">Dañado / Roto</SelectItem>
                                    <SelectItem value="recall">Recall Lab</SelectItem>
                                    <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notas Adicionales</Label>
                        <Textarea
                            placeholder="Detalles sobre estado, lote, etc."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !selectedProduct}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

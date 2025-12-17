import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BatchInfo } from '@/services/expirationDB';
import { Calendar, Package, Hash, Building2, Truck } from 'lucide-react';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (destinationBranch: string, plexShipmentNumber: string) => void;
    batch: BatchInfo & { productName: string; ean: string } | null;
    branches: string[];
}

export function TransferModal({ isOpen, onClose, onConfirm, batch, branches }: TransferModalProps) {
    const [destinationBranch, setDestinationBranch] = useState('');
    const [plexShipmentNumber, setPlexShipmentNumber] = useState('');
    const [error, setError] = useState('');

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setDestinationBranch('');
            setPlexShipmentNumber('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (!destinationBranch) {
            setError('Debes seleccionar una sucursal de destino');
            return;
        }
        if (!plexShipmentNumber.trim()) {
            setError('El número de envío Plex es obligatorio');
            return;
        }

        onConfirm(destinationBranch, plexShipmentNumber);
        onClose();
    };

    if (!batch) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-600" />
                        Transferencia Inter-Sucursal
                    </DialogTitle>
                    <DialogDescription>
                        Complete los datos del envío para registrar la transferencia.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Product Summary Card */}
                    <div className="bg-muted/40 p-4 rounded-lg space-y-3 border border-border/50">
                        <div>
                            <h4 className="font-semibold text-sm line-clamp-2">{batch.productName}</h4>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">EAN: {batch.ean}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Hash className="w-3.5 h-3.5" />
                                <span className="text-xs">Lote: <span className="font-medium text-foreground">{batch.batchNumber}</span></span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="text-xs">Venc: <span className="font-medium text-foreground">{batch.expirationDate}</span></span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Package className="w-3.5 h-3.5" />
                                <span className="text-xs">Cant: <span className="font-medium text-foreground">{batch.quantity} un.</span></span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="branch">Sucursal de Destino</Label>
                            <Select value={destinationBranch} onValueChange={setDestinationBranch}>
                                <SelectTrigger id="branch">
                                    <SelectValue placeholder="Seleccionar sucursal..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {branches.map((branch) => (
                                        <SelectItem key={branch} value={branch}>
                                            {branch}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="plex" className="flex items-center justify-between">
                                Número de Envío Plex
                                <Badge variant="outline" className="text-[10px] h-5">Obligatorio</Badge>
                            </Label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="plex"
                                    placeholder="Ingrese el número de envío..."
                                    value={plexShipmentNumber}
                                    onChange={(e) => setPlexShipmentNumber(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Este número es requerido para la trazabilidad en el sistema.
                            </p>
                        </div>

                        {error && (
                            <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded">
                                {error}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
                        Confirmar Transferencia
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

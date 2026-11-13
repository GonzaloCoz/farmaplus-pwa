import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, AlertTriangle, X } from 'lucide-react';

interface DataMatrixTraceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: {
        name: string;
        ean: string;
        id_producto?: string;
        gtin?: string;
    } | null;
    onNoSerial: () => void;
    onCancel: () => void;
}

export const DataMatrixTraceModal: React.FC<DataMatrixTraceModalProps> = ({
    open,
    onOpenChange,
    product,
    onNoSerial,
    onCancel,
}) => {
    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-6 rounded-2xl shadow-2xl">
                <DialogHeader className="items-center text-center">
                    <Badge variant="outline" className="mb-2 border-sky-500/30 text-sky-400 bg-sky-500/10 px-3 py-1 font-semibold text-xs tracking-wider">
                        TRAZABILIDAD ANMAT
                    </Badge>
                    <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <QrCode className="size-5 text-sky-400 animate-pulse" />
                        Escanear DataMatrix
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-400 mt-1 max-w-xs">
                        Apunta el lector al código DataMatrix (cuadrado) en el envase para capturar Serie, Lote y Vencimiento.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 my-2 text-center space-y-1">
                    <p className="text-sm font-semibold text-zinc-100 leading-snug">
                        {product.name}
                    </p>
                    <p className="text-xs font-mono text-zinc-400">
                        EAN: {product.ean} {product.gtin ? `| GTIN: ${product.gtin}` : ''}
                    </p>
                </div>

                <div className="text-xs text-zinc-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2.5">
                    <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                        Si el DataMatrix está roto, borrado o no vino en el envase, utiliza el botón <strong>Sin DataMatrix</strong> para contar la unidad sin serie.
                    </span>
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2 mt-4">
                    <Button
                        type="button"
                        onClick={onNoSerial}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl shadow-lg transition-all"
                    >
                        Sin DataMatrix / Ilegible (+1)
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 py-2 rounded-xl"
                    >
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

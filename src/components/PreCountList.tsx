import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pen as Pencil, TrashBinMinimalistic as Trash2, Widget as Package, Copy, CheckCircle as Check } from '@solar-icons/react';
import { UIPreCountItem } from '@/hooks/usePreCount';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

interface PreCountListProps {
    items: UIPreCountItem[];
    onUpdate: (id: string, quantity: number) => void;
    onDelete: (id: string) => void;
}

export function PreCountList({ items, onUpdate, onDelete }: PreCountListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleStartEdit = (item: UIPreCountItem) => {
        setEditingId(item.id);
        setEditQuantity(item.quantity.toString());
    };

    const handleSaveEdit = () => {
        if (editingId && editQuantity) {
            const quantity = parseInt(editQuantity, 10);
            if (quantity > 0) {
                onUpdate(editingId, quantity);
                setEditingId(null);
                setEditQuantity('');
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditQuantity('');
    };


    const getDeviceColor = (deviceId?: string) => {
        if (!deviceId) return 'transparent';
        // Simple hash to generate a hue
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
            hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 45%)`;
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (items.length === 0) {
        return (
            <Card className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                    No hay productos agregados aún
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                    Escanea o busca productos para comenzar
                </p>
            </Card>
        );
    }

    return (
        <>
            <div className="max-h-[600px] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <AnimatePresence>
                        {items.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                style={{ contentVisibility: 'auto' }}
                            >
                                <Card className={`h-full relative overflow-hidden group transition-all duration-300 bg-card border ${item.productName.startsWith('Producto ')
                                    ? 'border-destructive shadow-[0_0_0_0.5px_inset_hsl(var(--destructive)/0.1)] bg-destructive/[0.02]'
                                    : item.synced === 0
                                        ? 'border-warning shadow-[0_0_0_0.5px_inset_hsl(var(--warning)/0.2)] bg-warning/[0.03]'
                                        : 'border-muted/40 elevation-1 hover:elevation-2 hover:bg-muted/5'
                                    }`}>
                                    <div className="p-4 flex flex-col h-full gap-3">
                                        {/* Header: Name */}
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="text-title-small md:text-title-medium leading-tight line-clamp-2 text-foreground/90 font-semibold tracking-tight" title={item.productName}>
                                                {item.productName}
                                            </h4>
                                        </div>

                                        {/* Meta: EAN with Copy functionality */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => copyToClipboard(item.ean, item.id)}
                                                className="flex items-center gap-2 text-foreground/90 hover:brightness-110 px-2.5 py-1.5 rounded-lg border transition-all group/ean active:scale-95 shadow-sm"
                                                style={{ 
                                                    backgroundColor: `${getDeviceColor(item.deviceId)}15`, // 15 is hex for ~8% opacity
                                                    borderColor: `${getDeviceColor(item.deviceId)}40`,     // 40 is hex for ~25% opacity
                                                }}
                                                title="Copiar EAN"
                                            >
                                                <span 
                                                    className="text-[10px] font-bold uppercase tracking-widest border-r pr-2"
                                                    style={{ borderColor: `${getDeviceColor(item.deviceId)}40` }}
                                                >
                                                    EAN
                                                </span>
                                                <span className="text-xs sm:text-sm font-mono tracking-wider font-medium">
                                                    {item.ean}
                                                </span>
                                                {copiedId === item.id ? (
                                                    <Check className="w-3.5 h-3.5 text-success animate-bounce-in" />
                                                ) : (
                                                    <Copy 
                                                        className="w-3.5 h-3.5 opacity-40 group-hover/ean:opacity-100 transition-opacity"
                                                        style={{ color: getDeviceColor(item.deviceId) }}
                                                    />
                                                )}
                                            </button>

                                            {item.productName.startsWith('Producto ') ? (
                                                <div className="ml-auto">
                                                    <span className="text-[10px] text-destructive flex items-center gap-1.5 font-bold bg-destructive/10 px-2 py-1 rounded-full border border-destructive/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                                        NO ENCONTRADO
                                                    </span>
                                                </div>
                                            ) : item.synced === 0 && (
                                                <div className="ml-auto">
                                                    <span className="text-[10px] text-warning flex items-center gap-1.5 font-bold bg-warning/10 px-2 py-1 rounded-full border border-warning/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                                                        SINCRONIZANDO
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer: Qty & Actions */}
                                        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/30">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-3xl font-black tracking-tighter text-foreground">
                                                    {item.quantity}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-80">
                                                    unid.
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-end gap-1">
                                                {item.deviceName && item.deviceName !== 'Generic Device' && (
                                                    <span 
                                                        className="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded border shadow-sm"
                                                        style={{ 
                                                            color: getDeviceColor(item.deviceId),
                                                            backgroundColor: `${getDeviceColor(item.deviceId)}10`,
                                                            borderColor: `${getDeviceColor(item.deviceId)}30`
                                                        }}
                                                    >
                                                        PC: {item.deviceName.replace('dev-', '')}
                                                    </span>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                                        onClick={() => handleStartEdit(item)}
                                                    >
                                                        <Pencil className="w-4.5 h-4.5" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                                        onClick={() => onDelete(item.id)}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4.5 h-4.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Dialog de edición */}
            <Dialog open={editingId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Cantidad</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                                Nueva cantidad
                            </label>
                            <Input
                                type="number"
                                min="1"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveEdit();
                                    }
                                }}
                                placeholder="Ingresa la cantidad"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={!editQuantity || parseInt(editQuantity) <= 0}>
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Removed AlertDialog for instant delete */}
        </>
    );
}

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Package, Copy, Check } from 'lucide-react';
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
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 15 });
    const containerRef = useRef<HTMLDivElement>(null);
    const ITEMS_PER_VIEW = 15; // Show 15 items at a time
    const BUFFER_SIZE = 5; // Buffer items before/after

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

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // removed handleConfirmDelete

    // True windowed virtualization
    useEffect(() => {
        const container = containerRef.current;
        if (!container || items.length === 0) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

            // Calculate which items should be visible based on scroll position
            const totalItems = items.length;
            const startIndex = Math.floor(scrollPercentage * Math.max(0, totalItems - ITEMS_PER_VIEW));
            const endIndex = Math.min(startIndex + ITEMS_PER_VIEW + BUFFER_SIZE, totalItems);

            setVisibleRange({ start: startIndex, end: endIndex });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [items.length]);

    // Reset when items change significantly
    useEffect(() => {
        setVisibleRange({ start: 0, end: Math.min(ITEMS_PER_VIEW, items.length) });
    }, [items.length]);

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

    const visibleItems = items.slice(visibleRange.start, visibleRange.end);

    // Calculate spacer heights for smooth scrolling
    const itemHeight = 200; // Approximate height of each card
    const topSpacerHeight = visibleRange.start * itemHeight;
    const bottomSpacerHeight = Math.max(0, (items.length - visibleRange.end) * itemHeight);

    return (
        <>
            <div
                ref={containerRef}
                className="max-h-[600px] overflow-y-auto"
                style={{
                    scrollBehavior: 'smooth',
                    overscrollBehavior: 'contain'
                }}
            >
                {/* Top spacer to maintain scroll position */}
                {topSpacerHeight > 0 && (
                    <div style={{ height: `${topSpacerHeight}px` }} />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <AnimatePresence mode="popLayout">
                        {visibleItems.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                layout
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
                                                className="flex items-center gap-2 text-muted-foreground hover:text-primary bg-muted/30 hover:bg-primary/5 px-2.5 py-1.5 rounded-lg border border-border/40 transition-all group/ean active:scale-95"
                                                title="Copiar EAN"
                                            >
                                                <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest border-r border-border/40 pr-2">EAN</span>
                                                <span className="text-xs sm:text-sm font-mono tracking-wider font-medium">
                                                    {item.ean}
                                                </span>
                                                {copiedId === item.id ? (
                                                    <Check className="w-3.5 h-3.5 text-success animate-bounce-in" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 opacity-0 group-hover/ean:opacity-100 transition-opacity" />
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
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Bottom spacer to maintain scroll height */}
                {bottomSpacerHeight > 0 && (
                    <div style={{ height: `${bottomSpacerHeight}px` }} />
                )}

                {/* Scroll indicator */}
                {items.length > ITEMS_PER_VIEW && (
                    <div className="sticky bottom-0 left-0 right-0 text-center py-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm border-t">
                        Mostrando {visibleRange.start + 1}-{Math.min(visibleRange.end, items.length)} de {items.length} productos
                    </div>
                )}
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

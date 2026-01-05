import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Package } from 'lucide-react';
import { UIPreCountItem } from '@/hooks/usePreCount';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
    const [deletingId, setDeletingId] = useState<string | null>(null);
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

    const handleConfirmDelete = () => {
        if (deletingId) {
            onDelete(deletingId);
            setDeletingId(null);
        }
    };

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
                                <Card className="h-full relative overflow-hidden group border-muted/60 shadow-sm hover:shadow-md transition-all">
                                    {/* Status Indicator Strip */}
                                    <div className={`absolute top-0 left-0 w-1 h-full ${item.synced === 0 ? 'bg-warning/50' : 'bg-primary/20 group-hover:bg-primary transition-colors'}`} />

                                    <div className="p-3 pl-4 flex flex-col h-full gap-2">
                                        {/* Header: Name & Menu */}
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="font-medium text-sm leading-tight line-clamp-2 text-foreground/90" title={item.productName}>
                                                {item.productName}
                                            </h4>
                                        </div>

                                        {/* Meta: EAN */}
                                        <div className="flex items-center gap-2 mt-auto">
                                            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/40 px-2 py-1 rounded-md border border-border/40">
                                                <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">EAN</span>
                                                <span className="text-xs sm:text-sm font-mono tracking-wide font-medium border-l border-border/30 pl-1.5 ml-0.5">
                                                    {item.ean}
                                                </span>
                                            </div>
                                            {item.synced === 0 && (
                                                <span className="text-[10px] text-warning flex items-center gap-1 font-medium bg-warning/5 px-1.5 rounded">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                                                    Sin sinc.
                                                </span>
                                            )}
                                        </div>

                                        {/* Footer: Qty & Actions */}
                                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/30">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-bold tracking-tight text-foreground">
                                                    {item.quantity}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                                    unid.
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5"
                                                    onClick={() => handleStartEdit(item)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                    onClick={() => setDeletingId(item.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* Dialog de confirmación de eliminación */}
            <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El producto será eliminado del pre-conteo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

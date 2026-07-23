"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { UIPreCountItem } from "@/hooks/usePreCount";
import { MasterCatalogItem } from "@/services/preCountDB";
import { CardFrame } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, type TableColumn } from "@/components/motion/table";
import { 
    Pencil01 as Pencil, 
    Trash01 as Trash2, 
    Clock, 
    SearchLg as Search 
} from '@untitledui/icons';
import { format } from "date-fns";
import { SwipeableList, type SwipeableListItem } from "@/components/motion/swipeable-list";

interface PreCountListProps {
    items: UIPreCountItem[];
    mode?: "full" | "restricted" | "readonly";
    onUpdate: (id: string, quantity: number) => void;
    onDelete: (id: string) => void;
    onEditRequest?: (item: UIPreCountItem) => void;
    masterCatalog?: MasterCatalogItem[];
}

export function PreCountList({ items, mode = "full", onUpdate, onDelete, onEditRequest, masterCatalog }: PreCountListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [tableHeight, setTableHeight] = useState(500);

    // Detectar layout móvil
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calcular altura disponible basándose en la posición del contenedor en el viewport
    // (evita dependencia circular: container crece → ResizeObserver → height grande → no scroll)
    const tableWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const calcHeight = () => {
            if (!tableWrapperRef.current) return;
            const rect = tableWrapperRef.current.getBoundingClientRect();
            // Espacio desde el top del wrapper de la tabla hasta el fondo del viewport
            // 48px de margen para padding inferior del layout
            const available = window.innerHeight - rect.top - 48;
            setTableHeight(Math.max(available, 200));
        };

        // Calcular después del primer layout
        const raf = requestAnimationFrame(calcHeight);
        window.addEventListener('resize', calcHeight);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', calcHeight);
        };
    }, [items.length]);

    const getLab = useCallback((id_producto?: string, ean?: string) => {
        if (!masterCatalog) return "Laboratorio";
        const matched = masterCatalog.find(item => 
            (id_producto && item.id_producto === id_producto) || 
            (ean && (item.ean === ean || item.eans?.includes(ean)))
        );
        return matched?.laboratory || "Laboratorio"; 
    }, [masterCatalog]);

    const getRubro = useCallback((id_producto?: string, ean?: string) => {
        if (!masterCatalog) return "Varios";
        const matched = masterCatalog.find(item => 
            (id_producto && item.id_producto === id_producto) || 
            (ean && (item.ean === ean || item.eans?.includes(ean)))
        );
        return matched?.rubro || "Varios"; 
    }, [masterCatalog]);

    const filteredItems = useMemo(() => {
        let baseItems = [...items].sort((a, b) => b.timestamp - a.timestamp);
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            baseItems = baseItems.filter(item => 
                item.productName.toLowerCase().includes(query) || 
                item.ean.includes(query) ||
                (item.location_tag && item.location_tag.toLowerCase().includes(query))
            );
        }
        
        return baseItems;
    }, [items, searchQuery]);

    const totalProducts = filteredItems.length;
    const totalUnits = useMemo(() => filteredItems.reduce((acc, item) => acc + (item.quantity || 0), 0), [filteredItems]);
    const errorCount = useMemo(() => filteredItems.filter(item => !item.productName || item.productName === 'Producto no encontrado' || item.productName === 'Desconocido' || item.productName.trim() === '').length, [filteredItems]);



    // Mapear columnas de la Data Table beui
    const columns = useMemo<TableColumn<UIPreCountItem>[]>(
        () => [
            {
                key: "ean",
                header: "Código EAN",
                sortable: true,
                width: "120px",
                align: "center",
                cell: (row) => (
                    <span className="font-semibold text-muted-foreground text-xs truncate">
                        {row.ean}
                    </span>
                ),
            },
            {
                key: "productName",
                header: "Producto",
                sortable: true,
                width: "2fr",
                cell: (row) => (
                    <span className="font-semibold text-foreground text-xs truncate">
                        {row.productName}
                    </span>
                ),
            },
            {
                key: "laboratory",
                header: "Laboratorio",
                sortable: true,
                width: "1.2fr",
                sortValue: (row) => getLab(row.id_producto, row.ean),
                cell: (row) => (
                    <span className="font-medium text-muted-foreground text-xs truncate">
                        {getLab(row.id_producto, row.ean)}
                    </span>
                ),
            },
            {
                key: "rubro",
                header: "Rubro",
                sortable: true,
                width: "1fr",
                sortValue: (row) => getRubro(row.id_producto, row.ean),
                cell: (row) => (
                    <span className="font-medium text-muted-foreground text-xs truncate">
                        {getRubro(row.id_producto, row.ean)}
                    </span>
                ),
            },
            {
                key: "location_tag",
                header: "Sector",
                sortable: true,
                width: "85px",
                align: "center",
                sortValue: (row) => row.location_tag || "S/S",
                cell: (row) => (
                    <Badge
                        variant="solid"
                        color="blue"
                        size="sm"
                        className="h-5 px-1.5 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 font-normal text-[11px]"
                    >
                        {row.location_tag || "S/S"}
                    </Badge>
                ),
            },
            {
                key: "quantity",
                header: "Cant.",
                sortable: true,
                width: "70px",
                align: "center",
                sortValue: (row) => row.quantity,
                cell: (row) => (
                    <span className="font-semibold text-foreground text-xs tabular-nums">
                        {row.quantity}
                    </span>
                ),
            },
            {
                key: "actions",
                header: "Acciones",
                width: "90px",
                align: "center",
                cell: (row) => (
                    <div className="flex items-center justify-center gap-1">
                        <Button
                            variant="tertiary"
                            size="sm"
                            className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 transition-all active:scale-[0.96]"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditRequest?.(row);
                            }}
                        >
                            <Pencil className="size-3 text-muted-foreground" />
                        </Button>
                        <Button
                            variant="tertiary"
                            size="sm"
                            className="relative h-7 w-7 p-0 rounded-md border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 transition-all active:scale-[0.96]"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(row.id);
                            }}
                        >
                            <Trash2 className="size-3 text-red-500" />
                        </Button>
                    </div>
                ),
            },
        ],
        [getLab, getRubro, onDelete, onEditRequest]
    );

    // Items para swipeable en mobile
    const swipeableItems = useMemo<SwipeableListItem[]>(() => {
        return filteredItems.map((item) => ({
            id: item.id,
            leftActions: [
                {
                    id: "edit",
                    label: "Editar",
                    icon: <Pencil className="size-4 text-primary" />,
                    tone: "primary" as const,
                    onClick: () => onEditRequest?.(item)
                }
            ],
            rightActions: [
                {
                    id: "delete",
                    label: "Borrar",
                    icon: <Trash2 className="size-4 text-destructive" />,
                    tone: "danger" as const,
                    onClick: () => onDelete(item.id)
                }
            ]
        }));
    }, [filteredItems, onEditRequest, onDelete]);

    const renderSwipeableItem = (swipeItem: SwipeableListItem) => {
        const originalItem = filteredItems.find(i => i.id === swipeItem.id);
        if (!originalItem) return null;

        const lab = getLab(originalItem.id_producto, originalItem.ean);
        const rubro = getRubro(originalItem.id_producto, originalItem.ean);
        const timeStr = format(originalItem.timestamp, 'HH:mm');

        return (
            <div 
                onClick={() => onEditRequest?.(originalItem)}
                className="flex items-center justify-between w-full h-full text-left cursor-pointer"
            >
                <div className="flex-1 min-w-0 pr-3 flex flex-col gap-0.5">
                    <div className="font-bold text-[13px] leading-tight text-foreground line-clamp-1">
                        {originalItem.productName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                        <span className="font-mono">{originalItem.ean}</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{lab}</span>
                        {rubro && rubro !== 'Varios' && (
                            <>
                                <span>•</span>
                                <span className="truncate max-w-[120px]">{rubro}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="solid" color="blue" size="sm" className="h-5 px-1.5 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 font-normal text-[10px]">
                            {originalItem.location_tag || "S/S"}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="size-3 opacity-60" />
                            {timeStr}
                        </div>
                    </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-xl px-3 py-1.5 text-sm min-w-[36px] text-center">
                    {originalItem.quantity}
                </div>
            </div>
        );
    };

    return (
        <div 
            ref={containerRef}
            className="flex flex-col flex-1 overflow-hidden h-full w-full min-w-0 min-h-0 gap-2"
        >
            {/* Toolbar Superior: Contador y Buscador */}
            <div className="flex items-center justify-between gap-3 shrink-0 px-4 pt-3 pb-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                    <Badge size="lg" variant="dot" showDot={false} color="blue">
                        {totalProducts} Productos
                    </Badge>
                    <Badge size="lg" variant="dot" showDot={false} color="emerald">
                        {totalUnits} Cantidad
                    </Badge>
                    <Badge size="lg" variant="dot" showDot={false} color="amber">
                        {errorCount} Desconocidos
                    </Badge>
                </div>

                <div className="w-full max-w-[280px]">
                    <div className="relative inline-flex w-full min-w-0 items-center rounded-xl border border-input bg-background/50 text-xs text-foreground shadow-xs/5 transition-shadow sm:text-xs" role="group">
                        <div className="flex h-auto cursor-text select-none items-center justify-center ps-3">
                            <Search className="size-3.5 text-muted-foreground/80" aria-hidden="true" />
                        </div>
                        <input 
                            aria-label="Buscar productos..." 
                            placeholder="Buscar por EAN, nombre o sector..." 
                            type="search" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-full min-w-0 px-2.5 outline-none placeholder:text-muted-foreground/70 bg-transparent border-none text-xs" 
                        />
                    </div>
                </div>
            </div>

            {/* Data Table beui (Desktop) */}
            <div ref={tableWrapperRef} className="hidden md:block flex-1 min-h-0 w-full overflow-hidden">
                <Table
                    data={filteredItems}
                    columns={columns}
                    getRowId={(row) => row.id}
                    resizable
                    reorderable
                    defaultSort={{ key: "productName", direction: "asc" }}
                    height={tableHeight}
                    rowHeight={40}
                    overscan={5}
                    emptyState={
                        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-xs">
                            No hay productos registrados.
                        </div>
                    }
                    className="rounded-2xl border-none w-full"
                />
            </div>

            {/* Mobile Swipeable List View */}
            <div className="block md:hidden flex-1 overflow-auto scrollbar-none py-1 min-w-0">
                {swipeableItems.length > 0 ? (
                    <SwipeableList
                        items={swipeableItems}
                        renderItem={renderSwipeableItem}
                        classNames={{
                            root: "gap-2.5",
                            surface: "bg-card border-border/40 shadow-xs px-4 py-3 rounded-2xl flex items-center min-h-[80px]",
                            item: "rounded-2xl bg-muted/20 border border-border/20",
                            rail: "rounded-2xl"
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground/60">
                        <span className="text-xs">No hay productos registrados en este sector.</span>
                    </div>
                )}
            </div>
        </div>
    );
}

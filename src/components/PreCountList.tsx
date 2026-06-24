"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { UIPreCountItem } from "@/hooks/usePreCount";
import { MasterCatalogItem } from "@/services/preCountDB";
import { CardFrame, CardFrameFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { 
    ChevronsUpDown, 
    MapPin, 
    Pencil, 
    Trash2,
    Clock,
    Search
} from "lucide-react";
import { format } from "date-fns";

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
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(15);
    const containerRef = useRef<HTMLDivElement>(null);

    // Ajustar pageSize dinámicamente según la altura REAL del contenedor
    useEffect(() => {
        if (!containerRef.current) return;

        const calculatePageSize = () => {
            if (!containerRef.current) return;
            const containerHeight = containerRef.current.offsetHeight;
            const headerHeight = 48; // Altura TableHeader
            const footerHeight = 64; // Altura CardFrameFooter
            const rowHeight = 46;    // Altura ajustada
            
            const availableHeight = containerHeight - headerHeight - footerHeight;
            let size = Math.floor(availableHeight / rowHeight);
            
            if (size < 5) size = 5;
            setPageSize(size);
        };

        calculatePageSize();
        const resizeObserver = new ResizeObserver(calculatePageSize);
        resizeObserver.observe(containerRef.current);
        
        return () => resizeObserver.disconnect();
    }, []);

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

    // Resetear página al buscar
    useEffect(() => {
        setPageIndex(0);
    }, [searchQuery]);

    const pageItems = useMemo(() => {
        return filteredItems.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    }, [filteredItems, pageIndex, pageSize]);

    const pageCount = Math.ceil(filteredItems.length / pageSize);

    const getLab = (id_producto?: string, ean?: string) => {
        if (!masterCatalog) return "Laboratorio";
        const matched = masterCatalog.find(item => 
            (id_producto && item.id_producto === id_producto) || 
            (ean && (item.ean === ean || item.eans?.includes(ean)))
        );
        return matched?.laboratory || "Laboratorio"; 
    };

    return (
        <CardFrame 
            ref={containerRef}
            className="flex flex-col flex-1 overflow-hidden bg-card border-border/40 shadow-sm rounded-2xl h-full w-full min-w-0"
        >
            <div className="flex-1 overflow-auto scrollbar-none rounded-t-2xl min-w-0">
                <Table variant="card" className="scrollbar-none w-full border-collapse">
                    <TableHeader className="sticky top-0 bg-secondary/10 dark:bg-secondary/5 backdrop-blur-sm z-10 rounded-t-2xl overflow-hidden">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="w-[15%] min-w-[140px] py-4 h-12 align-middle text-center pl-5">Código EAN</TableHead>
                            <TableHead className="w-[32%] min-w-[200px] py-4 h-12 align-middle">Producto</TableHead>
                            <TableHead className="w-[15%] min-w-[130px] py-4 h-12 align-middle">Laboratorio</TableHead>
                            <TableHead className="w-[10%] min-w-[100px] py-4 h-12 align-middle text-center">Sector</TableHead>
                            <TableHead className="w-[10%] min-w-[80px] py-4 h-12 align-middle text-center">Hora</TableHead>
                            <TableHead className="w-[8%] min-w-[70px] py-4 h-12 align-middle text-center">Cant.</TableHead>
                            <TableHead className="w-[10%] min-w-[100px] py-4 h-12 align-middle text-center pr-5">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageItems.map((item) => (
                            <TableRow key={item.id} className="group border-b border-border/40 last:border-0 h-[46px]">
                                <TableCell className="py-2 pl-5 pr-3 text-center">
                                    <div className="font-medium font-mono text-muted-foreground text-[12px] truncate">{item.ean}</div>
                                </TableCell>
                                <TableCell className="py-2 px-3">
                                    <div className="font-bold text-[13px] leading-tight line-clamp-1">{item.productName}</div>
                                </TableCell>
                                <TableCell className="py-2 px-3">
                                    <div className="font-medium text-muted-foreground text-[12px] truncate">{getLab(item.id_producto, item.ean)}</div>
                                </TableCell>
                                <TableCell className="py-2 px-3 text-center">
                                    <Badge variant="outline" size="sm" className="h-6 px-2 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 font-normal">
                                        <MapPin className="size-3 mr-1" />
                                        {item.location_tag || "S/S"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-2 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground font-medium text-[11px]">
                                        <Clock className="size-3 opacity-60" />
                                        {format(item.timestamp, 'HH:mm')}
                                    </div>
                                </TableCell>
                                <TableCell className="py-2 px-3 text-center">
                                    <div className="font-bold tabular-nums text-[14px]">{item.quantity}</div>
                                </TableCell>
                                <TableCell className="py-2 pl-3 pr-5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 rounded-md shrink-0 border-border/40"
                                            onClick={() => onEditRequest?.(item)}
                                        >
                                            <Pencil className="size-3.5 text-muted-foreground" />
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 rounded-md border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                                            onClick={() => onDelete(item.id)}
                                        >
                                            <Trash2 className="size-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {/* Fill empty space if pageItems is less than pageSize to keep footer anchored */}
                        {pageItems.length < pageSize && pageItems.length > 0 && (
                             <TableRow style={{ height: (pageSize - pageItems.length) * 46 }} className="border-none hover:bg-transparent">
                                 <TableCell colSpan={7} className="p-0 border-none" />
                             </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <CardFrameFooter className="shrink-0 border-t bg-secondary/10 dark:bg-secondary/5 px-5 py-3 rounded-b-2xl">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                            <p className="text-muted-foreground text-[13px]">Viendo</p>
                            <Button variant="outline" size="sm" className="h-8 w-fit gap-1.5 px-3 font-medium bg-background text-[13px]">
                                {filteredItems.length > 0 ? pageIndex * pageSize + 1 : 0}-{Math.min((pageIndex + 1) * pageSize, filteredItems.length)}
                                <ChevronsUpDown className="size-4 opacity-50" />
                            </Button>
                            <p className="text-muted-foreground text-[13px]">
                                de <strong className="font-medium text-foreground">{filteredItems.length}</strong> resultados
                            </p>
                        </div>

                        <div className="max-w-[280px] w-full">
                            <div className="relative inline-flex w-full min-w-0 items-center rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] sm:text-sm dark:bg-input/32" data-slot="input-group" role="group">
                                <div className="flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none order-first ps-[calc(theme(spacing.3)-1px)]" data-align="inline-start" data-slot="input-group-addon">
                                    <Search className="size-4 text-muted-foreground/80" aria-hidden="true" />
                                </div>
                                <span className="contents" data-size="default" data-slot="input-control">
                                    <input 
                                        data-slot="input" 
                                        aria-label="Buscar" 
                                        placeholder="Buscar..." 
                                        type="search" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-8 w-full min-w-0 rounded-[inherit] px-[calc(theme(spacing.3)-1px)] leading-8 outline-none placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5 bg-transparent border-none focus:ring-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none" 
                                    />
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={pageIndex === 0} 
                            onClick={() => setPageIndex(p => p - 1)}
                            className="h-8 px-4"
                        >
                            Anterior
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={pageIndex >= pageCount - 1} 
                            onClick={() => setPageIndex(p => p + 1)}
                            className="h-8 px-4"
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            </CardFrameFooter>
        </CardFrame>
    );
}

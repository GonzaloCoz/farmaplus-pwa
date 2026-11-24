
"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from "react";
import { UIPreCountItem } from "@/hooks/usePreCount";
import { MasterCatalogItem } from "@/services/preCountDB";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COLOR_PALETTE: BadgeColor[] = ["blue", "emerald", "amber", "violet", "cyan", "indigo", "teal", "fuchsia", "rose", "orange"];

function getBatchColor(batchStr: string): BadgeColor {
    if (!batchStr || batchStr === "S/L") return "gray";
    let hash = 0;
    for (let i = 0; i < batchStr.length; i++) {
        hash = batchStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTE.length;
    return COLOR_PALETTE[index];
}
import { Button } from "@/components/ui/button";
import { Table, type TableColumn } from "@/components/motion/table";
import { 
    Pencil01 as Pencil, 
    Trash01 as Trash2, 
    Clock, 
    SearchLg as Search,
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    RefreshCw01 as RefreshCw,
    LayoutGrid01 as PackageX,
    Building01
} from '@untitledui/icons';

const DEFAULT_BRANCHES = [
    "Belgrano",
    "Palermo",
    "Recoleta",
    "Centro",
    "Caballito",
    "Flores",
    "San Isidro",
    "Olivos",
    "Quilmes",
    "Lanús",
    "Morón",
    "Pilar"
];
import { format } from "date-fns";
import { SwipeableList, type SwipeableListItem } from "@/components/motion/swipeable-list";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export type SmartAnalystItem = UIPreCountItem & {
    controlDate?: number;
    batchNumber?: string;
    vencimiento?: string;
    expiryDate?: string;
    lotesData?: { lote: string; vencimiento: string; cantidad: number; status?: "critical" | "warning" | "normal" }[];
    lotes?: string[];
    expiryStatus?: { critical: number; warning: number; normal: number };
};

interface PreCountListProps {
    items?: SmartAnalystItem[];
    mode?: "full" | "restricted" | "readonly";
    onUpdate?: (id: string, quantity: number) => void;
    onDelete?: (id: string) => void;
    onEditRequest?: (item: SmartAnalystItem) => void;
    masterCatalog?: MasterCatalogItem[];
}

const MOCK_ITEMS: SmartAnalystItem[] = [
    {
        id: "mock-1",
        sessionId: "session-mock",
        controlDate: Date.now() - 3600000 * 2,
        ean: "7791234567890",
        productName: "Paracetamol 500mg Roemmers x 20 comp",
        quantity: 12,
        lotesData: [
            { lote: "LOT-2026A", vencimiento: "08/26", cantidad: 7, status: "critical" },
            { lote: "LOT-2026B", vencimiento: "12/26", cantidad: 5, status: "warning" }
        ],
        lotes: ["LOT-2026A", "LOT-2026B"],
        timestamp: Date.now() - 1000,
        id_producto: "ROEM-PAR-500"
    },
    {
        id: "mock-2",
        sessionId: "session-mock",
        controlDate: Date.now() - 3600000 * 5,
        ean: "7799876543210",
        productName: "Ibuprofeno 600mg Bayer x 10 comp",
        quantity: 5,
        lotesData: [
            { lote: "L-88941", vencimiento: "07/26", cantidad: 5, status: "critical" }
        ],
        lotes: ["L-88941"],
        timestamp: Date.now() - 5000,
        id_producto: "BAY-IBU-600"
    },
    {
        id: "mock-3",
        sessionId: "session-mock",
        controlDate: Date.now() - 3600000 * 12,
        ean: "7793456789012",
        productName: "Actron 600 Rápidas Caps Soft x 10",
        quantity: 24,
        lotesData: [
            { lote: "LOT-9920", vencimiento: "11/26", cantidad: 24, status: "warning" }
        ],
        lotes: ["LOT-9920"],
        timestamp: Date.now() - 12000,
        id_producto: "BAY-ACT-600"
    },
    {
        id: "mock-4",
        sessionId: "session-mock",
        controlDate: Date.now() - 3600000 * 24,
        ean: "7794567890123",
        productName: "Amoxidal Duo 1000mg x 14 comp",
        quantity: 8,
        lotesData: [
            { lote: "L-77123", vencimiento: "05/27", cantidad: 8, status: "normal" }
        ],
        lotes: ["L-77123"],
        timestamp: Date.now() - 20000,
        id_producto: "ROEM-AMO-1000"
    },
    {
        id: "mock-5",
        sessionId: "session-mock",
        controlDate: Date.now() - 3600000 * 48,
        ean: "7795678901234",
        productName: "Dermaglos Emulsión Hidratante 400ml",
        quantity: 15,
        lotesData: [
            { lote: "S/L", vencimiento: "10/27", cantidad: 15, status: "normal" }
        ],
        lotes: ["S/L"],
        timestamp: Date.now() - 35000,
        id_producto: "AND-DERM-400"
    }
];

export default function SmartAnalystPage({ 
    items = MOCK_ITEMS, 
    mode = "full", 
    onUpdate, 
    onDelete, 
    onEditRequest, 
    masterCatalog 
}: PreCountListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [tableHeight, setTableHeight] = useState(500);
    const [hoveredBatch, setHoveredBatch] = useState<{ rowId: string; loteName?: string; status?: string } | null>(null);
    const [itemList, setItemList] = useState<SmartAnalystItem[]>(items);

    useEffect(() => {
        setItemList(items);
    }, [items]);

    const [dispenseItem, setDispenseItem] = useState<SmartAnalystItem | null>(null);
    const [selectedLote, setSelectedLote] = useState<string>("");
    const [dispenseQtyInput, setDispenseQtyInput] = useState<string>("1");

    const lotesOptions = useMemo(() => {
        if (!dispenseItem) return [];
        if (dispenseItem.lotesData && dispenseItem.lotesData.length > 0) {
            return dispenseItem.lotesData;
        }
        const lotesList = dispenseItem.lotes || (dispenseItem.batchNumber ? [dispenseItem.batchNumber] : []);
        const vto = dispenseItem.vencimiento || dispenseItem.expiryDate || "S/V";
        return lotesList.map(lote => ({
            lote,
            vencimiento: vto,
            cantidad: dispenseItem.quantity || 1
        }));
    }, [dispenseItem]);

    const selectedLotItem = useMemo(() => {
        return lotesOptions.find((it: any) => it.lote === selectedLote) || lotesOptions[0];
    }, [lotesOptions, selectedLote]);

    const maxLotQty = selectedLotItem?.cantidad || 1;

    const handleOpenDispense = useCallback((row: any) => {
        setDispenseItem(row);
        const options = row.lotesData && row.lotesData.length > 0 
            ? row.lotesData 
            : (row.lotes || [row.batchNumber || "S/L"]).map((l: string) => ({
                lote: l,
                vencimiento: row.vencimiento || "S/V",
                cantidad: row.quantity || 1
            }));
        if (options.length > 0) {
            setSelectedLote(options[0].lote);
            setDispenseQtyInput(String(options[0].cantidad || 1));
        } else {
            setSelectedLote("S/L");
            setDispenseQtyInput(String(row.quantity || 1));
        }
    }, []);

    const handleLoteChange = useCallback((val: string) => {
        setSelectedLote(val);
        const matched = lotesOptions.find((it: any) => it.lote === val);
        if (matched) {
            setDispenseQtyInput(String(matched.cantidad || 1));
        }
    }, [lotesOptions]);

    const handleDispenseQtyInputChange = useCallback((val: string) => {
        if (val === "") {
            setDispenseQtyInput("");
            return;
        }
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed <= 0) return;
        if (parsed > maxLotQty) {
            setDispenseQtyInput(String(maxLotQty));
        } else {
            setDispenseQtyInput(String(parsed));
        }
    }, [maxLotQty]);

    const handleDispenseQtyBlur = useCallback(() => {
        const parsed = parseInt(dispenseQtyInput, 10);
        if (isNaN(parsed) || parsed < 1) {
            setDispenseQtyInput("1");
        } else if (parsed > maxLotQty) {
            setDispenseQtyInput(String(maxLotQty));
        }
    }, [dispenseQtyInput, maxLotQty]);

    const handleConfirmDispense = useCallback(() => {
        if (!dispenseItem) return;

        const itemId = dispenseItem.id;
        const targetLote = selectedLote;
        const qtyToDispense = Math.min(maxLotQty, Math.max(1, parseInt(dispenseQtyInput, 10) || 1));

        setItemList((prevList) => {
            return prevList
                .map((item) => {
                    if (item.id !== itemId) return item;

                    let updatedLotesData = item.lotesData ? [...item.lotesData] : [];
                    
                    if (updatedLotesData.length > 0) {
                        const targetIdx = updatedLotesData.findIndex((it: any) => it.lote === targetLote);
                        if (targetIdx !== -1) {
                            const currentLot = updatedLotesData[targetIdx];
                            const newLotQty = Math.max(0, currentLot.cantidad - qtyToDispense);
                            if (newLotQty <= 0) {
                                updatedLotesData.splice(targetIdx, 1);
                            } else {
                                updatedLotesData[targetIdx] = { ...currentLot, cantidad: newLotQty };
                            }
                        } else {
                            const newQty = Math.max(0, (item.quantity || 0) - qtyToDispense);
                            if (newQty <= 0) return null;
                            return { ...item, quantity: newQty };
                        }

                        if (updatedLotesData.length === 0) {
                            return null;
                        }

                        const newTotalQty = updatedLotesData.reduce((acc: number, it: any) => acc + (it.cantidad || 0), 0);
                        if (newTotalQty <= 0) return null;

                        let critical = 0;
                        let warning = 0;
                        let normal = 0;
                        updatedLotesData.forEach((it: any) => {
                            if (it.status === "critical") critical += 1;
                            else if (it.status === "warning") warning += 1;
                            else normal += 1;
                        });

                        const updatedLotes = updatedLotesData.map((it: any) => it.lote);

                        return {
                            ...item,
                            quantity: newTotalQty,
                            lotesData: updatedLotesData,
                            lotes: updatedLotes,
                            expiryStatus: { critical, warning, normal }
                        };
                    } else {
                        const newQty = Math.max(0, (item.quantity || 0) - qtyToDispense);
                        if (newQty <= 0) return null;
                        return { ...item, quantity: newQty };
                    }
                })
                .filter((item): item is SmartAnalystItem => item !== null);
        });

        onDelete?.(dispenseItem.id);
        onUpdate?.(dispenseItem.id, Math.max(0, (dispenseItem.quantity || 0) - qtyToDispense));
        setDispenseItem(null);
    }, [dispenseItem, selectedLote, dispenseQtyInput, maxLotQty, onDelete, onUpdate]);

    // State para Inter-Sucursal Dialog
    const [transferItem, setTransferItem] = useState<SmartAnalystItem | null>(null);
    const [transferSelectedLote, setTransferSelectedLote] = useState<string>("");
    const [transferQtyInput, setTransferQtyInput] = useState<string>("1");
    const [targetBranch, setTargetBranch] = useState<string>("");
    const [plexShipmentNumber, setPlexShipmentNumber] = useState<string>("");
    const [plexError, setPlexError] = useState<string | null>(null);
    const [branchError, setBranchError] = useState<string | null>(null);

    const transferLotesOptions = useMemo(() => {
        if (!transferItem) return [];
        if (transferItem.lotesData && transferItem.lotesData.length > 0) {
            return transferItem.lotesData;
        }
        const lotesList = transferItem.lotes || (transferItem.batchNumber ? [transferItem.batchNumber] : []);
        const vto = transferItem.vencimiento || transferItem.expiryDate || "S/V";
        return lotesList.map(lote => ({
            lote,
            vencimiento: vto,
            cantidad: transferItem.quantity || 1
        }));
    }, [transferItem]);

    const transferSelectedLotItem = useMemo(() => {
        return transferLotesOptions.find((it: any) => it.lote === transferSelectedLote) || transferLotesOptions[0];
    }, [transferLotesOptions, transferSelectedLote]);

    const transferMaxLotQty = transferSelectedLotItem?.cantidad || 1;

    const handleOpenTransfer = useCallback((row: SmartAnalystItem) => {
        setTransferItem(row);
        setTargetBranch("");
        setPlexShipmentNumber("");
        setPlexError(null);
        setBranchError(null);

        const options = row.lotesData && row.lotesData.length > 0 
            ? row.lotesData 
            : (row.lotes || [row.batchNumber || "S/L"]).map((l: string) => ({
                lote: l,
                vencimiento: row.vencimiento || "S/V",
                cantidad: row.quantity || 1
            }));
        if (options.length > 0) {
            setTransferSelectedLote(options[0].lote);
            setTransferQtyInput(String(options[0].cantidad || 1));
        } else {
            setTransferSelectedLote("S/L");
            setTransferQtyInput(String(row.quantity || 1));
        }
    }, []);

    const handleTransferLoteChange = useCallback((val: string) => {
        setTransferSelectedLote(val);
        const matched = transferLotesOptions.find((it: any) => it.lote === val);
        if (matched) {
            setTransferQtyInput(String(matched.cantidad || 1));
        }
    }, [transferLotesOptions]);

    const handleTransferQtyInputChange = useCallback((val: string) => {
        if (val === "") {
            setTransferQtyInput("");
            return;
        }
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed <= 0) return;
        if (parsed > transferMaxLotQty) {
            setTransferQtyInput(String(transferMaxLotQty));
        } else {
            setTransferQtyInput(String(parsed));
        }
    }, [transferMaxLotQty]);

    const handleTransferQtyBlur = useCallback(() => {
        const parsed = parseInt(transferQtyInput, 10);
        if (isNaN(parsed) || parsed < 1) {
            setTransferQtyInput("1");
        } else if (parsed > transferMaxLotQty) {
            setTransferQtyInput(String(transferMaxLotQty));
        }
    }, [transferQtyInput, transferMaxLotQty]);

    const handleConfirmTransfer = useCallback(() => {
        if (!transferItem) return;

        let hasError = false;
        if (!targetBranch) {
            setBranchError("Debes seleccionar la sucursal de destino.");
            hasError = true;
        } else {
            setBranchError(null);
        }

        if (!plexShipmentNumber.trim()) {
            setPlexError("El número de envío Plex es obligatorio.");
            hasError = true;
        } else {
            setPlexError(null);
        }

        if (hasError) return;

        const itemId = transferItem.id;
        const targetLote = transferSelectedLote;
        const qtyToTransfer = Math.min(transferMaxLotQty, Math.max(1, parseInt(transferQtyInput, 10) || 1));

        setItemList((prevList) => {
            return prevList
                .map((item) => {
                    if (item.id !== itemId) return item;

                    let updatedLotesData = item.lotesData ? [...item.lotesData] : [];
                    
                    if (updatedLotesData.length > 0) {
                        const targetIdx = updatedLotesData.findIndex((it: any) => it.lote === targetLote);
                        if (targetIdx !== -1) {
                            const currentLot = updatedLotesData[targetIdx];
                            const newLotQty = Math.max(0, currentLot.cantidad - qtyToTransfer);
                            if (newLotQty <= 0) {
                                updatedLotesData.splice(targetIdx, 1);
                            } else {
                                updatedLotesData[targetIdx] = { ...currentLot, cantidad: newLotQty };
                            }
                        } else {
                            const newQty = Math.max(0, (item.quantity || 0) - qtyToTransfer);
                            if (newQty <= 0) return null;
                            return { ...item, quantity: newQty };
                        }

                        if (updatedLotesData.length === 0) {
                            return null;
                        }

                        const newTotalQty = updatedLotesData.reduce((acc: number, it: any) => acc + (it.cantidad || 0), 0);
                        if (newTotalQty <= 0) return null;

                        let critical = 0;
                        let warning = 0;
                        let normal = 0;
                        updatedLotesData.forEach((it: any) => {
                            if (it.status === "critical") critical += 1;
                            else if (it.status === "warning") warning += 1;
                            else normal += 1;
                        });

                        const updatedLotes = updatedLotesData.map((it: any) => it.lote);

                        return {
                            ...item,
                            quantity: newTotalQty,
                            lotesData: updatedLotesData,
                            lotes: updatedLotes,
                            expiryStatus: { critical, warning, normal }
                        };
                    } else {
                        const newQty = Math.max(0, (item.quantity || 0) - qtyToTransfer);
                        if (newQty <= 0) return null;
                        return { ...item, quantity: newQty };
                    }
                })
                .filter((item): item is SmartAnalystItem => item !== null);
        });

        onUpdate?.(transferItem.id, Math.max(0, (transferItem.quantity || 0) - qtyToTransfer));
        setTransferItem(null);
    }, [transferItem, targetBranch, plexShipmentNumber, transferSelectedLote, transferQtyInput, transferMaxLotQty, onUpdate]);

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
    const tableWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const calcHeight = () => {
            if (!tableWrapperRef.current) return;
            const rect = tableWrapperRef.current.getBoundingClientRect();
            const available = window.innerHeight - rect.top - 48;
            setTableHeight(Math.max(available, 200));
        };

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
        let baseItems = [...itemList].sort((a, b) => b.timestamp - a.timestamp);
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            baseItems = baseItems.filter(item => 
                item.productName.toLowerCase().includes(query) || 
                item.ean.includes(query) ||
                (item.location_tag && item.location_tag.toLowerCase().includes(query))
            );
        }
        
        return baseItems;
    }, [itemList, searchQuery]);

    const totalProducts = filteredItems.length;
    const totalUnits = useMemo(() => filteredItems.reduce((acc, item) => acc + (item.quantity || 0), 0), [filteredItems]);
    const errorCount = useMemo(() => filteredItems.filter(item => !item.productName || item.productName === 'Producto no encontrado' || item.productName === 'Desconocido' || item.productName.trim() === '').length, [filteredItems]);

    // Mapear columnas de la Data Table beui
    const columns = useMemo<TableColumn<SmartAnalystItem>[]>(
        () => [
            {
                key: "controlDate",
                header: "Fecha",
                sortable: true,
                width: "95px",
                align: "center",
                sortValue: (row: any) => row.controlDate || row.timestamp,
                cell: (row: any) => {
                    const dateVal = row.controlDate || row.timestamp;
                    const dateStr = dateVal ? format(new Date(dateVal), "dd/MM/yyyy") : "--/--/----";
                    return (
                        <Tooltip content={`Fecha del control: ${dateStr}`} side="top">
                            <span className="font-medium text-muted-foreground text-xs tabular-nums cursor-help">
                                {dateStr}
                            </span>
                        </Tooltip>
                    );
                },
            },
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
                key: "lotes",
                header: "Lotes",
                sortable: true,
                width: "1.2fr",
                align: "center",
                sortValue: (row: any) => (row.lotes ? row.lotes.join(", ") : row.batchNumber || "S/L"),
                cell: (row: any) => {
                    const lotesList: string[] = row.lotes || (row.batchNumber ? [row.batchNumber] : []);
                    if (!lotesList || lotesList.length === 0) {
                        return (
                            <Tooltip content="Sin número de lote asignado" side="top">
                                <Badge
                                    variant="dot"
                                    showDot={false}
                                    color="gray"
                                    size="sm"
                                    className="h-5 px-2 font-sans font-medium text-xs opacity-60"
                                >
                                    S/L
                                </Badge>
                            </Tooltip>
                        );
                    }
                    const lotesData = row.lotesData;
                    return (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 w-full my-0.5">
                            {lotesList.map((lote, idx) => {
                                const loteItem = lotesData?.find((d: any) => d.lote === lote);
                                const loteStatus = loteItem?.status || "normal";
                                const isHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.loteName === lote || (hoveredBatch?.status && hoveredBatch?.status === loteStatus));
                                const isOtherHovered = hoveredBatch?.rowId === row.id && !isHovered;
                                return (
                                    <Tooltip key={idx} content={`Número de Lote: ${lote}`} side="top">
                                        <span 
                                            className={cn(
                                                "inline-flex cursor-help transition-all duration-200",
                                                isOtherHovered && "opacity-25 scale-90 blur-[0.3px]",
                                                isHovered && "opacity-100 scale-105"
                                            )}
                                            onMouseEnter={() => setHoveredBatch({ rowId: row.id, loteName: lote, status: loteStatus })}
                                            onMouseLeave={() => setHoveredBatch(null)}
                                        >
                                            <Badge
                                                variant="dot"
                                                showDot={false}
                                                color={getBatchColor(lote)}
                                                size="sm"
                                                className="h-5 px-2 font-sans font-semibold text-xs whitespace-nowrap transition-all"
                                            >
                                                {lote}
                                            </Badge>
                                        </span>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    );
                },
            },
            {
                key: "vencimiento",
                header: "Vto.",
                sortable: true,
                width: "1fr",
                align: "center",
                sortValue: (row: any) => {
                    if (row.lotesData?.[0]?.vencimiento) return row.lotesData[0].vencimiento;
                    return row.vencimiento || row.expiryDate || "S/V";
                },
                cell: (row: any) => {
                    const lotesData = row.lotesData;
                    if (lotesData && lotesData.length > 0) {
                        return (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 w-full my-0.5">
                                {lotesData.map((item: any, idx: number) => {
                                    const isHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.loteName === item.lote || (hoveredBatch?.status && hoveredBatch?.status === item.status));
                                    const isOtherHovered = hoveredBatch?.rowId === row.id && !isHovered;
                                    return (
                                        <Tooltip key={idx} content={`Corresponde al Lote ${item.lote} — Vencimiento: ${item.vencimiento}`} side="top">
                                            <span 
                                                className={cn(
                                                    "inline-flex cursor-help transition-all duration-200",
                                                    isOtherHovered && "opacity-25 scale-90 blur-[0.3px]",
                                                    isHovered && "opacity-100 scale-105"
                                                )}
                                                onMouseEnter={() => setHoveredBatch({ rowId: row.id, loteName: item.lote, status: item.status })}
                                                onMouseLeave={() => setHoveredBatch(null)}
                                            >
                                                <Badge
                                                    variant="dot"
                                                    showDot={false}
                                                    color={getBatchColor(item.lote)}
                                                    size="sm"
                                                    className="h-5 px-2 font-sans font-semibold text-xs whitespace-nowrap transition-all"
                                                >
                                                    {item.vencimiento}
                                                </Badge>
                                            </span>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        );
                    }
                    const lotesList: string[] = row.lotes || (row.batchNumber ? [row.batchNumber] : []);
                    const loteName = lotesList[0] || "S/L";
                    const vto = row.vencimiento || row.expiryDate || "S/V";
                    return (
                        <Tooltip content={`Corresponde al Lote ${loteName} — Vencimiento: ${vto}`} side="top">
                            <span className="inline-flex cursor-help">
                                <Badge
                                    variant="dot"
                                    showDot={false}
                                    color={getBatchColor(loteName)}
                                    size="sm"
                                    className="h-5 px-2 font-sans font-semibold text-xs whitespace-nowrap"
                                >
                                    {vto}
                                </Badge>
                            </span>
                        </Tooltip>
                    );
                },
            },
            {
                key: "quantity",
                header: "Cant.",
                sortable: true,
                width: "1fr",
                align: "center",
                sortValue: (row) => row.quantity,
                cell: (row: any) => {
                    const lotesData = row.lotesData;
                    if (lotesData && lotesData.length > 0) {
                        return (
                            <div className="flex items-center justify-center gap-1 font-sans text-xs tabular-nums text-foreground my-0.5">
                                {lotesData.map((item: any, idx: number) => {
                                    const isHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.loteName === item.lote || (hoveredBatch?.status && hoveredBatch?.status === item.status));
                                    const isOtherHovered = hoveredBatch?.rowId === row.id && !isHovered;
                                    return (
                                        <Fragment key={idx}>
                                            {idx > 0 && <span className="text-muted-foreground/40 font-normal select-none">/</span>}
                                            <Tooltip content={`Cantidad Lote ${item.lote}: ${item.cantidad} un. (Total: ${row.quantity})`} side="top">
                                                <span 
                                                    className={cn(
                                                        "cursor-help font-semibold transition-all duration-200 px-1 py-0.5 rounded-xs",
                                                        isOtherHovered && "opacity-25 scale-90 blur-[0.3px]",
                                                        isHovered && "opacity-100 font-bold scale-110"
                                                    )}
                                                    onMouseEnter={() => setHoveredBatch({ rowId: row.id, loteName: item.lote, status: item.status })}
                                                    onMouseLeave={() => setHoveredBatch(null)}
                                                >
                                                    {item.cantidad}
                                                </span>
                                            </Tooltip>
                                        </Fragment>
                                    );
                                })}
                            </div>
                        );
                    }
                    return (
                        <Tooltip content={`Total contado: ${row.quantity} unidades`} side="top">
                            <span className="font-semibold text-foreground text-xs cursor-help">
                                {row.quantity}
                            </span>
                        </Tooltip>
                    );
                },
            },
            {
                key: "alerta",
                header: "Alerta",
                sortable: true,
                width: "130px",
                align: "center",
                sortValue: (row: any) => {
                    let critical = 0;
                    let warning = 0;
                    if (row.lotesData && row.lotesData.length > 0) {
                        row.lotesData.forEach((item: any) => {
                            if (item.status === "critical") critical++;
                            else if (item.status === "warning") warning++;
                        });
                    } else if (row.expiryStatus) {
                        critical = row.expiryStatus.critical || 0;
                        warning = row.expiryStatus.warning || 0;
                    }
                    return critical * 100 + warning * 10;
                },
                cell: (row: any) => {
                    let critical = 0;
                    let warning = 0;
                    let normal = 0;

                    const lotesList: string[] = row.lotes || (row.batchNumber ? [row.batchNumber] : []);
                    const totalLotes = Math.max(lotesList.length, 1);

                    if (row.lotesData && row.lotesData.length > 0) {
                        row.lotesData.forEach((item: any) => {
                            if (item.status === "critical") critical++;
                            else if (item.status === "warning") warning++;
                            else normal++;
                        });
                    } else if (row.expiryStatus) {
                        critical = row.expiryStatus.critical || 0;
                        warning = row.expiryStatus.warning || 0;
                        normal = row.expiryStatus.normal || Math.max(0, totalLotes - critical - warning);
                    } else {
                        normal = totalLotes;
                    }

                    const hasCritical = critical > 0;
                    const hasWarning = warning > 0;

                    const isCritHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.status === "critical" || (hoveredBatch?.loteName && row.lotesData?.some((it: any) => it.lote === hoveredBatch.loteName && it.status === "critical")));
                    const isCritOther = hoveredBatch?.rowId === row.id && !isCritHovered;

                    const isWarnHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.status === "warning" || (hoveredBatch?.loteName && row.lotesData?.some((it: any) => it.lote === hoveredBatch.loteName && it.status === "warning")));
                    const isWarnOther = hoveredBatch?.rowId === row.id && !isWarnHovered;

                    const isNormHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.status === "normal" || (hoveredBatch?.loteName && row.lotesData?.some((it: any) => it.lote === hoveredBatch.loteName && (it.status === "normal" || !it.status))));
                    const isNormOther = hoveredBatch?.rowId === row.id && !isNormHovered;

                    if (!hasCritical && !hasWarning) {
                        const optimalCount = normal || totalLotes;
                        return (
                            <Tooltip content={`Lotes óptimos (mayor a 6 meses para vencer): ${optimalCount}`} side="top">
                                <span 
                                    className={cn(
                                        "inline-flex items-center gap-1 cursor-help transition-all duration-200",
                                        isNormOther && "opacity-25 scale-90 blur-[0.3px]",
                                        isNormHovered && "opacity-100 scale-110 font-bold"
                                    )}
                                    onMouseEnter={() => setHoveredBatch({ rowId: row.id, status: "normal" })}
                                    onMouseLeave={() => setHoveredBatch(null)}
                                >
                                    <CheckCircle className="size-3.5 fill-emerald-500/20 text-emerald-500 shrink-0" />
                                    <span className="text-foreground font-semibold text-xs">{optimalCount}</span>
                                </span>
                            </Tooltip>
                        );
                    }

                    return (
                        <div className="flex items-center justify-center gap-2.5 font-sans text-xs">
                            {hasCritical && (
                                <Tooltip content={`Lotes críticos (< 3 meses para vencer): ${critical}`} side="top">
                                    <span 
                                        className={cn(
                                            "inline-flex items-center gap-1 cursor-help transition-all duration-200",
                                            isCritOther && "opacity-25 scale-90 blur-[0.3px]",
                                            isCritHovered && "opacity-100 scale-110 font-bold"
                                        )}
                                        onMouseEnter={() => setHoveredBatch({ rowId: row.id, status: "critical" })}
                                        onMouseLeave={() => setHoveredBatch(null)}
                                    >
                                        <AlertCircle className="size-3.5 fill-red-500/20 text-red-500 shrink-0" />
                                        <span className="text-foreground font-semibold text-xs">{critical}</span>
                                    </span>
                                </Tooltip>
                            )}
                            {hasWarning && (
                                <Tooltip content={`Lotes en advertencia (3 a 6 meses para vencer): ${warning}`} side="top">
                                    <span 
                                        className={cn(
                                            "inline-flex items-center gap-1 cursor-help transition-all duration-200",
                                            isWarnOther && "opacity-25 scale-90 blur-[0.3px]",
                                            isWarnHovered && "opacity-100 scale-110 font-bold"
                                        )}
                                        onMouseEnter={() => setHoveredBatch({ rowId: row.id, status: "warning" })}
                                        onMouseLeave={() => setHoveredBatch(null)}
                                    >
                                        <AlertTriangle className="size-3.5 fill-amber-500/20 text-amber-500 shrink-0" />
                                        <span className="text-foreground font-semibold text-xs">{warning}</span>
                                    </span>
                                </Tooltip>
                            )}
                        </div>
                    );
                },
            },
            {
                key: "actions",
                header: "Acciones",
                width: "140px",
                align: "center",
                cell: (row) => (
                    <div className="flex items-center justify-center gap-1">
                        <Tooltip content="Dispensado / Vendido" side="top">
                            <Button
                                variant="tertiary"
                                size="sm"
                                className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-emerald-500/10 transition-all active:scale-[0.96]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDispense(row);
                                }}
                            >
                                <CheckCircle className="size-3.5 text-muted-foreground hover:text-emerald-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Inter-sucursal" side="top">
                            <Button
                                variant="tertiary"
                                size="sm"
                                className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-blue-500/10 transition-all active:scale-[0.96]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTransfer(row);
                                }}
                            >
                                <RefreshCw className="size-3.5 text-muted-foreground hover:text-blue-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Devolución" side="top">
                            <Button
                                variant="tertiary"
                                size="sm"
                                className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-amber-500/10 transition-all active:scale-[0.96]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <PackageX className="size-3.5 text-muted-foreground hover:text-amber-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Destrucción / Eliminar" side="top">
                            <Button
                                variant="tertiary"
                                size="sm"
                                className="relative h-7 w-7 p-0 rounded-md shrink-0 border-border/40 hover:bg-red-500/10 transition-all active:scale-[0.96]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete?.(row.id);
                                }}
                            >
                                <Trash2 className="size-3.5 text-muted-foreground hover:text-red-500" />
                            </Button>
                        </Tooltip>
                    </div>
                ),
            },
        ],
        [getLab, getRubro, onDelete, onEditRequest, hoveredBatch, handleOpenDispense, handleOpenTransfer]
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
                    onClick: () => onDelete?.(item.id)
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
            className="flex flex-col flex-1 overflow-hidden h-full w-full min-w-0 min-h-0 gap-2 p-4"
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
                            placeholder="Buscar por EAN, nombre o lote..." 
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
                    rowHeight={52}
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

            {/* Dialog de confirmación de Dispensado / Vendido (Large Dialog) */}
            <Dialog open={!!dispenseItem} onOpenChange={(open) => { if (!open) setDispenseItem(null); }}>
                <DialogContent size="lg" className="sm:max-w-xl font-sans">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold font-sans">Confirmar producto dispensado / vendido</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1 font-sans">
                            Selecciona el lote y la cantidad dispensada para actualizar el stock y recalcular las alertas de vencimiento.
                        </DialogDescription>
                    </DialogHeader>

                    {dispenseItem && (
                        <div className="flex flex-col gap-4 py-2 font-sans">
                            {/* Información simplificada del producto (sin recuadro) */}
                            <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-base text-foreground font-sans">
                                    {dispenseItem.productName}
                                </span>
                                <span className="text-xs text-muted-foreground font-sans">
                                    EAN: <span className="text-foreground font-medium">{dispenseItem.ean || "S/EAN"}</span> • Stock total actual: <strong className="text-foreground font-semibold">{dispenseItem.quantity} un.</strong>
                                </span>
                            </div>

                            {lotesOptions.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-foreground font-sans">
                                            Lote / Vencimiento a descontar:
                                        </label>
                                        <Select value={selectedLote} onValueChange={handleLoteChange}>
                                            <SelectTrigger placeholder="Seleccionar lote..." className="h-9 text-xs w-full font-sans" />
                                            <SelectContent>
                                                {lotesOptions.map((item: any, idx: number) => (
                                                    <SelectItem key={idx} index={idx} value={item.lote} className="font-sans text-xs">
                                                        Lote: {item.lote} — Vto: {item.vencimiento} — Cant: {item.cantidad} un.
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-foreground font-sans">
                                            Cantidad vendida:
                                        </label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={maxLotQty}
                                            value={dispenseQtyInput}
                                            onChange={(e) => handleDispenseQtyInputChange(e.target.value)}
                                            onBlur={handleDispenseQtyBlur}
                                            className="h-9 text-xs font-semibold tabular-nums font-sans border border-border bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 focus-visible:ring-primary rounded-xl px-3"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <DialogClose render={<Button variant="ghost" className="font-sans" />}>
                            Cancelar
                        </DialogClose>
                        <Button
                            variant="primary"
                            onClick={handleConfirmDispense}
                            className="font-sans"
                        >
                            Confirmar Dispensado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Inter-sucursal (Large Dialog) */}
            <Dialog open={!!transferItem} onOpenChange={(open) => { if (!open) setTransferItem(null); }}>
                <DialogContent size="lg" className="sm:max-w-xl font-sans">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold font-sans">
                            Transferencia Inter-Sucursal
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1 font-sans">
                            Registra el envío de productos a otra sucursal de la red y descuenta el lote de tu inventario.
                        </DialogDescription>
                    </DialogHeader>

                    {transferItem && (
                        <div className="flex flex-col gap-4 py-2 font-sans">
                            {/* Información simplificada del producto */}
                            <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-base text-foreground font-sans">
                                    {transferItem.productName}
                                </span>
                                <span className="text-xs text-muted-foreground font-sans">
                                    EAN: <span className="text-foreground font-medium">{transferItem.ean || "S/EAN"}</span> • Stock total actual: <strong className="text-foreground font-semibold">{transferItem.quantity} un.</strong>
                                </span>
                            </div>

                            {/* Lote y Cantidad a transferir */}
                            {transferLotesOptions.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-foreground font-sans">
                                            Lote / Vencimiento a enviar:
                                        </label>
                                        <Select value={transferSelectedLote} onValueChange={handleTransferLoteChange}>
                                            <SelectTrigger placeholder="Seleccionar lote..." className="h-9 text-xs w-full font-sans" />
                                            <SelectContent>
                                                {transferLotesOptions.map((item: any, idx: number) => (
                                                    <SelectItem key={idx} index={idx} value={item.lote} className="font-sans text-xs">
                                                        Lote: {item.lote} — Vto: {item.vencimiento} — Cant: {item.cantidad} un.
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-foreground font-sans">
                                            Cantidad a enviar:
                                        </label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={transferMaxLotQty}
                                            value={transferQtyInput}
                                            onChange={(e) => handleTransferQtyInputChange(e.target.value)}
                                            onBlur={handleTransferQtyBlur}
                                            className="h-9 text-xs font-semibold tabular-nums font-sans border border-border bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 focus-visible:ring-primary rounded-xl px-3"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Sucursal Destino (Select Scrollable List) */}
                            <div className="flex flex-col gap-1.5 pt-1">
                                <label className="text-xs font-semibold text-foreground font-sans">
                                    Sucursal Destino:
                                </label>
                                <Select value={targetBranch} onValueChange={(val) => { setTargetBranch(val); setBranchError(null); }}>
                                    <SelectTrigger icon={Building01 as any} placeholder="Seleccionar sucursal destino..." className="h-9 text-xs w-full font-sans" />
                                    <SelectContent className="max-h-[220px]">
                                        {DEFAULT_BRANCHES.map((branch, idx) => (
                                            <SelectItem key={branch} index={idx} value={branch} className="font-sans text-xs">
                                                {branch}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {branchError && (
                                    <span className="text-[11px] font-medium text-red-500 font-sans">
                                        {branchError}
                                    </span>
                                )}
                            </div>

                            {/* Número de Envío Plex (Input obligatorio con error state) */}
                            <div className="flex flex-col gap-1.5 pt-1">
                                <label className="text-xs font-semibold text-foreground font-sans flex items-center justify-between">
                                    <span>Número de Envío Plex:</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">Obligatorio</span>
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Ej: ENV-98420"
                                    value={plexShipmentNumber}
                                    onChange={(e) => {
                                        setPlexShipmentNumber(e.target.value);
                                        if (e.target.value.trim()) setPlexError(null);
                                    }}
                                    className={cn(
                                        "h-9 text-xs font-sans bg-transparent text-foreground hover:bg-muted/20 focus-visible:ring-1 rounded-xl px-3 transition-colors",
                                        plexError ? "border-red-500 focus-visible:ring-red-500" : "border-border focus-visible:ring-primary"
                                    )}
                                />
                                {plexError && (
                                    <span className="text-[11px] font-medium text-red-500 font-sans">
                                        {plexError}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <DialogClose render={<Button variant="ghost" className="font-sans" />}>
                            Cancelar
                        </DialogClose>
                        <Button
                            variant="primary"
                            onClick={handleConfirmTransfer}
                            className="font-sans"
                        >
                            Confirmar Transferencia
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

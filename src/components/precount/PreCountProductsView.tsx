import React, { useState, useMemo, useEffect, useRef, Fragment, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Table, type TableColumn } from '@/components/motion/table';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Switch } from '@/components/ui/switch';
import { FluidCheckbox } from '@/components/ui/fluid-checkbox';
import { AlertCircle, AlertTriangle, Check, CheckCircle, Search, X } from 'lucide-react';
import { notify as toast } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Elevated } from '@/lib/elevated';
import { db } from '@/services/db';
import { upsertPreCountItem, updatePreCountItem, deletePreCountItems, getDeviceId } from '@/services/preCountDB';
import { supabase } from '@/integrations/supabase/client';
import { DragStepper } from '@/components/ui/drag-stepper';

const COLOR_PALETTE: BadgeColor[] = [
    "blue",
    "emerald",
    "amber",
    "violet",
    "cyan",
    "indigo",
    "teal",
    "fuchsia",
    "rose",
    "orange"
];

function getBatchColor(batchStr: string): BadgeColor {
    if (!batchStr || batchStr === "S/L") return "gray";
    let hash = 0;
    for (let i = 0; i < batchStr.length; i++) {
        hash = batchStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTE.length;
    return COLOR_PALETTE[index];
}

export interface ProductExpirationItem {
    id: string;
    controlDate: number | string;
    ean: string;
    productName: string;
    laboratory: string;
    rubro: string;
    quantity: number;
    systemStock?: number;
    user?: string;
    position?: string;
    sector?: string;
    isAdding?: boolean;
    lotesData?: {
        lote: string;
        vencimiento: string;
        cantidad: number;
        status?: "critical" | "warning" | "normal";
    }[];
    lotes?: string[];
}

export interface CandidateProduct {
    ean: string;
    name: string;
    lab: string;
    rubro: string;
    id_producto?: string;
    systemStock?: number;
    exactMatch?: boolean;
    isNewOption?: boolean;
}

function normalizeText(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export interface PreCountProductActionsProps {
    selectedCount: number;
    selectedIds: Set<string>;
    onDeleteSelected: () => void;
    canRestore: boolean;
    onRestoreDeleted: () => void;
}

interface PreCountProductsViewProps {
    className?: string;
    sessionId?: string;
    items?: ProductExpirationItem[];
    actions?: React.ReactNode | ((props: PreCountProductActionsProps) => React.ReactNode);
    isEditing?: boolean;
    onEditingChange?: (editing: boolean) => void;
    onItemsChange?: (items: ProductExpirationItem[]) => void;
    visibleColumns?: string[];
    addProductTrigger?: number;
    isBranchMode?: boolean;
    activeSector?: string | null;
    onOpenSectorModal?: () => void;
}

export function PreCountProductsView({
    className,
    sessionId,
    items: propItems,
    onItemsChange,
    actions,
    isEditing: propIsEditing,
    onEditingChange,
    visibleColumns,
    addProductTrigger,
    isBranchMode = false,
    activeSector,
    onOpenSectorModal,
}: PreCountProductsViewProps) {
    const [internalEditing, setInternalEditing] = useState(false);
    const isEditing = propIsEditing !== undefined ? propIsEditing : internalEditing;
    const handleToggleEditing = () => {
        if (onEditingChange) {
            onEditingChange(!isEditing);
        } else {
            setInternalEditing(prev => !prev);
        }
    };

    // Resolver ID de la sesión activa
    const effectiveSessionId = useMemo(() => {
        if (sessionId) return sessionId;
        if (typeof window !== 'undefined') {
            return localStorage.getItem('last_precount_session_id') || 
                   localStorage.getItem('precount_session_id') || 
                   sessionStorage.getItem('active_precount_session_id') || 
                   '';
        }
        return '';
    }, [sessionId]);

    // Sector activo actual de la sesión
    const currentActiveSector = useMemo(() => {
        if (activeSector) return activeSector;
        if (typeof window !== 'undefined' && effectiveSessionId) {
            return localStorage.getItem(`precount_active_sector_${effectiveSessionId}`) || null;
        }
        return null;
    }, [activeSector, effectiveSessionId]);

    // Consulta reactiva en vivo desde Dexie db.items para la sesión activa
    const dbItems = useLiveQuery(
        async () => {
            if (!effectiveSessionId) return [];
            try {
                let records = await db.items.where('session_id').equals(effectiveSessionId).reverse().sortBy('scanned_at');
                
                // En modo sucursal, mostrar única y exclusivamente los conteos cargados por esta terminal local
                if (isBranchMode) {
                    const myDeviceId = (getDeviceId() || '').toLowerCase();
                    const myDeviceName = (typeof window !== 'undefined' ? (localStorage.getItem('precount_device_name') || localStorage.getItem('precount_user_name') || '') : '').toLowerCase().trim();

                    records = records.filter(rec => {
                        const recDevId = (rec.device_id || '').toLowerCase();
                        const recDevName = (rec.device_name || '').toLowerCase();
                        const recScannedBy = (rec.scanned_by || '').toLowerCase();

                        // Coincidencia con el device_id actual
                        if (recDevId && (recDevId === myDeviceId || myDeviceId.includes(recDevId) || recDevId.includes(myDeviceId))) {
                            return true;
                        }
                        // Coincidencia con el nombre de terminal configurado localmente
                        if (myDeviceName && recDevName && (recDevName === myDeviceName || recDevName.includes(myDeviceName) || myDeviceName.includes(recDevName))) {
                            return true;
                        }
                        // Si no tiene device_id remoto explícito y no es de una Zebra u otra terminal remota
                        if (!recDevId && !recDevName.includes('zebra') && !recScannedBy.includes('zebra')) {
                            return true;
                        }
                        return false;
                    });
                }
                
                // Mapear metadatos desde precount_products si no vinieron en el item
                const productsMap = new Map<string, { lab?: string; rubro?: string; name?: string; systemStock?: number }>();
                const sessionProducts = await db.precount_products.where('session_id').equals(effectiveSessionId).toArray();
                sessionProducts.forEach(p => {
                    productsMap.set(p.ean, { 
                        lab: p.laboratory, 
                        rubro: p.rubro, 
                        name: p.name,
                        systemStock: p.stock ?? (p as any).systemStock
                    });
                });

                if (sessionProducts.length === 0) {
                    const session = await db.sessions.get(effectiveSessionId);
                    if (session?.master_catalog && Array.isArray(session.master_catalog)) {
                        session.master_catalog.forEach((p: any) => {
                            const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
                            eans.filter(Boolean).forEach(ean => {
                                productsMap.set(ean, { 
                                    lab: p.laboratory, 
                                    rubro: p.rubro || p.category, 
                                    name: p.name,
                                    systemStock: p.systemStock ?? p.stock
                                });
                            });
                        });
                    }
                }

                const operatorName = (typeof window !== 'undefined' ? localStorage.getItem('precount_device_name') : null) || 'Operador';

                return records.map((rec): ProductExpirationItem => {
                    const catInfo = productsMap.get(rec.ean);
                    return {
                        id: rec.id,
                        controlDate: rec.scanned_at ? new Date(rec.scanned_at).getTime() : Date.now(),
                        ean: rec.ean,
                        productName: rec.product_name || catInfo?.name || `Producto ${rec.ean}`,
                        laboratory: rec.laboratory || catInfo?.lab || 'Laboratorio',
                        rubro: rec.rubro || catInfo?.rubro || 'Medicamentos',
                        quantity: rec.quantity,
                        systemStock: catInfo?.systemStock,
                        user: rec.device_name || operatorName,
                        sector: rec.location_tag || '–',
                        position: rec.location_tag || '–',
                    };
                });
            } catch (err) {
                console.error("Error cargando items de Dexie:", err);
                return [];
            }
        },
        [effectiveSessionId, isBranchMode]
    );

    // Sincronizar ítems de todos los usuarios y dispositivos desde Supabase para la sesión activa
    useEffect(() => {
        if (!effectiveSessionId) return;

        let isMounted = true;

        const syncRemoteItems = async () => {
            try {
                const { data, error } = await supabase
                    .from('precount_items')
                    .select('*')
                    .eq('session_id', effectiveSessionId);

                if (error) {
                    console.error('[PreCountProductsView] Error al sincronizar items remotos:', error);
                    return;
                }

                if (data && isMounted) {
                    const remoteIds = new Set(data.map((item: any) => item.id));

                    // Obtener acciones pendientes de creación/actualización para no borrar ítems pendientes offline
                    const pendingActions = await db.pendingActions.where('entity').equals('item').toArray();
                    const pendingIds = new Set(pendingActions.map(a => a.data?.id).filter(Boolean));

                    // Limpiar ítems de Dexie que ya no existen en Supabase y no están pendientes de subida
                    const localSessionItems = await db.items.where('session_id').equals(effectiveSessionId).toArray();
                    const staleLocalIds = localSessionItems
                        .filter(item => !remoteIds.has(item.id) && !pendingIds.has(item.id))
                        .map(item => item.id);

                    if (staleLocalIds.length > 0) {
                        await db.items.bulkDelete(staleLocalIds);
                    }

                    if (data.length > 0) {
                        const localRows = data.map((item: any) => ({
                            id: item.id,
                            session_id: item.session_id,
                            ean: item.ean,
                            product_name: item.product_name || `Producto ${item.ean}`,
                            quantity: item.quantity || 0,
                            scanned_at: item.scanned_at || new Date().toISOString(),
                            scanned_by: item.scanned_by || undefined,
                            synced: 1,
                            id_producto: item.id_producto || undefined,
                            device_id: item.device_id || undefined,
                            device_name: item.device_name || undefined,
                            location_tag: item.location_tag || undefined,
                            laboratory: item.laboratory || undefined,
                            rubro: item.rubro || undefined,
                        }));
                        await db.items.bulkPut(localRows);
                    }
                }
            } catch (err) {
                console.error('[PreCountProductsView] Error inesperado en syncRemoteItems:', err);
            }
        };

        syncRemoteItems();
        const pollInterval = setInterval(syncRemoteItems, 4000);

        const handleForceRefresh = () => syncRemoteItems();
        window.addEventListener('precount:item_scanned' as any, handleForceRefresh);
        window.addEventListener('precount:item_added' as any, handleForceRefresh);

        // Suscripción Realtime para recibir conteos en vivo de todos los operadores/dispositivos
        const channel = supabase
            .channel(`precount_items_products_view_${effectiveSessionId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'precount_items',
                    filter: `session_id=eq.${effectiveSessionId}`,
                },
                async (payload) => {
                    if (!isMounted) return;
                    try {
                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const item = payload.new as any;
                            await db.items.put({
                                id: item.id,
                                session_id: item.session_id,
                                ean: item.ean,
                                product_name: item.product_name || `Producto ${item.ean}`,
                                quantity: item.quantity || 0,
                                scanned_at: item.scanned_at || new Date().toISOString(),
                                scanned_by: item.scanned_by || undefined,
                                synced: 1,
                                id_producto: item.id_producto || undefined,
                                device_id: item.device_id || undefined,
                                device_name: item.device_name || undefined,
                                location_tag: item.location_tag || undefined,
                                laboratory: item.laboratory || undefined,
                                rubro: item.rubro || undefined,
                            });
                        } else if (payload.eventType === 'DELETE') {
                            const old = payload.old as any;
                            if (old?.id) {
                                await db.items.delete(old.id);
                            }
                        }
                    } catch (err) {
                        console.error('[PreCountProductsView] Error procesando cambio Realtime:', err);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            clearInterval(pollInterval);
            window.removeEventListener('precount:item_scanned' as any, handleForceRefresh);
            window.removeEventListener('precount:item_added' as any, handleForceRefresh);
            supabase.removeChannel(channel);
        };
    }, [effectiveSessionId]);

    const [tableData, setTableData] = useState<ProductExpirationItem[]>(propItems || []);

    useEffect(() => {
        if (propItems !== undefined) {
            setTableData(prev => {
                const addingRow = prev.find(r => r.isAdding);
                return addingRow ? [addingRow, ...propItems] : propItems;
            });
        } else if (dbItems !== undefined) {
            setTableData(prev => {
                const addingRow = prev.find(r => r.isAdding);
                return addingRow ? [addingRow, ...dbItems] : dbItems;
            });
        }
    }, [propItems, dbItems]);

    // Mantener reactivo el sector en la fila activa de carga según el sector abierto
    useEffect(() => {
        setTableData(prev => prev.map(row => {
            if (row.isAdding) {
                return {
                    ...row,
                    sector: currentActiveSector || '–',
                    position: currentActiveSector || '–',
                };
            }
            return row;
        }));
        if (currentActiveSector && isBranchMode) {
            setTimeout(() => {
                eanInputRef.current?.focus();
            }, 60);
        }
    }, [currentActiveSector, isBranchMode]);

    // Notificar al componente padre cuando cambian los ítems escaneados reales
    useEffect(() => {
        if (onItemsChange) {
            const cleanItems = tableData.filter(r => !r.isAdding && r.ean && r.ean.trim() !== "");
            onItemsChange(cleanItems);
        }
    }, [tableData, onItemsChange]);

    const [searchValue, setSearchValue] = useState("");
    const [selectedUser, setSelectedUser] = useState("");
    const [selectedLaboratory, setSelectedLaboratory] = useState("");
    const [selectedRubro, setSelectedRubro] = useState("");
    const [selectedPosition, setSelectedPosition] = useState("");

    // Estado para agregar un producto inline en la tabla
    const [addingRowId, setAddingRowId] = useState<string | null>(null);
    const [addingStep, setAddingStep] = useState<"ean" | "quantity">("ean");
    const [newEan, setNewEan] = useState("");
    const [newQuantity, setNewQuantity] = useState<number | string>(1);
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);

    const eanInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRef = useRef<HTMLInputElement>(null);

    // Búsqueda dinámica en tiempo real optimizada con precarga en memoria y scoring de relevancia
    const [candidateProducts, setCandidateProducts] = useState<CandidateProduct[]>([]);
    const candidateProductsRef = useRef<CandidateProduct[]>([]);
    candidateProductsRef.current = candidateProducts;

    const selectedCandidateIndexRef = useRef<number>(0);
    selectedCandidateIndexRef.current = selectedCandidateIndex;

    const candidateListRef = useRef<HTMLDivElement>(null);
    const candidateDropdownRef = useRef<HTMLDivElement>(null);

    // Scroll vertical sincronizado con la navegación por teclado (sin scroll horizontal)
    useEffect(() => {
        if (selectedCandidateIndex >= 0 && candidateListRef.current) {
            const itemEl = candidateListRef.current.children[selectedCandidateIndex] as HTMLElement;
            if (itemEl) {
                const container = candidateListRef.current;
                const itemTop = itemEl.offsetTop;
                const itemBottom = itemTop + itemEl.offsetHeight;
                const containerTop = container.scrollTop;
                const containerBottom = containerTop + container.clientHeight;

                if (itemTop < containerTop) {
                    container.scrollTop = itemTop;
                } else if (itemBottom > containerBottom) {
                    container.scrollTop = itemBottom - container.clientHeight;
                }
            }
        }
    }, [selectedCandidateIndex]);

    // Cerrar dropdown al hacer click fuera del input y del contenedor
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                candidateDropdownRef.current && 
                !candidateDropdownRef.current.contains(event.target as Node) &&
                eanInputRef.current && 
                !eanInputRef.current.contains(event.target as Node)
            ) {
                setCandidateProducts([]);
            }
        }
        if (candidateProducts.length > 0) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [candidateProducts.length]);

    const sessionCatalogRef = useRef<{
        ean: string;
        eanLower: string;
        name: string;
        nameNorm: string;
        lab: string;
        rubro: string;
        id_producto?: string;
        systemStock?: number;
    }[]>([]);
    const catalogStockMapRef = useRef<Map<string, number>>(new Map());
    const catalogMapRef = useRef<Map<string, {
        ean: string;
        eanLower: string;
        name: string;
        nameNorm: string;
        lab: string;
        rubro: string;
        id_producto?: string;
        systemStock?: number;
    }>>(new Map());

    // 1. Precargar catálogo de la sesión en memoria para búsquedas instantáneas a cualquier velocidad
    useEffect(() => {
        let isMounted = true;
        const loadCatalog = async () => {
            if (!effectiveSessionId) return;
            try {
                let prods = await db.precount_products
                    .where('session_id')
                    .equals(effectiveSessionId)
                    .toArray();

                if (prods.length === 0) {
                    const session = await db.sessions.get(effectiveSessionId);
                    if (session?.master_catalog && Array.isArray(session.master_catalog)) {
                        prods = session.master_catalog.flatMap((p: any) => {
                            const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
                            return eans.filter(Boolean).map(ean => ({
                                ean,
                                name: p.name || '',
                                cost: p.cost || 0,
                                salePrice: p.salePrice || 0,
                                laboratory: p.laboratory || '',
                                rubro: p.rubro || p.category || '',
                                stock: p.systemStock ?? p.stock ?? 0,
                                id_producto: p.id_producto || '',
                                session_id: effectiveSessionId
                            }));
                        });
                    }
                }

                if (!isMounted) return;

                const stockMap = new Map<string, number>();
                const catMap = new Map<string, {
                    ean: string;
                    eanLower: string;
                    name: string;
                    nameNorm: string;
                    lab: string;
                    rubro: string;
                    id_producto?: string;
                    systemStock?: number;
                }>();

                const indexed = prods.map(p => {
                    const eanStr = String(p.ean || '').trim();
                    const eanLow = eanStr.toLowerCase();
                    const stockVal = p.stock ?? (p as any).systemStock;
                    const item = {
                        ean: eanStr,
                        eanLower: eanLow,
                        name: String(p.name || '').trim(),
                        nameNorm: normalizeText(String(p.name || '')),
                        lab: p.laboratory || '',
                        rubro: p.rubro || (p as any).category || '',
                        id_producto: p.id_producto,
                        systemStock: stockVal
                    };
                    if (eanLow) {
                        if (stockVal !== undefined && stockVal !== null) {
                            stockMap.set(eanLow, stockVal);
                        }
                        if (!catMap.has(eanLow)) {
                            catMap.set(eanLow, item);
                        }
                    }
                    if (item.id_producto) {
                        const idLow = String(item.id_producto).trim().toLowerCase();
                        if (idLow) {
                            if (stockVal !== undefined && stockVal !== null && !stockMap.has(idLow)) {
                                stockMap.set(idLow, stockVal);
                            }
                            if (!catMap.has(idLow)) {
                                catMap.set(idLow, item);
                            }
                        }
                    }
                    return item;
                });

                sessionCatalogRef.current = indexed;
                catalogStockMapRef.current = stockMap;
                catalogMapRef.current = catMap;
            } catch (err) {
                console.error("Error precargando catálogo en memoria:", err);
            }
        };

        loadCatalog();

        return () => {
            isMounted = false;
        };
    }, [effectiveSessionId]);

    // 2. Búsqueda instantánea en memoria (0ms lag, sin condiciones de carrera, orden por relevancia)
    const lastQueryRef = useRef<string>("");
    useEffect(() => {
        const clean = newEan.trim();
        const isNewQuery = clean !== lastQueryRef.current;
        lastQueryRef.current = clean;

        if (!clean) {
            setCandidateProducts([]);
            setSelectedCandidateIndex(0);
            return;
        }

        const cleanLower = clean.toLowerCase();
        const cleanNorm = normalizeText(clean);
        const catalog = sessionCatalogRef.current;

        const scored: { cand: CandidateProduct; score: number }[] = [];
        const seenEans = new Set<string>();

        // Buscar en el catálogo precargado por EAN, ID de Producto o Nombre
        for (let i = 0; i < catalog.length; i++) {
            const item = catalog[i];
            if (!item.ean && !item.id_producto) continue;

            let score = 0;
            let exact = false;

            // Prioridad para Código EAN o ID de Producto
            const idProdLow = item.id_producto ? String(item.id_producto).trim().toLowerCase() : '';
            if (item.eanLower === cleanLower || (idProdLow && idProdLow === cleanLower)) {
                score += 10000;
                exact = true;
            } else if (item.eanLower.startsWith(cleanLower) || (idProdLow && idProdLow.startsWith(cleanLower))) {
                score += 6000 + Math.max(0, 50 - (idProdLow === cleanLower ? idProdLow.length : item.eanLower.length));
            } else if (item.eanLower.includes(cleanLower) || (idProdLow && idProdLow.includes(cleanLower))) {
                score += 1500;
            }

            // Prioridad para Nombre / Descripción (sin regex split para máxima velocidad)
            if (item.nameNorm === cleanNorm) {
                score += 9000;
                exact = true;
            } else if (item.nameNorm.startsWith(cleanNorm)) {
                score += 5000;
            } else if (item.nameNorm.includes(cleanNorm)) {
                const idx = item.nameNorm.indexOf(cleanNorm);
                if (idx > 0 && /[\s\-_\/]/.test(item.nameNorm[idx - 1])) {
                    score += 3500;
                } else {
                    score += 1000;
                }
            }

            if (score > 0) {
                const uniqueKey = item.eanLower || idProdLow;
                if (!seenEans.has(uniqueKey)) {
                    seenEans.add(uniqueKey);
                    scored.push({
                        score,
                        cand: {
                            ean: item.ean,
                            name: item.name,
                            lab: item.lab,
                            rubro: item.rubro,
                            id_producto: item.id_producto,
                            systemStock: item.systemStock,
                            exactMatch: exact
                        }
                    });
                }
            }
        }

        // Incluir items ya declarados en la tabla si no estaban en el catálogo
        for (let i = 0; i < tableData.length; i++) {
            const td = tableData[i];
            if (td.ean && !td.isAdding) {
                const tdEanLower = td.ean.toLowerCase();
                if (seenEans.has(tdEanLower)) continue;
                const tdNameNorm = normalizeText(td.productName);

                let score = 0;
                let exact = false;
                if (tdEanLower === cleanLower) {
                    score += 10000;
                    exact = true;
                } else if (tdEanLower.startsWith(cleanLower)) {
                    score += 6000;
                } else if (tdEanLower.includes(cleanLower)) {
                    score += 1500;
                }

                if (tdNameNorm === cleanNorm) {
                    score += 9000;
                    exact = true;
                } else if (tdNameNorm.startsWith(cleanNorm)) {
                    score += 5000;
                } else if (tdNameNorm.includes(cleanNorm)) {
                    const idx = tdNameNorm.indexOf(cleanNorm);
                    if (idx > 0 && /[\s\-_\/]/.test(tdNameNorm[idx - 1])) {
                        score += 3500;
                    } else {
                        score += 1000;
                    }
                }

                if (score > 0) {
                    seenEans.add(tdEanLower);
                    scored.push({
                        score,
                        cand: {
                            ean: td.ean,
                            name: td.productName,
                            lab: td.laboratory || 'Laboratorio',
                            rubro: td.rubro || 'Medicamentos',
                            id_producto: undefined,
                            systemStock: td.systemStock,
                            exactMatch: exact
                        }
                    });
                }
            }
        }

        // Ordenar por relevancia (mayor score arriba)
        scored.sort((a, b) => b.score - a.score);

        const results: CandidateProduct[] = scored.slice(0, 10).map(s => s.cand);
        const hasExact = results.some(r => r.exactMatch || r.ean.toLowerCase() === cleanLower);

        // Si NO hay coincidencias en el catálogo pero el usuario escribió 2 o más caracteres, ofrecer crear producto
        if (results.length === 0 && clean.length >= 2) {
            results.push({
                ean: clean,
                name: `Producto SKU-${clean} (Nuevo producto)`,
                lab: "Laboratorio General",
                rubro: "Medicamentos",
                id_producto: undefined,
                isNewOption: true
            });
        } else if (results.length > 0 && !hasExact && clean.length >= 3) {
            // Ofrecer opción al final de la lista para registrar como nuevo si ninguna coincidencia le sirve
            results.push({
                ean: clean,
                name: `Registrar como nuevo (SKU ${clean})`,
                lab: "Laboratorio General",
                rubro: "Medicamentos",
                id_producto: undefined,
                isNewOption: true
            });
        }

        setCandidateProducts(results);
        if (isNewQuery) {
            setSelectedCandidateIndex(0);
        }
    }, [newEan]);

    const handleStartAddProduct = useCallback(() => {
        const tempId = `temp-new-${Date.now()}`;
        const initialSector = currentActiveSector || (selectedPosition && selectedPosition !== "all" ? selectedPosition : "");
        const currentOperator = (typeof window !== 'undefined' ? localStorage.getItem('precount_device_name') : null) || 'Operador';

        const tempRow: ProductExpirationItem = {
            id: tempId,
            controlDate: Date.now(),
            ean: "",
            productName: "",
            laboratory: "",
            rubro: selectedRubro && selectedRubro !== "all" ? selectedRubro : "",
            sector: initialSector || "–",
            position: initialSector || "–",
            quantity: 1,
            user: currentOperator,
            isAdding: true,
        };

        setNewEan("");
        setNewQuantity(1);
        setSelectedCandidateIndex(0);
        setAddingStep("ean");
        setAddingRowId(tempId);

        setTableData(prev => [tempRow, ...prev.filter(r => !r.isAdding)]);
        setSearchValue("");

        setTimeout(() => {
            eanInputRef.current?.focus();
        }, 60);
    }, [currentActiveSector, selectedPosition, selectedRubro, isBranchMode]);

    useEffect(() => {
        if (addProductTrigger && addProductTrigger > 0) {
            handleStartAddProduct();
        }
    }, [addProductTrigger, handleStartAddProduct]);

    // Para perfil de sucursal, la fila para agregar producto siempre debe estar activa
    useEffect(() => {
        if (isBranchMode && !addingRowId) {
            handleStartAddProduct();
        }
    }, [isBranchMode, addingRowId, handleStartAddProduct]);

    const handleEanChange = (val: string) => {
        setNewEan(val);
        setSelectedCandidateIndex(0);
    };

    const handleSelectCandidate = useCallback((item: CandidateProduct) => {
        setNewEan(item.ean);
        setTableData(prev => prev.map(row => {
            if (row.id !== addingRowId) return row;
            return {
                ...row,
                ean: item.ean,
                productName: item.name,
                laboratory: item.lab,
                rubro: item.rubro,
                systemStock: item.systemStock,
            };
        }));
        setCandidateProducts([]);
        setAddingStep("quantity");
        setTimeout(() => {
            quantityInputRef.current?.focus();
            quantityInputRef.current?.select();
        }, 50);
    }, [addingRowId]);

    const handleConfirmEan = async () => {
        if (isBranchMode && !currentActiveSector) {
            toast.warning("Sector requerido", "Debes abrir un sector para comenzar a cargar productos.");
            onOpenSectorModal?.();
            return;
        }

        const selected = candidateProducts[selectedCandidateIndex] || candidateProducts[0];
        if (selected) {
            handleSelectCandidate(selected);
            return;
        }

        const clean = newEan.trim();
        if (!clean) {
            toast.warning("Por favor ingresá un código EAN o descripción");
            eanInputRef.current?.focus();
            return;
        }

        // Búsqueda instantánea O(1) en el mapa del catálogo precargado
        const cleanLower = clean.toLowerCase();
        const memMatch = catalogMapRef.current.get(cleanLower);
        if (memMatch) {
            handleSelectCandidate({
                ean: memMatch.ean || clean,
                name: memMatch.name,
                lab: memMatch.lab || '',
                rubro: memMatch.rubro || '',
                id_producto: memMatch.id_producto,
                systemStock: memMatch.systemStock
            });
            return;
        }

        try {
            let directMatch = effectiveSessionId 
                ? await db.precount_products.where('[session_id+ean]').equals([effectiveSessionId, clean]).first()
                : await db.precount_products.where('ean').equals(clean).first();
            
            if (!directMatch && effectiveSessionId) {
                try {
                    directMatch = await db.precount_products
                        .where('[session_id+id_producto]')
                        .equals([effectiveSessionId, clean])
                        .first();
                } catch {
                    // Fallback to filter if index is not ready
                }
                if (!directMatch) {
                    directMatch = await db.precount_products
                        .where('session_id').equals(effectiveSessionId)
                        .filter(p => p.id_producto === clean || String(p.id_producto).trim() === clean)
                        .first();
                }
            } else if (!directMatch) {
                directMatch = await db.precount_products
                    .filter(p => p.id_producto === clean || String(p.id_producto).trim() === clean)
                    .first();
            }

            if (directMatch) {
                handleSelectCandidate({
                    ean: directMatch.ean || clean,
                    name: directMatch.name,
                    lab: directMatch.laboratory || '',
                    rubro: directMatch.rubro || '',
                    id_producto: directMatch.id_producto,
                    systemStock: directMatch.stock ?? (directMatch as any).systemStock
                });
                return;
            }
        } catch (err) {
            console.warn("Error en búsqueda directa de EAN / ID:", err);
        }

        // Búsqueda en el backend (Supabase) por EAN o IDProducto
        try {
            const { getProductByEanOrId } = await import('@/services/productService');
            const remoteProd = await getProductByEanOrId(clean);
            if (remoteProd) {
                handleSelectCandidate({
                    ean: remoteProd.ean || clean,
                    name: remoteProd.name,
                    lab: remoteProd.laboratory || '',
                    rubro: remoteProd.category || '',
                    id_producto: remoteProd.id_producto,
                    systemStock: remoteProd.stock
                });
                return;
            }
        } catch (remoteErr) {
            console.warn("Error en búsqueda remota por EAN o ID:", remoteErr);
        }

        handleSelectCandidate({
            ean: clean,
            name: clean.length >= 3 ? `Producto SKU-${clean}` : "Producto nuevo",
            lab: "",
            rubro: "",
        });
    };

    const handleCommitNewProduct = async () => {
        if (isBranchMode && !currentActiveSector) {
            toast.warning("Sector requerido", "Debes abrir un sector para comenzar a cargar productos.");
            onOpenSectorModal?.();
            return;
        }

        const qtyNum = typeof newQuantity === "number" ? newQuantity : parseInt(String(newQuantity), 10);
        if (!qtyNum || qtyNum < 1) {
            toast.warning("La cantidad debe ser mayor a 0");
            setNewQuantity(1);
            quantityInputRef.current?.focus();
            quantityInputRef.current?.select();
            return;
        }

        const finalEan = newEan.trim() || `779${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const candidate = candidateProducts.find(c => c.ean === finalEan || c.id_producto === finalEan) || candidateProducts[0];
        const activeRow = tableData.find(r => r.id === addingRowId);
        const resolvedEan = candidate?.ean || activeRow?.ean || finalEan;
        const finalName = candidate?.name || activeRow?.productName || `Producto SKU-${finalEan}`;
        const finalLab = candidate?.lab || activeRow?.laboratory || "";
        const finalRubro = candidate?.rubro || activeRow?.rubro || "";
        const finalSector = currentActiveSector || (selectedPosition && selectedPosition !== "all" ? selectedPosition : (activeRow?.sector && activeRow.sector !== "–" ? activeRow.sector : ""));
        const currentOperator = (typeof window !== 'undefined' ? localStorage.getItem('precount_device_name') : null) || activeRow?.user || 'Operador';
        const finalSysStock = candidate?.systemStock ?? activeRow?.systemStock ?? (resolvedEan ? catalogStockMapRef.current.get(resolvedEan.toLowerCase()) : undefined);

        const committedRow: ProductExpirationItem = {
            id: `prod-${Date.now()}`,
            controlDate: Date.now(),
            ean: resolvedEan,
            productName: finalName,
            laboratory: finalLab,
            rubro: finalRubro,
            sector: finalSector || "–",
            position: finalSector || "–",
            quantity: qtyNum,
            systemStock: finalSysStock,
            user: currentOperator,
            isAdding: false,
        };

        if (isBranchMode) {
            const nextTempId = `temp-new-${Date.now() + 1}`;
            const nextInitialSector = finalSector;
            const nextTempRow: ProductExpirationItem = {
                id: nextTempId,
                controlDate: Date.now(),
                ean: "",
                productName: "",
                laboratory: "",
                rubro: selectedRubro && selectedRubro !== "all" ? selectedRubro : "",
                sector: nextInitialSector || "–",
                position: nextInitialSector || "–",
                quantity: 1,
                user: currentOperator,
                isAdding: true,
            };

            setTableData(prev => [nextTempRow, committedRow, ...prev.filter(r => r.id !== addingRowId && !r.isAdding)]);
            setAddingRowId(nextTempId);
            setAddingStep("ean");
            setNewEan("");
            setNewQuantity(1);
            setCandidateProducts([]);
            setSelectedCandidateIndex(0);

            setTimeout(() => {
                eanInputRef.current?.focus();
            }, 60);
        } else {
            setTableData(prev => [committedRow, ...prev.filter(r => r.id !== addingRowId && !r.isAdding)]);
            setAddingRowId(null);
            setNewEan("");
            setNewQuantity(1);
            setCandidateProducts([]);
            setSelectedCandidateIndex(0);
        }

        if (effectiveSessionId) {
            try {
                await upsertPreCountItem({
                    session_id: effectiveSessionId,
                    ean: resolvedEan,
                    product_name: finalName,
                    quantity: qtyNum,
                    id_producto: candidate?.id_producto,
                    laboratory: finalLab,
                    rubro: finalRubro,
                    location_tag: finalSector || undefined,
                });
            } catch (dbErr) {
                console.error("Error guardando ítem en base local:", dbErr);
            }

            // Notificar al monitor en vivo de las nuevas unidades escaneadas
            try {
                const myDeviceId = (getDeviceId() || '').toLowerCase();
                const myDeviceName = (typeof window !== 'undefined' ? (localStorage.getItem('precount_device_name') || localStorage.getItem('precount_user_name') || '') : '').toLowerCase().trim();

                let allItems = await db.items.where('session_id').equals(effectiveSessionId).toArray();
                allItems = allItems.filter(rec => {
                    const recDevId = (rec.device_id || '').toLowerCase();
                    const recDevName = (rec.device_name || '').toLowerCase();
                    const recScannedBy = (rec.scanned_by || '').toLowerCase();
                    if (recDevId && (recDevId === myDeviceId || myDeviceId.includes(recDevId) || recDevId.includes(myDeviceId))) return true;
                    if (myDeviceName && recDevName && (recDevName === myDeviceName || recDevName.includes(myDeviceName) || myDeviceName.includes(recDevName))) return true;
                    if (!recDevId && !recDevName.includes('zebra') && !recScannedBy.includes('zebra')) return true;
                    return false;
                });

                const locMap: Record<string, number> = {};
                let totalUnits = 0;
                const skusSet = new Set<string>();
                allItems.forEach((i: any) => {
                    const loc = (i.location_tag || i.sector || '').toUpperCase();
                    const qty = Number(i.quantity) || 1;
                    if (loc) {
                        locMap[loc] = (locMap[loc] || 0) + qty;
                    }
                    totalUnits += qty;
                    if (i.ean) skusSet.add(i.ean);
                });

                const { emitDeviceTelemetry } = await import('@/services/deviceTelemetry');
                emitDeviceTelemetry({
                    sessionId: effectiveSessionId,
                    currentLocation: currentActiveSector,
                    totalScanned: totalUnits,
                    totalSkus: skusSet.size,
                    locationUnits: currentActiveSector ? (locMap[currentActiveSector.toUpperCase()] || 0) : 0,
                    locationsMap: locMap,
                }).catch(() => {});
            } catch (telemErr) {
                console.debug('[PreCountProductsView] Error emitiendo telemetría post-scan:', telemErr);
            }
        }
    };

    const handleCancelAddProduct = () => {
        if (isBranchMode) {
            setNewEan("");
            setNewQuantity(1);
            setSelectedCandidateIndex(0);
            setCandidateProducts([]);
            setAddingStep("ean");
            setTableData(prev => prev.map(r => r.id === addingRowId ? {
                ...r,
                ean: "",
                productName: "",
                laboratory: "",
                rubro: selectedRubro && selectedRubro !== "all" ? selectedRubro : "",
                quantity: 1,
            } : r));
            setTimeout(() => {
                eanInputRef.current?.focus();
            }, 60);
            return;
        }

        setTableData(prev => prev.filter(r => r.id !== addingRowId && !r.isAdding));
        setAddingRowId(null);
        setNewEan("");
        setNewQuantity(1);
        setCandidateProducts([]);
        setSelectedCandidateIndex(0);
    };

    const [hoveredBatch, setHoveredBatch] = useState<{
        rowId: string;
        loteName?: string;
        status?: string;
    } | null>(null);

    const deferredSearchValue = React.useDeferredValue(searchValue);

    const filteredItems = useMemo(() => {
        const term = deferredSearchValue.trim().toLowerCase();
        const hasSearch = term.length > 0;
        const hasUser = Boolean(selectedUser && selectedUser !== "all");
        const userFilter = hasUser ? selectedUser.toLowerCase() : "";
        const hasLab = Boolean(selectedLaboratory && selectedLaboratory !== "all");
        const labFilter = hasLab ? selectedLaboratory.toLowerCase() : "";
        const hasRubro = Boolean(selectedRubro && selectedRubro !== "all");
        const rubroFilter = hasRubro ? selectedRubro.toLowerCase() : "";
        const hasPos = Boolean(selectedPosition && selectedPosition !== "all");
        const posFilter = hasPos ? selectedPosition.toLowerCase() : "";

        // Fast-path: si no hay filtros activos y no hay fila agregándose, retornar la lista directamente
        const hasAnyFilter = hasSearch || hasUser || hasLab || hasRubro || hasPos;
        const addingRow = tableData.find(r => r.isAdding);

        if (!hasAnyFilter && !addingRow) {
            return tableData;
        }

        const filtered: ProductExpirationItem[] = [];
        for (let i = 0; i < tableData.length; i++) {
            const item = tableData[i];
            if (item.isAdding) continue;

            if (hasUser && (item.user?.toLowerCase() !== userFilter)) continue;
            if (hasLab && (item.laboratory?.toLowerCase() !== labFilter)) continue;
            if (hasRubro && (item.rubro?.toLowerCase() !== rubroFilter)) continue;
            if (hasPos) {
                const posMatch = (item.position && item.position.toLowerCase() === posFilter) ||
                                 (item.sector && item.sector.toLowerCase() === posFilter);
                if (!posMatch) continue;
            }
            if (hasSearch) {
                const match = item.ean.toLowerCase().includes(term) ||
                    item.productName.toLowerCase().includes(term) ||
                    (item.laboratory && item.laboratory.toLowerCase().includes(term)) ||
                    (item.rubro && item.rubro.toLowerCase().includes(term)) ||
                    (item.sector && item.sector.toLowerCase().includes(term)) ||
                    (item.position && item.position.toLowerCase().includes(term)) ||
                    (item.user && item.user.toLowerCase().includes(term)) ||
                    (item.lotes && item.lotes.some(l => l.toLowerCase().includes(term)));
                if (!match) continue;
            }
            filtered.push(item);
        }

        return addingRow ? [addingRow, ...filtered] : filtered;
    }, [tableData, deferredSearchValue, selectedUser, selectedLaboratory, selectedRubro, selectedPosition]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { isAllSelected, isSomeSelected } = useMemo(() => {
        if (selectedIds.size === 0 || filteredItems.length === 0) {
            return { isAllSelected: false, isSomeSelected: false };
        }
        let selectedInFiltered = 0;
        for (let i = 0; i < filteredItems.length; i++) {
            if (selectedIds.has(filteredItems[i].id)) {
                selectedInFiltered++;
            }
        }
        return {
            isAllSelected: selectedInFiltered > 0 && selectedInFiltered === filteredItems.length,
            isSomeSelected: selectedInFiltered > 0 && selectedInFiltered < filteredItems.length,
        };
    }, [selectedIds, filteredItems]);

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(item => item.id)));
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const [deletedHistory, setDeletedHistory] = useState<ProductExpirationItem[][]>([]);

    const handleInlineQuantityChange = useCallback(async (rowId: string, newQty: number) => {
        const validatedQty = Math.max(1, newQty);
        setTableData(prev => prev.map(r => r.id === rowId ? { ...r, quantity: validatedQty } : r));
        if (effectiveSessionId) {
            try {
                await updatePreCountItem(rowId, { quantity: validatedQty });
            } catch (err) {
                console.warn("Error actualizando cantidad:", err);
            }
        }
    }, [effectiveSessionId]);

    const handleInlineSectorChange = useCallback(async (rowId: string, newSector: string) => {
        setTableData(prev => prev.map(r => r.id === rowId ? { ...r, position: newSector, sector: newSector } : r));
        if (effectiveSessionId) {
            try {
                await updatePreCountItem(rowId, { location_tag: newSector });
            } catch (err) {
                console.warn("Error actualizando sector:", err);
            }
        }
    }, [effectiveSessionId]);

    const handleDeleteSelected = useCallback(async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        const toDelete = tableData.filter(item => selectedIds.has(item.id));
        const idsToDelete = toDelete.map(t => t.id);

        setDeletedHistory(prev => [...prev, toDelete]);
        setTableData(prev => prev.filter(item => !selectedIds.has(item.id)));
        setSelectedIds(new Set());

        if (effectiveSessionId) {
            try {
                await deletePreCountItems(idsToDelete);

                try {
                    const { emitDeviceTelemetry } = await import('@/services/deviceTelemetry');
                    emitDeviceTelemetry({
                        sessionId: effectiveSessionId,
                        currentLocation: isBranchMode ? activeSector : null,
                    });
                } catch (telemErr) {
                    console.debug('[PreCountProductsView] Error emitiendo telemetría post-delete:', telemErr);
                }
            } catch (err) {
                console.warn("Error eliminando items:", err);
            }
        }

        window.dispatchEvent(new CustomEvent('precount:item_deleted', { detail: { count, ids: idsToDelete } }));

        toast.success(
            count === 1 ? "Producto eliminado" : `${count} productos eliminados`,
            count === 1
                ? `${toDelete[0]?.productName || "El producto"} ha sido quitado de la tabla`
                : `Se han quitado ${count} productos seleccionados de la tabla`
        );
    }, [selectedIds, tableData, effectiveSessionId]);

    const handleRestoreDeleted = useCallback(async () => {
        if (deletedHistory.length === 0) {
            toast.info("No hay productos para recuperar");
            return;
        }

        const lastDeleted = deletedHistory[deletedHistory.length - 1];
        setTableData(prev => [...lastDeleted, ...prev]);
        setDeletedHistory(prev => prev.slice(0, -1));

        if (effectiveSessionId) {
            try {
                for (const item of lastDeleted) {
                    await upsertPreCountItem({
                        session_id: effectiveSessionId,
                        ean: item.ean,
                        product_name: item.productName,
                        quantity: item.quantity,
                        laboratory: item.laboratory,
                        rubro: item.rubro,
                        location_tag: item.sector || item.position,
                    });
                }
            } catch (err) {
                console.warn("Error restaurando items en Dexie:", err);
            }
        }

        window.dispatchEvent(new CustomEvent('precount:item_added'));

        toast.success(
            "Productos recuperados",
            `Se han restaurado ${lastDeleted.length} producto${lastDeleted.length > 1 ? "s" : ""} a la tabla`
        );
    }, [deletedHistory, effectiveSessionId]);

    // Suma del total inventariado y recuento de registros agrupado por EAN en un solo recorrido O(N)
    const { totalCountedByEan, rowCountByEan } = useMemo(() => {
        const totals = new Map<string, number>();
        const counts = new Map<string, number>();
        for (let i = 0; i < tableData.length; i++) {
            const row = tableData[i];
            if (!row.isAdding && row.ean) {
                const key = row.ean.trim().toLowerCase();
                totals.set(key, (totals.get(key) || 0) + (Number(row.quantity) || 0));
                counts.set(key, (counts.get(key) || 0) + 1);
            }
        }
        return { totalCountedByEan: totals, rowCountByEan: counts };
    }, [tableData]);

    const columns = useMemo<TableColumn<ProductExpirationItem>[]>(
        () => [
            {
                key: "select",
                header: (
                    <div className="flex items-center justify-center w-full">
                        <FluidCheckbox
                            checked={isAllSelected}
                            indeterminate={isSomeSelected}
                            onToggle={toggleSelectAll}
                            aria-label="Seleccionar todos los productos"
                        />
                    </div>
                ),
                sortable: false,
                width: "44px",
                align: "center",
                colSpan: (row) => (row.id === addingRowId && addingStep === "ean") ? 2 : 1,
                cell: (row) => {
                    if (row.id === addingRowId) {
                        if (addingStep === "ean") {
                            return (
                                <div className="flex items-center w-full pr-2" onClick={(e) => e.stopPropagation()}>
                                    <InputGroup className="w-full h-8 rounded-lg border border-border bg-transparent hover:bg-hover transition-all duration-80 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)] shadow-none">
                                        <InputGroupAddon className="pl-2.5 pr-1.5 text-muted-foreground">
                                            <Search className="size-3.5 shrink-0" />
                                        </InputGroupAddon>
                                        <InputGroupInput
                                            ref={eanInputRef}
                                            placeholder="Ingresar EAN o descripción…"
                                            value={newEan}
                                            onChange={(e) => {
                                                if (isBranchMode && !currentActiveSector) {
                                                    toast.warning("Sector requerido", "Debes abrir un sector para comenzar a cargar productos.");
                                                    onOpenSectorModal?.();
                                                    return;
                                                }
                                                handleEanChange(e.target.value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (isBranchMode && !currentActiveSector) {
                                                    if (e.key === "Enter" || (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey)) {
                                                        e.preventDefault();
                                                        toast.warning("Sector requerido", "Debes abrir un sector para comenzar a cargar productos.");
                                                        onOpenSectorModal?.();
                                                        return;
                                                    }
                                                }
                                                const list = candidateProductsRef.current;
                                                const len = list.length;
                                                if (e.key === "ArrowDown") {
                                                    e.preventDefault();
                                                    if (len > 0) {
                                                        setSelectedCandidateIndex(prev => (prev < len - 1 ? prev + 1 : 0));
                                                    }
                                                } else if (e.key === "ArrowUp") {
                                                    e.preventDefault();
                                                    if (len > 0) {
                                                        setSelectedCandidateIndex(prev => (prev > 0 ? prev - 1 : len - 1));
                                                    }
                                                } else if (e.key === "Enter" || e.key === "Tab") {
                                                    e.preventDefault();
                                                    const currIdx = selectedCandidateIndexRef.current;
                                                    if (len > 0 && currIdx >= 0 && currIdx < len) {
                                                        handleSelectCandidate(list[currIdx]);
                                                    } else {
                                                        handleConfirmEan();
                                                    }
                                                } else if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    if (len > 0) {
                                                        setCandidateProducts([]);
                                                    } else {
                                                        handleCancelAddProduct();
                                                    }
                                                }
                                            }}
                                            className="h-full text-xs font-sans pr-2 placeholder:text-muted-foreground tabular-nums"
                                        />
                                    </InputGroup>
                                </div>
                            );
                        }
                        return (
                            <div className="flex items-center justify-center w-full opacity-40 pointer-events-none">
                                <FluidCheckbox checked={false} onToggle={() => {}} aria-label="Nuevo producto" />
                            </div>
                        );
                    }
                    const isChecked = selectedIds.has(row.id);
                    return (
                        <div className="flex items-center justify-center w-full" onClick={(e) => e.stopPropagation()}>
                            <FluidCheckbox
                                checked={isChecked}
                                onToggle={() => toggleSelectRow(row.id)}
                                aria-label={`Seleccionar ${row.productName}`}
                            />
                        </div>
                    );
                },
            },
            {
                key: "ean",
                header: "Código EAN",
                sortable: true,
                width: "145px",
                cell: (row) => {
                    if (row.id === addingRowId) {
                        return (
                            <span
                                className="font-semibold text-primary text-xs tabular-nums cursor-pointer hover:underline"
                                onClick={() => {
                                    setAddingStep("ean");
                                    setTimeout(() => eanInputRef.current?.focus(), 50);
                                }}
                                title="Clic para re-editar EAN"
                            >
                                {row.ean || newEan || "–"}
                            </span>
                        );
                    }
                    return (
                        <span className="font-medium text-muted-foreground text-xs truncate tabular-nums">
                            {row.ean}
                        </span>
                    );
                },
            },
            {
                key: "productName",
                header: "Producto",
                sortable: true,
                width: "280px",
                cell: (row) => {
                    if (row.id === addingRowId) {
                        if (addingStep === "ean") {
                            const activeProduct = candidateProducts[selectedCandidateIndex] || candidateProducts[0];
                            const currentProductName = activeProduct?.name || (newEan.length >= 3 ? `Producto SKU-${newEan}` : "Seleccionar o escribir producto…");

                            return (
                                <div className="relative flex items-center w-full min-w-0" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 min-w-0 py-0.5">
                                        <span className="font-semibold text-foreground text-xs truncate">
                                            {currentProductName}
                                        </span>
                                    </div>

                                    {/* Dropdown de sugerencias con diseño y colores fluidos, ancho amplio y tipografía Inter pura */}
                                    {candidateProducts.length > 0 && (
                                        <div 
                                            ref={candidateDropdownRef}
                                            className="absolute top-full left-0 mt-1.5 z-[120] w-[580px] max-w-[calc(100vw-3rem)]"
                                        >
                                            <Elevated
                                                offset={2}
                                                shadowLevel={3}
                                                className="w-full rounded-xl border border-border/70 overflow-hidden flex flex-col font-sans select-none"
                                            >
                                                <div 
                                                    ref={candidateListRef}
                                                    className="w-full max-h-[300px] overflow-y-auto overflow-x-hidden p-1 flex flex-col gap-0.5 custom-scrollbar"
                                                >
                                                    {candidateProducts.map((cand, i) => {
                                                        const isSelected = selectedCandidateIndex === i;
                                                        return (
                                                            <div
                                                                key={`${cand.ean}-${i}`}
                                                                role="option"
                                                                aria-selected={isSelected}
                                                                onClick={() => handleSelectCandidate(cand)}
                                                                onMouseEnter={() => setSelectedCandidateIndex(i)}
                                                                className={cn(
                                                                    "flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg text-left cursor-pointer transition-colors duration-100",
                                                                    isSelected
                                                                        ? "bg-active text-foreground"
                                                                        : "hover:bg-hover text-foreground/90"
                                                                )}
                                                            >
                                                                {/* Columna Izquierda: Información de producto (Inter) */}
                                                                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                                                                    <span 
                                                                        className="font-sans text-xs font-semibold text-foreground truncate leading-tight tracking-tight"
                                                                        title={cand.name}
                                                                    >
                                                                        {cand.name}
                                                                    </span>
                                                                    {cand.isNewOption ? (
                                                                        <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-primary font-sans font-medium">
                                                                            <span>Nuevo producto a registrar</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground font-sans">
                                                                            <span className="truncate max-w-[240px]" title={cand.lab || "Sin laboratorio"}>
                                                                                {cand.lab || "Sin laboratorio"}
                                                                            </span>
                                                                            {cand.rubro && (
                                                                                <>
                                                                                    <span className="text-muted-foreground/40 shrink-0">·</span>
                                                                                    <span className="truncate max-w-[160px] text-muted-foreground/80">
                                                                                        {cand.rubro}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Columna Derecha: Código EAN (Inter tabular-nums) y slot fijo de selección */}
                                                                <div className="flex items-center gap-2 shrink-0 self-center">
                                                                    <span className={cn(
                                                                        "font-sans text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-md border transition-colors",
                                                                        isSelected
                                                                            ? "bg-surface-1 dark:bg-surface-2 text-foreground border-border/80 shadow-xs"
                                                                            : "bg-surface-2 dark:bg-surface-3 text-muted-foreground border-border/40"
                                                                    )}>
                                                                        {cand.ean}
                                                                    </span>

                                                                    {/* Slot fijo de 16px para que todos los EANs queden estrictamente alineados en vertical */}
                                                                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                                                        {isSelected && (
                                                                            <Check className="size-3.5 text-primary stroke-[2.5]" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Elevated>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <span className="font-semibold text-foreground text-xs truncate">
                                {row.productName || "Producto nuevo"}
                            </span>
                        );
                    }
                    return (
                        <span className="font-semibold text-foreground text-xs truncate">
                            {row.productName}
                        </span>
                    );
                },
            },
            {
                key: "laboratory",
                header: "Laboratorio",
                sortable: true,
                width: "110px",
                cell: (row) => (
                    <span className="font-medium text-muted-foreground text-xs truncate">
                        {row.laboratory || "–"}
                    </span>
                ),
            },
            {
                key: "rubro",
                header: "Rubro",
                sortable: true,
                width: "95px",
                cell: (row) => {
                    if (row.id === addingRowId && !row.rubro) {
                        return (
                            <span className="text-muted-foreground/40 text-xs font-medium tabular-nums">
                                –
                            </span>
                        );
                    }
                    return (
                        <span className="font-medium text-muted-foreground text-xs truncate">
                            {row.rubro || "–"}
                        </span>
                    );
                },
            },
            {
                key: "sector",
                header: "Sector",
                sortable: true,
                width: isEditing ? "120px" : "105px",
                sortValue: (row) => row.sector || row.position || "–",
                cell: (row) => {
                    const sectorVal = row.sector || row.position || "–";
                    if (isEditing) {
                        return (
                            <div className="flex items-center my-0.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={sectorVal === "–" ? "" : sectorVal}
                                    placeholder="Sector"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleInlineSectorChange(row.id, val);
                                    }}
                                    className="h-6 w-full max-w-[105px] px-1.5 font-sans text-xs rounded border border-border bg-background/90 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                            </div>
                        );
                    }
                    if (row.id === addingRowId && isBranchMode && (!currentActiveSector || sectorVal === "–")) {
                        return (
                            <span
                                className="font-medium text-xs text-muted-foreground/60 cursor-pointer hover:text-foreground hover:underline truncate"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSectorModal?.();
                                }}
                                title="Hacé clic para abrir un sector"
                            >
                                Sin sector
                            </span>
                        );
                    }
                    return (
                        <span className="font-medium text-muted-foreground text-xs truncate">
                            {sectorVal}
                        </span>
                    );
                },
            },
            {
                key: "quantity",
                header: "Cantidad",
                sortable: true,
                width: isEditing ? "130px" : (addingRowId ? "115px" : "90px"),
                sortValue: (row) => row.quantity,
                cell: (row) => {
                    if (row.id === addingRowId) {
                        if (addingStep === "quantity") {
                            return (
                                <div className="flex items-center justify-start w-full" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        ref={quantityInputRef}
                                        type="number"
                                        min="1"
                                        value={newQuantity}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "") {
                                                setNewQuantity("");
                                                return;
                                            }
                                            const parsed = parseInt(val, 10);
                                            if (isNaN(parsed) || parsed < 1) {
                                                setNewQuantity("");
                                                return;
                                            }
                                            setNewQuantity(parsed);
                                        }}
                                        onBlur={() => {
                                            if (newQuantity === "" || Number(newQuantity) < 1) {
                                                setNewQuantity(1);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleCommitNewProduct();
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                handleCancelAddProduct();
                                            }
                                        }}
                                        className="h-8 w-16 text-center font-sans text-xs font-semibold rounded-lg border border-border bg-transparent hover:bg-hover focus:ring-1 focus:ring-[color:var(--focus-ring,#6B97FF)] focus:outline-none tabular-nums shadow-none"
                                    />
                                </div>
                            );
                        }
                        return (
                            <span className="text-muted-foreground/40 text-xs font-medium tabular-nums">
                                –
                            </span>
                        );
                    }

                    const eanKey = row.ean?.trim().toLowerCase() || "";
                    const hasMultipleEntries = (rowCountByEan.get(eanKey) || 0) > 1;
                    const totalCounted = totalCountedByEan.get(eanKey) ?? row.quantity;
                    const lotesData = row.lotesData;
                    const showMultiLotes = Boolean(visibleColumns?.includes("lotes") && lotesData && lotesData.length > 1);

                    if (isEditing) {
                        if (showMultiLotes && lotesData) {
                            return (
                                <div className="flex items-center justify-start gap-1 font-sans text-xs tabular-nums text-foreground my-0.5" onClick={(e) => e.stopPropagation()}>
                                    {lotesData.map((item, idx) => (
                                        <Fragment key={idx}>
                                            {idx > 0 && <span className="text-muted-foreground/40 font-normal select-none">/</span>}
                                            <DragStepper
                                                size="compact"
                                                value={item.cantidad}
                                                min={1}
                                                max={99999}
                                                onChange={(val) => {
                                                    const nextLotes = (row.lotesData || []).map((ld, i) => i === idx ? { ...ld, cantidad: val } : ld);
                                                    const total = nextLotes.reduce((acc, ld) => acc + ld.cantidad, 0);
                                                    handleInlineQuantityChange(row.id, total);
                                                }}
                                            />
                                        </Fragment>
                                    ))}
                                </div>
                            );
                        }
                        if (isBranchMode || !hasMultipleEntries) {
                            return (
                                <div className="flex items-center justify-start my-0.5" onClick={(e) => e.stopPropagation()}>
                                    <DragStepper
                                        size="compact"
                                        value={row.quantity}
                                        min={1}
                                        max={99999}
                                        onChange={(val) => handleInlineQuantityChange(row.id, val)}
                                    />
                                </div>
                            );
                        }
                        return (
                            <div className="flex items-center justify-start gap-1 my-0.5" onClick={(e) => e.stopPropagation()}>
                                <DragStepper
                                    size="compact"
                                    value={row.quantity}
                                    min={1}
                                    max={99999}
                                    onChange={(val) => handleInlineQuantityChange(row.id, val)}
                                />
                                <span className="text-muted-foreground/40 font-normal select-none text-xs">/</span>
                                <span className="font-medium text-muted-foreground text-xs tabular-nums">{totalCounted}</span>
                            </div>
                        );
                    }

                    if (showMultiLotes && lotesData) {
                        return (
                            <div className="flex items-center justify-start gap-1 font-sans text-xs tabular-nums text-foreground my-0.5">
                                {lotesData.map((item, idx) => {
                                    const isHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.loteName === item.lote || (hoveredBatch?.status && hoveredBatch?.status === item.status));
                                    const isOtherHovered = hoveredBatch?.rowId === row.id && !isHovered;
                                    return (
                                        <Fragment key={idx}>
                                            {idx > 0 && <span className="text-muted-foreground/40 font-normal select-none">/</span>}
                                            <Tooltip content={`Cantidad Lote ${item.lote}: ${item.cantidad} un.`} side="top">
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

                    if (isBranchMode || !hasMultipleEntries) {
                        return (
                            <span className="font-semibold text-foreground text-xs tabular-nums">
                                {row.quantity}
                            </span>
                        );
                    }

                    return (
                        <div className="flex items-center justify-start gap-1 font-sans text-xs tabular-nums">
                            <span className="font-semibold text-foreground">{row.quantity}</span>
                            <span className="text-muted-foreground/40 font-normal select-none">/</span>
                            <span className="font-medium text-muted-foreground">{totalCounted}</span>
                        </div>
                    );
                },
            },
            {
                key: "systemDiff",
                header: "Sist / Dif",
                sortable: true,
                width: "105px",
                sortValue: (row) => {
                    const eanKey = row.ean?.trim().toLowerCase() || "";
                    const sysStock = row.systemStock !== undefined && row.systemStock !== null
                        ? row.systemStock 
                        : catalogStockMapRef.current.get(eanKey);
                    const total = totalCountedByEan.get(eanKey) ?? row.quantity;
                    return sysStock !== undefined && sysStock !== null ? (total - sysStock) : -999999;
                },
                cell: (row) => {
                    if (row.id === addingRowId) {
                        return (
                            <span className="text-muted-foreground/40 text-xs font-medium tabular-nums">
                                –
                            </span>
                        );
                    }

                    const eanKey = row.ean?.trim().toLowerCase() || "";
                    const sysStock = row.systemStock !== undefined && row.systemStock !== null
                        ? row.systemStock 
                        : catalogStockMapRef.current.get(eanKey);

                    if (sysStock !== undefined && sysStock !== null) {
                        const total = totalCountedByEan.get(eanKey) ?? row.quantity;
                        const diff = total - sysStock;
                        const hasMultipleEntries = (rowCountByEan.get(eanKey) || 0) > 1;

                        // Si coincide exacto (diff === 0) y no hay múltiples entradas repartidas, mostrar solo el stock limpio sin división ni badge
                        if (diff === 0 && !hasMultipleEntries) {
                            return (
                                <span className="font-semibold text-foreground text-xs tabular-nums">
                                    {sysStock}
                                </span>
                            );
                        }

                        const diffColor: BadgeColor = diff < 0 ? "rose" : diff > 0 ? "green" : "gray";
                        const diffText = diff > 0 ? `+${diff}` : `${diff}`;

                        return (
                            <div className="flex items-center justify-start gap-1.5 font-sans text-xs tabular-nums">
                                <span className="font-semibold text-foreground">{sysStock}</span>
                                <span className="text-muted-foreground/40 font-normal select-none">/</span>
                                <Badge
                                    color={diffColor}
                                    size="compact"
                                    className="h-5 px-1.5 font-semibold text-[11px] tabular-nums"
                                >
                                    {diffText}
                                </Badge>
                            </div>
                        );
                    }

                    return (
                        <span className="text-muted-foreground/40 text-xs font-medium tabular-nums">
                            –
                        </span>
                    );
                },
            },
            {
                key: "user",
                header: "Usuario",
                sortable: true,
                width: "115px",
                sortValue: (row) => row.user || "–",
                cell: (row) => (
                    <span className="font-medium text-muted-foreground text-xs truncate">
                        {row.user || "–"}
                    </span>
                ),
            },
            {
                key: "lotes",
                header: "Lotes",
                sortable: true,
                width: isEditing ? "140px" : "120px",
                align: "center",
                sortValue: (row) => (row.lotes ? row.lotes.join(", ") : "S/L"),
                cell: (row) => {
                    const lotesList: string[] = row.lotes || [];
                    if (isEditing && lotesList.length > 0) {
                        return (
                            <div className="flex flex-wrap items-center justify-center gap-1 w-full my-0.5" onClick={(e) => e.stopPropagation()}>
                                {lotesList.map((lote, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={lote}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTableData(prev => prev.map(r => {
                                                if (r.id !== row.id) return r;
                                                const nextLotes = (r.lotes || []).map((l, i) => i === idx ? val : l);
                                                const nextLotesData = (r.lotesData || []).map((ld, i) => i === idx ? { ...ld, lote: val } : ld);
                                                return { ...r, lotes: nextLotes, lotesData: nextLotesData };
                                            }));
                                        }}
                                        className="h-6 w-18 text-center font-sans text-xs rounded border border-border bg-background/90 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                    />
                                ))}
                            </div>
                        );
                    }
                    if (!lotesList || lotesList.length === 0) {
                        return (
                            <Badge
                                variant="dot"
                                showDot={false}
                                color="gray"
                                size="sm"
                                className="h-5 px-2 font-sans font-medium text-xs opacity-60"
                            >
                                S/L
                            </Badge>
                        );
                    }
                    const lotesData = row.lotesData;
                    return (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 w-full my-0.5">
                            {lotesList.map((lote, idx) => {
                                const loteItem = lotesData?.find((d) => d.lote === lote);
                                const loteStatus = loteItem?.status || "normal";
                                const isHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.loteName === lote || (hoveredBatch?.status && hoveredBatch?.status === loteStatus));
                                const isOtherHovered = hoveredBatch?.rowId === row.id && !isHovered;
                                return (
                                    <Tooltip key={idx} content={`Lote: ${lote}`} side="top">
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
                                                className="h-5 px-2 font-sans font-medium text-xs whitespace-nowrap transition-all"
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
                width: isEditing ? "100px" : "80px",
                align: "center",
                sortValue: (row) => row.lotesData?.[0]?.vencimiento || "S/V",
                cell: (row) => {
                    const lotesData = row.lotesData;
                    if (isEditing && lotesData && lotesData.length > 0) {
                        return (
                            <div className="flex flex-wrap items-center justify-center gap-1 w-full my-0.5" onClick={(e) => e.stopPropagation()}>
                                {lotesData.map((item, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={item.vencimiento}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTableData(prev => prev.map(r => {
                                                if (r.id !== row.id) return r;
                                                const nextLotes = (r.lotesData || []).map((ld, i) => i === idx ? { ...ld, vencimiento: val } : ld);
                                                return { ...r, lotesData: nextLotes };
                                            }));
                                        }}
                                        className="h-6 w-14 text-center font-sans text-xs rounded border border-border bg-background/90 text-foreground focus:ring-1 focus:ring-primary focus:outline-none tabular-nums"
                                    />
                                ))}
                            </div>
                        );
                    }
                    if (lotesData && lotesData.length > 0) {
                        return (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 w-full my-0.5">
                                {lotesData.map((item, idx) => {
                                    const isHovered = hoveredBatch?.rowId === row.id && (hoveredBatch?.loteName === item.lote || (hoveredBatch?.status && hoveredBatch?.status === item.status));
                                    const isOtherHovered = hoveredBatch?.rowId === row.id && !isHovered;
                                    return (
                                        <Tooltip key={idx} content={`Lote ${item.lote} — Vto: ${item.vencimiento}`} side="top">
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
                                                    className="h-5 px-2 font-sans font-medium text-xs whitespace-nowrap transition-all"
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
                    return (
                        <Badge
                            variant="dot"
                            showDot={false}
                            color="gray"
                            size="sm"
                            className="h-5 px-2 font-sans font-medium text-xs whitespace-nowrap"
                        >
                            S/V
                        </Badge>
                    );
                },
            },
            {
                key: "alerta",
                header: "Alerta",
                sortable: true,
                width: "75px",
                align: "center",
                cell: (row) => {
                    let critical = 0;
                    let warning = 0;
                    let normal = 0;
                    if (row.lotesData && row.lotesData.length > 0) {
                        row.lotesData.forEach((item) => {
                            if (item.status === "critical") critical++;
                            else if (item.status === "warning") warning++;
                            else normal++;
                        });
                    }

                    const hasCritical = critical > 0;
                    const hasWarning = warning > 0;

                    if (!hasCritical && !hasWarning) {
                        return (
                            <span className="inline-flex items-center gap-1">
                                <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                                <span className="text-foreground font-medium text-xs">{normal || 1}</span>
                            </span>
                        );
                    }

                    return (
                        <div className="flex items-center justify-center gap-2 font-sans text-xs">
                            {hasCritical && (
                                <span className="inline-flex items-center gap-1">
                                    <AlertCircle className="size-3.5 text-red-500 shrink-0" />
                                    <span className="text-foreground font-medium text-xs">{critical}</span>
                                </span>
                            )}
                            {hasWarning && (
                                <span className="inline-flex items-center gap-1">
                                    <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                                    <span className="text-foreground font-medium text-xs">{warning}</span>
                                </span>
                            )}
                        </div>
                    );
                },
            }
        ],
        [hoveredBatch, isEditing, isBranchMode, totalCountedByEan, rowCountByEan, selectedIds, isAllSelected, isSomeSelected, visibleColumns, addingRowId, addingStep, newEan, newQuantity, candidateProducts, selectedCandidateIndex, handleInlineSectorChange, handleInlineQuantityChange]
    );

    const [catalogLabs, setCatalogLabs] = useState<string[]>([]);
    const [catalogRubros, setCatalogRubros] = useState<string[]>([]);

    useEffect(() => {
        const loadCatalogFilters = async () => {
            if (!effectiveSessionId) return;
            try {
                const prods = await db.precount_products.where('session_id').equals(effectiveSessionId).toArray();
                const labs = new Set<string>();
                const rubs = new Set<string>();
                prods.forEach(p => {
                    if (p.laboratory && p.laboratory.trim() && p.laboratory !== '_CONFIG_') labs.add(p.laboratory.trim());
                    if (p.rubro && p.rubro.trim()) rubs.add(p.rubro.trim());
                });

                if (labs.size === 0) {
                    const sess = await db.sessions.get(effectiveSessionId);
                    if (sess?.master_catalog) {
                        sess.master_catalog.forEach((p: any) => {
                            if (p.laboratory && p.laboratory.trim()) labs.add(p.laboratory.trim());
                            if (p.rubro && p.rubro.trim()) rubs.add(p.rubro.trim());
                        });
                    }
                }

                setCatalogLabs(Array.from(labs).sort());
                setCatalogRubros(Array.from(rubs).sort());
            } catch (err) {
                console.error("Error cargando filtros del catálogo:", err);
            }
        };
        loadCatalogFilters();
    }, [effectiveSessionId]);

    // Opciones de filtros computadas en un único recorrido O(N)
    const { availableUsers, availableLaboratories, availableRubros, availableSectors } = useMemo(() => {
        const userSet = new Set<string>();
        const labSet = new Set<string>(catalogLabs);
        const rubroSet = new Set<string>(catalogRubros);
        const sectorSet = new Set<string>();
        if (currentActiveSector) sectorSet.add(currentActiveSector);

        for (let i = 0; i < tableData.length; i++) {
            const item = tableData[i];
            if (item.isAdding) continue;
            if (item.user) userSet.add(item.user);
            if (item.laboratory) labSet.add(item.laboratory);
            if (item.rubro) rubroSet.add(item.rubro);
            const s = item.sector || item.position;
            if (s && s !== '–') sectorSet.add(s);
        }

        return {
            availableUsers: Array.from(userSet).sort(),
            availableLaboratories: Array.from(labSet).sort(),
            availableRubros: Array.from(rubroSet).sort(),
            availableSectors: Array.from(sectorSet).sort(),
        };
    }, [tableData, catalogLabs, catalogRubros, currentActiveSector]);

    const displayedColumns = useMemo(() => {
        if (!visibleColumns || visibleColumns.length === 0) return columns;
        return columns.filter(col => col.key === "select" || visibleColumns.includes(col.key));
    }, [columns, visibleColumns]);

    return (
        <div className={cn("w-full flex-1 flex flex-col min-h-0", className)}>
            {/* Contenedor exterior estilo Fluid: 2px de padding, bordes redondeados y sombra sutil */}
            <div className="w-full flex-1 flex flex-col min-h-0 bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
                {/* Recuadro interior blanco/más claro que alberga la tabla */}
                <div className="w-full flex-1 flex flex-col min-h-0 bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-2 sm:p-3 shadow-xs overflow-hidden">
                    
                    {/* Barra de controles: Buscador + 4 Selects a la izquierda, y Acciones a la derecha */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <InputGroup className="w-[160px] h-8 rounded-lg border border-border bg-transparent hover:bg-hover transition-all duration-80 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)] shadow-none shrink-0">
                                <InputGroupAddon className="pl-2.5 pr-1.5 text-muted-foreground">
                                    <Search className="size-3.5 shrink-0" />
                                </InputGroupAddon>
                                <InputGroupInput
                                    placeholder="Buscar…"
                                    value={searchValue}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    className="h-full text-xs font-sans pr-2 placeholder:text-muted-foreground"
                                />
                                {searchValue && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchValue("")}
                                        className="pr-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        <X className="size-3 shrink-0" />
                                    </button>
                                )}
                            </InputGroup>

                            {!isBranchMode && (
                                <div className="w-[140px]">
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger placeholder="Usuario" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg" />
                                        <SelectContent className="max-h-[220px]">
                                            <SelectItem index={0} value="all" className="font-sans text-xs">Todos los usuarios</SelectItem>
                                            {availableUsers.map((u, i) => (
                                                <SelectItem key={u} index={i + 1} value={u} className="font-sans text-xs">{u}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="w-[140px]">
                                <Select value={selectedLaboratory} onValueChange={setSelectedLaboratory}>
                                    <SelectTrigger placeholder="Laboratorio" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todos los laboratorios</SelectItem>
                                        {availableLaboratories.map((lab, i) => (
                                            <SelectItem key={lab} index={i + 1} value={lab} className="font-sans text-xs">{lab}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-[140px]">
                                <Select value={selectedRubro} onValueChange={setSelectedRubro}>
                                    <SelectTrigger placeholder="Rubro" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todos los rubros</SelectItem>
                                        {availableRubros.map((rub, i) => (
                                            <SelectItem key={rub} index={i + 1} value={rub} className="font-sans text-xs">{rub}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-[140px]">
                                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                                    <SelectTrigger placeholder="Sector" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todos los sectores</SelectItem>
                                        {availableSectors.map((sec, i) => (
                                            <SelectItem key={sec} index={i + 1} value={sec} className="font-sans text-xs">{sec}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-auto">
                            <Switch
                                label="Editar"
                                checked={isEditing}
                                onToggle={handleToggleEditing}
                            />
                            {typeof actions === "function" ? actions({
                                selectedCount: selectedIds.size,
                                selectedIds,
                                onDeleteSelected: handleDeleteSelected,
                                canRestore: deletedHistory.length > 0,
                                onRestoreDeleted: handleRestoreDeleted,
                            }) : actions}
                        </div>
                    </div>

                    <div className="flex-1 w-full overflow-hidden min-h-0">
                        <Table
                            data={filteredItems}
                            columns={displayedColumns}
                            getRowId={(row) => row.id}
                            resizable
                            reorderable
                            defaultSort={null}
                            height="100%"
                            rowHeight={40}
                            dense={true}
                            overscan={8}
                            headerClassName="bg-white dark:bg-[#252525] dark:bg-surface-3 shadow-2xs"
                            emptyState={
                                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5">
                                    <span className="font-semibold text-foreground text-sm">
                                        {searchValue ? "No se encontraron productos coincidentes" : "No hay productos registrados en esta sesión"}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {searchValue 
                                            ? "Probá ajustando la búsqueda o los filtros seleccionados." 
                                            : "Hacé clic en el botón agregar (+) o escaneá un código de barras para comenzar."}
                                    </span>
                                </div>
                            }
                            className="rounded-xl border-none w-full bg-transparent"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

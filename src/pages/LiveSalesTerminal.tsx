import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Zap, Sparkles, Sliders, Grid, Radio, Database, CheckCircle2, AlertCircle, Activity, Eye, EyeOff } from 'lucide-react';
import { OFFICIAL_71_BRANCHES } from '@/lib/branchNetworkMap';
import { executeMysqlRawQuery, isTauriEnvironment } from '@/services/mysqlTauriBridge';

// Paleta de 5 colores exactos del proyecto original (Gitmos / GMUNK)
// Ordenados de izquierda a derecha: Verde -> Violeta -> Lila -> Rojo -> Naranja
const GITMOS_COLOR_ZONES = [
    // 1. Verde (izquierda)
    { color: '#02e8b6', glow: 'rgba(2, 232, 182, 0.35)', sec: '#a7f3d0' },
    // 2. Violeta (centro-izquierda)
    { color: '#a465d7', glow: 'rgba(164, 101, 215, 0.35)', sec: '#e9d5ff' },
    // 3. Lila (centro)
    { color: '#f036bd', glow: 'rgba(240, 54, 189, 0.35)', sec: '#fbcfe8' },
    // 4. Rojo (centro-derecha)
    { color: '#fd4b85', glow: 'rgba(253, 75, 133, 0.35)', sec: '#fecdd3' },
    // 5. Naranja (derecha)
    { color: '#ff7350', glow: 'rgba(255, 115, 80, 0.35)', sec: '#fed7aa' },
];

export interface BranchChannel {
    id: string;
    name: string;
    branchId: number;
    code: string;
    color: string;
    glowColor: string;
    secondaryColor: string;
    activityLevel: number;
    primaryIp?: string;
}

// Las 71 sucursales oficiales de Farmaplus con colores asignados por ZONA cromática
const ALL_69_BRANCHES: BranchChannel[] = (() => {
    const list: BranchChannel[] = [];
    const totalBranches = OFFICIAL_71_BRANCHES.length;
    const numZones = GITMOS_COLOR_ZONES.length;

    OFFICIAL_71_BRANCHES.forEach((info, idx) => {
        const zoneIndex = Math.min(
            Math.floor(idx / Math.ceil(totalBranches / numZones)),
            numZones - 1
        );
        const palette = GITMOS_COLOR_ZONES[zoneIndex];

        const activitySeed = (info.branchId * 37) % 100 / 100;
        const activityLevel = 0.3 + activitySeed * 0.7;

        list.push({
            id: `suc_${info.branchId}`,
            branchId: info.branchId,
            name: info.name,
            code: info.code,
            color: palette.color,
            glowColor: palette.glow,
            secondaryColor: palette.sec,
            activityLevel,
            primaryIp: info.primaryIp,
        });
    });

    return list;
})();

export interface TicketProductItem {
    name?: string;
    quantity: number;
    price?: number;
}

export type OperationType = 'POS_SALE' | 'APP_ORDER' | 'RETURN_REFUND';

export const OPERATION_STYLES: Record<OperationType, { color?: string; glow?: string; label: string; badge: string }> = {
    POS_SALE: { 
        label: 'Venta', 
        badge: 'bg-zinc-800 border-zinc-700 text-zinc-300' 
    },
    APP_ORDER: { 
        color: '#00f0ff', 
        glow: 'rgba(0, 240, 255, 0.55)', 
        label: 'Pedido App / Web', 
        badge: 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300' 
    },
    RETURN_REFUND: { 
        color: '#fb923c', 
        glow: 'rgba(251, 146, 60, 0.50)', 
        label: 'Devolución / NC', 
        badge: 'bg-amber-950/80 border-amber-500/50 text-amber-300' 
    },
};

interface StreamLine {
    y: number;
    intensity: number;
    alpha: number;
    height: number;
}

interface SaleCluster {
    id: number;
    branchIndex: number;
    y: number;
    lineCount: number;
    totalHeight: number;
    isMajorBlock: boolean;
    alpha: number;
    speed: number;
    streamLines: StreamLine[];
    ticketId?: string | number;
    clientName?: string;
    totalAmount?: number;
    opType?: OperationType;
    color?: string;
    glowColor?: string;
}

export default function LiveSalesTerminal() {
    const [currentPage, setCurrentPage] = useState<1 | 2>(1);
    const [autoRotate, setAutoRotate] = useState<boolean>(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
    const [density, setDensity] = useState<number>(2.4);
    const [glowPower, setGlowPower] = useState<number>(1.0);
    const [lateralFlarePower, setLateralFlarePower] = useState<number>(0.6);
    const [showControls, setShowControls] = useState(true);
    const [showRuleOfThirds, setShowRuleOfThirds] = useState(true);
    const [eventCount, setEventCount] = useState<number>(0);

    // Conexión real a 1 sucursal para pruebas
    const [liveBranchId, setLiveBranchId] = useState<number>(4); // Default: Retiro II (S04)
    const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
    const [liveStatusText, setLiveStatusText] = useState<string>('Esperando...');    
    const [streamMode, setStreamMode] = useState<'live_only' | 'multi_live' | 'all_channels'>('multi_live'); // Default: Multi-sucursal en vivo
    const [showControlsBar, setShowControlsBar] = useState<boolean>(false); // Oculto por defecto para vista limpia
    const [showDataStream, setShowDataStream] = useState<boolean>(false); // Oculto por defecto para máxima fluidez a 60 FPS

    // Atajo de teclado: Tecla 'H' para alternar barra de controles
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'h' || e.key === 'H') {
                setShowControlsBar(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    const [liveTicketsHistory, setLiveTicketsHistory] = useState<Array<{
        ticketId: number;
        branchName?: string;
        branchCode?: string;
        hora: string;
        total: number;
        cliente: string;
        items: Array<{ name: string; quantity: number; price: number }>;
        isMajor: boolean;
        opType?: OperationType;
    }>>([]);
    const [dailySummary, setDailySummary] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
    const [perfMetrics, setPerfMetrics] = useState<{ fps: number; frameTimeMs: number; pingMs: number; activeLines: number }>({
        fps: 60,
        frameTimeMs: 16.6,
        pingMs: 25,
        activeLines: 0,
    });

    const lastFrameTimestamp = useRef<number>(0);
    const frameTimesWindow = useRef<number[]>([]);
    const lastFpsUpdate = useRef<number>(0);

    const lastProcessedComprobante = useRef<number>(0);
    const lastProcessedByBranch = useRef<Map<number, number>>(new Map());
    const lastAppPedidoByBranch = useRef<Map<number, string>>(new Map());
    const lastStockIdByBranch = useRef<Map<number, number>>(new Map());
    const initialLoaded = useRef<boolean>(false);
    const pollBatchIndex = useRef<number>(0);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const clustersRef = useRef<SaleCluster[]>([]);
    const nextClusterId = useRef<number>(1);
    const lastSpawnTime = useRef<number>(0);

    // Lista completa de las 71 sucursales oficiales de Farmaplus con sus IPs reales
    const VERIFIED_BRANCHES = useMemo(() => {
        return OFFICIAL_71_BRANCHES.map(b => ({
            branchId: b.branchId,
            name: b.name,
            code: b.code,
            ip: b.primaryIp,
        }));
    }, []);

    // Dividir las 69 sucursales en 2 páginas (~35 por página)
    // y reasignar colores por POSICIÓN EN LA PÁGINA para que cada página
    // muestre las 5 zonas cromáticas Gitmos de izquierda a derecha
    const currentBranches = useMemo(() => {
        const midPoint = Math.ceil(ALL_69_BRANCHES.length / 2);
        const pageBranches = currentPage === 1 
            ? ALL_69_BRANCHES.slice(0, midPoint) 
            : ALL_69_BRANCHES.slice(midPoint);

        const numZones = GITMOS_COLOR_ZONES.length;
        const groupSize = Math.ceil(pageBranches.length / numZones);

        return pageBranches.map((branch, idx) => {
            const zoneIndex = Math.min(Math.floor(idx / groupSize), numZones - 1);
            const palette = GITMOS_COLOR_ZONES[zoneIndex];
            return {
                ...branch,
                color: palette.color,
                glowColor: palette.glow,
                secondaryColor: palette.sec,
            };
        });
    }, [currentPage]);

    // Auto rotación opcional
    useEffect(() => {
        if (!autoRotate) return;
        const interval = setInterval(() => {
            setCurrentPage(prev => (prev === 1 ? 2 : 1));
        }, 12000);
        return () => clearInterval(interval);
    }, [autoRotate]);

    // Limpiar al cambiar de página
    useEffect(() => {
        clustersRef.current = [];
    }, [currentPage]);

    // Función universal para generar tickets con la regla exacta de grosores
    const spawnTicket = (
        targetBranchId: number, 
        items: TicketProductItem[], 
        meta?: { 
            ticketId?: number | string; 
            clientName?: string; 
            totalAmount?: number;
            opType?: OperationType;
        },
        startY?: number
    ) => {
        // Encontrar índice en la página actual
        const branchIdx = currentBranches.findIndex(b => b.branchId === targetBranchId);
        if (branchIdx === -1) return; // La sucursal está en la otra página

        if (clustersRef.current.length > 200) {
            clustersRef.current.splice(0, 40);
        }

        const canvas = canvasRef.current;
        const baseHeight = canvas ? canvas.height : 700;
        const spawnY = startY !== undefined ? startY : (baseHeight - 65);

        const streamLines: StreamLine[] = [];
        let currentY = 0;

        items.forEach((item) => {
            let lineHeight = 1.2;
            let intensity = 0.45;

            if (item.quantity >= 4) {
                lineHeight = 3.8 + Math.min(1.0, (item.quantity - 4) * 0.15);
                intensity = 0.95;
            } else if (item.quantity >= 2) {
                lineHeight = 2.4;
                intensity = 0.72;
            }

            const spacing = 3.0 + Math.random() * 1.2;
            streamLines.push({
                y: currentY,
                intensity,
                alpha: 0.85,
                height: lineHeight,
            });

            currentY += lineHeight + spacing;
        });

        const totalHeight = Math.max(3.0, currentY - 2.5);
        const isMajorBlock = items.length >= 3 || (meta?.totalAmount ? meta.totalAmount > 45000 : false);
        const opType = meta?.opType || 'POS_SALE';

        const cluster: SaleCluster = {
            id: nextClusterId.current++,
            branchIndex: branchIdx,
            y: spawnY,
            lineCount: items.length,
            totalHeight,
            isMajorBlock,
            alpha: 1.0,
            speed: (1.1 + Math.random() * 1.3) * speedMultiplier,
            streamLines,
            ticketId: meta?.ticketId,
            clientName: meta?.clientName,
            totalAmount: meta?.totalAmount,
            opType,
        };

        // Inserción directa en ref sin provocar re-renders de React
        clustersRef.current.push(cluster);
    };

    // Generador procedural de apoyo (solo activo en modo 'all_channels')
    const spawnCluster = (forceBranchIndex?: number, forceMajorBlock: boolean = false, startY?: number) => {
        const numBranches = currentBranches.length;
        if (numBranches === 0) return;

        const branchIdx = forceBranchIndex !== undefined 
            ? forceBranchIndex 
            : Math.floor(Math.random() * numBranches);

        const targetBranch = currentBranches[branchIdx];
        if (!targetBranch) return;

        const roll = Math.random();
        let itemsCount = 1;

        if (forceMajorBlock || roll < 0.10) {
            itemsCount = Math.floor(4 + Math.random() * 10);
        } else if (roll < 0.35) {
            itemsCount = Math.floor(2 + Math.random() * 3);
        } else {
            itemsCount = 1;
        }

        const items: TicketProductItem[] = [];
        for (let i = 0; i < itemsCount; i++) {
            const qRoll = Math.random();
            let quantity = 1;
            if (qRoll < 0.20) quantity = Math.floor(4 + Math.random() * 4);
            else if (qRoll < 0.50) quantity = Math.floor(2 + Math.random() * 2);
            else quantity = 1;

            items.push({ quantity });
        }

        spawnTicket(targetBranch.branchId, items, undefined, startY);
    };

    // Polling en vivo ultra-optimizado de MySQL
    useEffect(() => {
        let isCancelled = false;
        initialLoaded.current = false;
        lastProcessedComprobante.current = 0;

        if (!isTauriEnvironment()) {
            setIsLiveConnected(false);
            setLiveStatusText('Simulación (Web)');
            return;
        }

        const fetchLiveSales = async () => {
            if (isCancelled) return;

            if (streamMode === 'multi_live') {
                // ==========================================
                // MODO RED GLOBAL: Round-Robin Ultra Fluido (24 por tick)
                // ==========================================
                setIsLiveConnected(true);
                setLiveStatusText(`Red en Vivo (${VERIFIED_BRANCHES.length} Sucursales)`);

                const batchSize = 24;
                const total = VERIFIED_BRANCHES.length;
                const startIdx = (pollBatchIndex.current * batchSize) % total;
                const currentBatch = VERIFIED_BRANCHES.slice(startIdx, startIdx + batchSize);
                if (currentBatch.length < batchSize) {
                    currentBatch.push(...VERIFIED_BRANCHES.slice(0, batchSize - currentBatch.length));
                }
                pollBatchIndex.current = (pollBatchIndex.current + 1) % Math.ceil(total / batchSize);

                let batchNewTickets = 0;
                let batchNewTotal = 0;
                const responsivePings: number[] = [];
                const newHistoryTickets: Array<{
                    ticketId: number;
                    branchName?: string;
                    branchCode?: string;
                    hora: string;
                    total: number;
                    cliente: string;
                    items: Array<{ name: string; quantity: number; price: number }>;
                    isMajor: boolean;
                    opType?: OperationType;
                }> = [];

                const promises = currentBatch.map(async (branch) => {
                    const mysqlConfig = {
                        host: branch.ip,
                        port: 3306,
                        user: 'root',
                        password: 'm@st3rpl3x0nz3',
                        database: 'plex',
                    };

                    const lastId = lastProcessedByBranch.current.get(branch.branchId) || 0;
                    
                    try {
                        const query = `
                            SELECT 
                                fc.IDComprobante,
                                fc.Sucursal,
                                fc.Hora,
                                IFNULL(fc.TotalComprobante, 0) as total,
                                IFNULL(fc.CliApeNom, 'Consumidor Final') as cliente,
                                fl.IDProducto,
                                fl.Cantidad,
                                IFNULL(fl.Total, 0) as item_total,
                                IFNULL(fl.Detalle, 'Producto') as prod_nombre,
                                IFNULL(fc.Tipo, 'FA') as tipo_comp,
                                IFNULL(fc.TotalCobertura, 0) as total_cobertura
                            FROM factcabecera fc
                            JOIN factlineas fl ON fl.IDComprobante = fc.IDComprobante
                            WHERE fc.Emision = CURDATE()
                              ${lastId > 0 ? `AND fc.IDComprobante > ${lastId}` : ''}
                            ORDER BY fc.IDComprobante DESC, fl.Orden ASC
                            LIMIT ${lastId === 0 ? 10 : 20}
                        `;

                        const queryStartTime = performance.now();
                        const res = await executeMysqlRawQuery(mysqlConfig, query, 30);
                        const queryDuration = Math.round(performance.now() - queryStartTime);
                        if (res && res.rows) {
                            responsivePings.push(queryDuration);
                        }

                        if (!res || !res.rows || res.rows.length === 0) return;

                        // Agrupar filas
                        const tMap = new Map<number, {
                            ticketId: number;
                            sucursal: number;
                            hora: string;
                            total: number;
                            cliente: string;
                            opType: OperationType;
                            items: Array<{ name: string; quantity: number; price: number }>;
                        }>();

                        res.rows.forEach(r => {
                            const id = Number(r[0]);
                            const sucursal = Number(r[1]) || branch.branchId;
                            const hora = String(r[2] || '');
                            const total = Number(r[3] || 0);
                            const cliente = String(r[4] || 'Consumidor Final');
                            const cantidad = Number(r[6] || 1);
                            const itemTotal = Number(r[7] || 0);
                            const prodName = String(r[8] || 'Producto');
                            const tipoComp = String(r[9] || 'FA').trim().toUpperCase();
                            const totalCob = Number(r[10] || 0);

                            let opType: OperationType = 'POS_SALE';
                            if (tipoComp === 'NC' || prodName.toUpperCase().includes('DEVOLUCION')) {
                                opType = 'RETURN_REFUND';
                            }

                            if (!tMap.has(id)) {
                                tMap.set(id, { ticketId: id, sucursal, hora, total, cliente, opType, items: [] });
                            }
                            tMap.get(id)!.items.push({ name: prodName, quantity: cantidad, price: itemTotal });
                        });

                        const tList = Array.from(tMap.values()).reverse();
                        const maxId = Math.max(...Array.from(tMap.keys()));
                        
                        if (lastId === 0) {
                            lastProcessedByBranch.current.set(branch.branchId, maxId);
                            tList.slice(-2).forEach(t => {
                                spawnTicket(branch.branchId, t.items, {
                                    ticketId: t.ticketId,
                                    clientName: t.cliente,
                                    totalAmount: t.total,
                                    opType: t.opType,
                                });
                                newHistoryTickets.push({
                                    ticketId: t.ticketId,
                                    branchName: branch.name,
                                    branchCode: branch.code,
                                    hora: t.hora,
                                    total: t.total,
                                    cliente: t.cliente,
                                    items: t.items,
                                    isMajor: t.items.length >= 3,
                                    opType: t.opType,
                                });
                            });
                        } else {
                            tList.forEach(t => {
                                if (t.ticketId > lastId) {
                                    spawnTicket(branch.branchId, t.items, {
                                        ticketId: t.ticketId,
                                        clientName: t.cliente,
                                        totalAmount: t.total,
                                        opType: t.opType,
                                    });
                                    batchNewTickets += 1;
                                    batchNewTotal += t.total;
                                    newHistoryTickets.push({
                                        ticketId: t.ticketId,
                                        branchName: branch.name,
                                        branchCode: branch.code,
                                        hora: t.hora,
                                        total: t.total,
                                        cliente: t.cliente,
                                        items: t.items,
                                        isMajor: t.items.length >= 3,
                                        opType: t.opType,
                                    });
                                }
                            });
                            lastProcessedByBranch.current.set(branch.branchId, Math.max(lastId, maxId));
                        }

                        // Consultar nuevos pedidos de App Móvil / E-commerce
                        try {
                            const appQuery = `
                                SELECT IDPedido, cli_nombre, tipoentrega, IFNULL(Importe, 0)
                                FROM apppedidos
                                WHERE DATE(Fecha) = CURDATE()
                                ORDER BY IDPedido DESC
                                LIMIT 3
                            `;
                            const appRes = await executeMysqlRawQuery(mysqlConfig, appQuery, 5);
                            if (appRes && appRes.rows && appRes.rows.length > 0) {
                                const latestApp = appRes.rows[0];
                                const latestAppId = String(latestApp[0]);
                                const lastSavedAppId = lastAppPedidoByBranch.current.get(branch.branchId);

                                if (lastSavedAppId && latestAppId !== lastSavedAppId) {
                                    const appName = String(latestApp[1] || 'Cliente Web');
                                    const appTipo = String(latestApp[2] || 'R') === 'R' ? 'Retiro' : 'Envío';
                                    const appImp = Number(latestApp[3] || 0);

                                    spawnTicket(branch.branchId, [{ name: `Pedido App (${appTipo})`, quantity: 2, price: appImp }], {
                                        ticketId: latestAppId,
                                        clientName: appName,
                                        totalAmount: appImp,
                                        opType: 'APP_ORDER',
                                    });

                                    newHistoryTickets.push({
                                        ticketId: 0,
                                        branchName: branch.name,
                                        branchCode: branch.code,
                                        hora: new Date().toLocaleTimeString('es-AR'),
                                        total: appImp,
                                        cliente: `📱 APP: ${appName}`,
                                        items: [{ name: `Pedido Digital (${appTipo})`, quantity: 1, price: appImp }],
                                        isMajor: false,
                                        opType: 'APP_ORDER',
                                    });
                                }
                                lastAppPedidoByBranch.current.set(branch.branchId, latestAppId);
                            }
                        } catch (e) {
                            // Ignorar error en apppedidos si no está habilitado
                        }

                        // Consultar movimientos de Altas/Bajas de Stock (Recepciones / Ajustes no-venta)
                        try {
                            const lastStockId = lastStockIdByBranch.current.get(branch.branchId) || 0;
                            const stockQuery = `
                                SELECT 
                                    sm.IDMovimiento,
                                    IFNULL(sm.Referencia, 'Ajuste Stock') as ref_str,
                                    ABS(IFNULL(sm.Cantidad, 1)) as cant,
                                    CONCAT(IFNULL(p.Producto, 'Producto'), ' ', IFNULL(p.Presentacion, '')) as prod_desc
                                FROM stockmovimientos sm
                                LEFT JOIN productos p ON p.IDProducto = sm.IDProducto
                                WHERE sm.Fecha = CURDATE()
                                  AND sm.TipoMovimiento != 'F'
                                  ${lastStockId > 0 ? `AND sm.IDMovimiento > ${lastStockId}` : ''}
                                ORDER BY sm.IDMovimiento DESC
                                LIMIT 25
                            `;
                            const stockRes = await executeMysqlRawQuery(mysqlConfig, stockQuery, 25);
                            if (stockRes && stockRes.rows && stockRes.rows.length > 0) {
                                const maxStockId = Math.max(...stockRes.rows.map(r => Number(r[0])));
                                
                                if (lastStockId === 0) {
                                    lastStockIdByBranch.current.set(branch.branchId, maxStockId);
                                } else {
                                    // Agrupar por Referencia de movimiento (ej. remito o lote)
                                    const stockMap = new Map<string, Array<{ name: string; quantity: number; price: number }>>();
                                    stockRes.rows.forEach(r => {
                                        const movId = Number(r[0]);
                                        if (movId > lastStockId) {
                                            const refStr = String(r[1] || 'Movimiento Stock');
                                            const cant = Math.max(1, Number(r[2] || 1));
                                            const desc = String(r[3] || 'Producto');

                                            if (!stockMap.has(refStr)) stockMap.set(refStr, []);
                                            stockMap.get(refStr)!.push({ name: desc, quantity: cant, price: 0 });
                                        }
                                    });

                                    stockMap.forEach((stockItems, refStr) => {
                                        spawnTicket(branch.branchId, stockItems, {
                                            ticketId: `STK-${maxStockId}`,
                                            clientName: `📦 ${refStr}`,
                                            totalAmount: 0,
                                            opType: 'POS_SALE', // Usa el color del carril de la sucursal
                                        });

                                        newHistoryTickets.push({
                                            ticketId: maxStockId,
                                            branchName: branch.name,
                                            branchCode: branch.code,
                                            hora: new Date().toLocaleTimeString('es-AR'),
                                            total: 0,
                                            cliente: `📦 STOCK: ${refStr}`,
                                            items: stockItems,
                                            isMajor: stockItems.length >= 3,
                                            opType: 'POS_SALE',
                                        });
                                    });

                                    lastStockIdByBranch.current.set(branch.branchId, maxStockId);
                                }
                            }
                        } catch (e) {
                            // Ignorar error de stock
                        }

                    } catch (e) {
                        // Offline o timeout ignorado en silencio
                    }
                });

                await Promise.allSettled(promises);
                if (responsivePings.length > 0) {
                    const avgPing = Math.round(responsivePings.reduce((a, b) => a + b, 0) / responsivePings.length);
                    setPerfMetrics(prev => ({ ...prev, pingMs: avgPing }));
                }

                if (newHistoryTickets.length > 0) {
                    setLiveTicketsHistory(prev => [...newHistoryTickets.reverse(), ...prev].slice(0, 35));
                }

                if (batchNewTickets > 0) {
                    setDailySummary(prev => ({
                        count: prev.count + batchNewTickets,
                        total: prev.total + batchNewTotal,
                    }));
                }

            } else {
                // ==========================================
                // MODO SUCURSAL ÚNICA
                // ==========================================
                const selectedBranch = ALL_69_BRANCHES.find(b => b.branchId === liveBranchId);
                if (!selectedBranch || !selectedBranch.primaryIp) {
                    setIsLiveConnected(false);
                    setLiveStatusText('Sin IP');
                    return;
                }

                const mysqlConfig = {
                    host: selectedBranch.primaryIp,
                    port: 3306,
                    user: 'root',
                    password: 'm@st3rpl3x0nz3',
                    database: 'plex',
                };

                try {
                    // 1. Resumen del día
                    const countQuery = `
                        SELECT COUNT(*), IFNULL(SUM(TotalComprobante), 0)
                        FROM factcabecera
                        WHERE Emision = CURDATE()
                    `;
                    const countRes = await executeMysqlRawQuery(mysqlConfig, countQuery, 1);
                    if (countRes && countRes.rows && countRes.rows.length > 0) {
                        setDailySummary({
                            count: Number(countRes.rows[0][0] || 0),
                            total: Number(countRes.rows[0][1] || 0),
                        });
                    }

                    // 2. Traer tickets detallados
                    const query = `
                        SELECT 
                            fc.IDComprobante,
                            fc.Sucursal,
                            fc.Hora,
                            IFNULL(fc.TotalComprobante, 0) as total,
                            IFNULL(fc.CliApeNom, 'Consumidor Final') as cliente,
                            fl.IDProducto,
                            fl.Cantidad,
                            IFNULL(fl.Total, 0) as item_total,
                            IFNULL(fl.Detalle, 'Producto') as prod_nombre,
                            IFNULL(fc.Tipo, 'FA') as tipo_comp,
                            IFNULL(fc.TotalCobertura, 0) as total_cobertura
                        FROM factcabecera fc
                        JOIN factlineas fl ON fl.IDComprobante = fc.IDComprobante
                        WHERE fc.Emision = CURDATE()
                          ${lastProcessedComprobante.current > 0 ? `AND fc.IDComprobante > ${lastProcessedComprobante.current}` : ''}
                        ORDER BY fc.IDComprobante DESC, fl.Orden ASC
                        LIMIT 40
                    `;

                    const singleStartTime = performance.now();
                    const res = await executeMysqlRawQuery(mysqlConfig, query, 40);
                    const singlePing = Math.round(performance.now() - singleStartTime);
                    if (isCancelled) return;

                    if (res && res.rows && res.rows.length > 0) {
                        setPerfMetrics(prev => ({ ...prev, pingMs: singlePing }));
                        setIsLiveConnected(true);
                        setLiveStatusText(`En Vivo (${selectedBranch.name})`);

                        const ticketsMap = new Map<number, { 
                            ticketId: number; 
                            sucursal: number; 
                            hora: string; 
                            total: number; 
                            cliente: string; 
                            opType: OperationType;
                            items: Array<{ name: string; quantity: number; price: number }>;
                        }>();

                        res.rows.forEach(r => {
                            const id = Number(r[0]);
                            const sucursal = Number(r[1]) || selectedBranch.branchId;
                            const hora = String(r[2] || '');
                            const total = Number(r[3] || 0);
                            const cliente = String(r[4] || 'Consumidor Final');
                            const cantidad = Number(r[6] || 1);
                            const itemTotal = Number(r[7] || 0);
                            const prodName = String(r[8] || 'Producto');
                            const tipoComp = String(r[9] || 'FA').trim().toUpperCase();
                            const totalCob = Number(r[10] || 0);

                            let opType: OperationType = 'POS_SALE';
                            if (tipoComp === 'NC' || prodName.toUpperCase().includes('DEVOLUCION')) {
                                opType = 'RETURN_REFUND';
                            }

                            if (!ticketsMap.has(id)) {
                                ticketsMap.set(id, { ticketId: id, sucursal, hora, total, cliente, opType, items: [] });
                            }
                            ticketsMap.get(id)!.items.push({ name: prodName, quantity: cantidad, price: itemTotal });
                        });

                        const ticketsList = Array.from(ticketsMap.values()).reverse();

                        if (!initialLoaded.current) {
                            initialLoaded.current = true;
                            ticketsList.slice(-2).forEach((t) => {
                                spawnTicket(selectedBranch.branchId, t.items, { 
                                    ticketId: t.ticketId, 
                                    clientName: t.cliente, 
                                    totalAmount: t.total,
                                    opType: t.opType,
                                });
                            });

                            setLiveTicketsHistory(ticketsList.slice(-25).reverse().map(t => ({
                                ticketId: t.ticketId,
                                branchName: selectedBranch.name,
                                branchCode: selectedBranch.code,
                                hora: t.hora,
                                total: t.total,
                                cliente: t.cliente,
                                items: t.items,
                                isMajor: t.items.length >= 3,
                                opType: t.opType,
                            })));
                        } else {
                            ticketsList.forEach((t) => {
                                if (t.ticketId > lastProcessedComprobante.current) {
                                    spawnTicket(selectedBranch.branchId, t.items, { 
                                        ticketId: t.ticketId, 
                                        clientName: t.cliente, 
                                        totalAmount: t.total,
                                        opType: t.opType,
                                    });

                                    setLiveTicketsHistory(prev => [{
                                        ticketId: t.ticketId,
                                        branchName: selectedBranch.name,
                                        branchCode: selectedBranch.code,
                                        hora: t.hora,
                                        total: t.total,
                                        cliente: t.cliente,
                                        items: t.items,
                                        isMajor: t.items.length >= 3,
                                        opType: t.opType,
                                    }, ...prev.slice(0, 35)]);
                                }
                            });
                        }

                        const maxId = Math.max(...Array.from(ticketsMap.keys()));
                        if (maxId > lastProcessedComprobante.current) {
                            lastProcessedComprobante.current = maxId;
                        }

                        // Movimientos de Stock en modo sucursal única
                        try {
                            const lastStockId = lastStockIdByBranch.current.get(selectedBranch.branchId) || 0;
                            const stockQuery = `
                                SELECT 
                                    sm.IDMovimiento,
                                    IFNULL(sm.Referencia, 'Ajuste Stock') as ref_str,
                                    ABS(IFNULL(sm.Cantidad, 1)) as cant,
                                    CONCAT(IFNULL(p.Producto, 'Producto'), ' ', IFNULL(p.Presentacion, '')) as prod_desc
                                FROM stockmovimientos sm
                                LEFT JOIN productos p ON p.IDProducto = sm.IDProducto
                                WHERE sm.Fecha = CURDATE() 
                                  AND sm.TipoMovimiento != 'F'
                                  ${lastStockId > 0 ? `AND sm.IDMovimiento > ${lastStockId}` : ''}
                                ORDER BY sm.IDMovimiento DESC
                                LIMIT 25
                            `;
                            const stockRes = await executeMysqlRawQuery(mysqlConfig, stockQuery, 25);
                            if (stockRes && stockRes.rows && stockRes.rows.length > 0) {
                                const maxStockId = Math.max(...stockRes.rows.map(r => Number(r[0])));
                                if (lastStockId === 0) {
                                    lastStockIdByBranch.current.set(selectedBranch.branchId, maxStockId);
                                } else {
                                    const stockMap = new Map<string, Array<{ name: string; quantity: number; price: number }>>();
                                    stockRes.rows.forEach(r => {
                                        const movId = Number(r[0]);
                                        if (movId > lastStockId) {
                                            const refStr = String(r[1] || 'Movimiento Stock');
                                            const cant = Math.max(1, Number(r[2] || 1));
                                            const desc = String(r[3] || 'Producto');
                                            if (!stockMap.has(refStr)) stockMap.set(refStr, []);
                                            stockMap.get(refStr)!.push({ name: desc, quantity: cant, price: 0 });
                                        }
                                    });

                                    stockMap.forEach((stockItems, refStr) => {
                                        spawnTicket(selectedBranch.branchId, stockItems, {
                                            ticketId: `STK-${maxStockId}`,
                                            clientName: `📦 ${refStr}`,
                                            totalAmount: 0,
                                            opType: 'POS_SALE',
                                        });
                                    });
                                    lastStockIdByBranch.current.set(selectedBranch.branchId, maxStockId);
                                }
                            }
                        } catch (e) {
                            // Ignorar error
                        }
                    } else {
                        setIsLiveConnected(true);
                        setLiveStatusText(`Conectado (${selectedBranch.name})`);
                    }
                } catch (err: any) {
                    if (isCancelled) return;
                    setIsLiveConnected(false);
                    setLiveStatusText(`Reintentando (${selectedBranch.name})`);
                }
            }
        };

        fetchLiveSales();
        const pollInterval = setInterval(fetchLiveSales, streamMode === 'multi_live' ? 2500 : 2000);

        return () => {
            isCancelled = true;
            clearInterval(pollInterval);
        };
    }, [liveBranchId, currentBranches, streamMode, VERIFIED_BRANCHES]);

    // Render loop con DIFUMINACIÓN ULTRA-SUAVE Y OPACIDAD ETÉREA (Imagen 2 Gitmos)
    useEffect(() => {
        let animationFrameId: number;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const handleResize = () => {
            if (canvas) {
                const parent = canvas.parentElement;
                canvas.width = parent ? parent.clientWidth : window.innerWidth;
                canvas.height = parent ? parent.clientHeight : window.innerHeight;
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);

        const render = (time: number) => {
            if (!ctx || !canvas) return;

            const width = canvas.width;
            const height = canvas.height;
            const numBranches = currentBranches.length;
            const laneWidth = width / numBranches;
            const bottomBoundary = height - 60;
            const colMargin = 2.5;

            // Medición de Frame Time y FPS en tiempo real
            const now = performance.now();
            const deltaMs = lastFrameTimestamp.current > 0 ? (now - lastFrameTimestamp.current) : 16.6;
            lastFrameTimestamp.current = now;

            frameTimesWindow.current.push(deltaMs);
            if (frameTimesWindow.current.length > 25) frameTimesWindow.current.shift();

            if (now - lastFpsUpdate.current > 400) {
                const avgDelta = frameTimesWindow.current.reduce((a, b) => a + b, 0) / frameTimesWindow.current.length;
                const currentFps = Math.min(60, Math.round(1000 / Math.max(1, avgDelta)));
                setPerfMetrics(prev => ({
                    ...prev,
                    fps: currentFps,
                    frameTimeMs: Number(avgDelta.toFixed(1)),
                    activeLines: clustersRef.current.length,
                }));
                lastFpsUpdate.current = now;
            }

            // Normalización delta-time para fluidez perfecta y velocidad constante
            const normalizedDelta = Math.min(2.0, deltaMs / 16.666);

            // 1. Fondo Deep Space Void
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#03050d';
            ctx.fillRect(0, 0, width, height);

            // 2. Generación procedural continua (solo activa en modo 'all_channels')
            if (isPlaying && streamMode === 'all_channels' && (time - lastSpawnTime.current) > (150 / density)) {
                spawnCluster();
                if (Math.random() < 0.50) spawnCluster();
                if (Math.random() < 0.25) spawnCluster();
                lastSpawnTime.current = time;
            }

            // 3. Guías verticales tenues de carril
            for (let idx = 0; idx < numBranches; idx++) {
                const laneX = idx * laneWidth;
                const centerX = laneX + laneWidth / 2;

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, bottomBoundary);
                ctx.stroke();
            }

            // 4. Modo aditivo fotométrico de GPU (Lighter)
            ctx.globalCompositeOperation = 'lighter';

            // Parámetros de la zona focal áurea
            const focalCenterY = bottomBoundary * 0.45;
            const focalRadius = bottomBoundary * 0.38;

            // 5. Renderizado con difusión etérea y opacidades calibradas
            for (let i = clustersRef.current.length - 1; i >= 0; i--) {
                const cluster = clustersRef.current[i];

                if (isPlaying) {
                    cluster.y -= cluster.speed * speedMultiplier * normalizedDelta;
                }

                if (cluster.y < bottomBoundary * 0.16) {
                    cluster.alpha -= 0.045;
                }

                if (cluster.y <= 8 || cluster.alpha <= 0) {
                    clustersRef.current.splice(i, 1);
                    continue;
                }

                const branch = currentBranches[cluster.branchIndex];
                if (!branch) continue;

                // Color cromático del carril por defecto; sobrescrito solo para operaciones especiales (App y Devoluciones)
                const isSpecialOp = cluster.opType === 'APP_ORDER' || cluster.opType === 'RETURN_REFUND';
                const clusterColor = (isSpecialOp && cluster.opType && OPERATION_STYLES[cluster.opType]?.color) 
                    ? OPERATION_STYLES[cluster.opType].color! 
                    : (cluster.color || branch.color);
                const clusterGlow = (isSpecialOp && cluster.opType && OPERATION_STYLES[cluster.opType]?.glow) 
                    ? OPERATION_STYLES[cluster.opType].glow! 
                    : (cluster.glowColor || branch.glowColor);

                const laneX = cluster.branchIndex * laneWidth;
                const centerX = laneX + laneWidth / 2;
                const uniformWidth = laneWidth - colMargin * 2;
                const tickX = laneX + colMargin;

                const distToFocus = Math.abs(cluster.y - focalCenterY);
                const focusNormalized = Math.max(0, 1 - distToFocus / focalRadius);
                const fusionFactor = Math.pow(focusNormalized, 1.6);

                // A) SI ES UN BLOQUE / CLUSTER DESTACADO (IDÉNTICO A GITMOS IMAGEN 2 -> 3 -> 4)
                if (cluster.isMajorBlock) {
                    // FASE 1: Lejos del foco (focusNormalized < 0.25) -> Solo líneas separadas (Imagen 2)
                    // FASE 2: Aproximación (0.25 <= focusNormalized < 0.65) -> Contenedor translúcido unificado (Imagen 3)
                    // FASE 3: Clímax focal (focusNormalized >= 0.65) -> Bloque incandescente unificado total + destello lateral (Imagen 4)

                    // 1. HAZ VERTICAL CENITAL (Se activa suavemente en Fase 2 y Fase 3)
                    if (focusNormalized > 0.25) {
                        const beamPhase = (focusNormalized - 0.25) / 0.75; // 0 a 1
                        const spotBeamTop = Math.min(cluster.y, 180 + beamPhase * 260);
                        const spotBeamBottom = Math.min(bottomBoundary - (cluster.y + cluster.totalHeight), 140 + beamPhase * 220);

                        const spotGrad = ctx.createLinearGradient(0, cluster.y - spotBeamTop, 0, cluster.y + cluster.totalHeight + spotBeamBottom);
                        spotGrad.addColorStop(0, 'rgba(0,0,0,0)');
                        spotGrad.addColorStop(0.28, clusterGlow.replace('0.35', `${0.08 * beamPhase * glowPower}`));
                        spotGrad.addColorStop(0.50, clusterGlow.replace('0.35', `${0.28 * beamPhase * glowPower}`));
                        spotGrad.addColorStop(0.72, clusterGlow.replace('0.35', `${0.08 * beamPhase * glowPower}`));
                        spotGrad.addColorStop(1, 'rgba(0,0,0,0)');

                        ctx.fillStyle = spotGrad;
                        ctx.globalAlpha = cluster.alpha * (0.3 + beamPhase * 0.6);
                        ctx.fillRect(tickX, cluster.y - spotBeamTop, uniformWidth, cluster.totalHeight + spotBeamTop + spotBeamBottom);
                    }

                    // 2. FASE 2: CONTENEDOR TRANSLÚCIDO UNIFICADO (Imagen 3 - Une las líneas antes del destello)
                    if (focusNormalized >= 0.25) {
                        const containerFactor = Math.min(1, (focusNormalized - 0.25) / 0.40); // 0 a 1 entre 0.25 y 0.65
                        
                        const containerGrad = ctx.createLinearGradient(0, cluster.y, 0, cluster.y + cluster.totalHeight);
                        containerGrad.addColorStop(0, clusterGlow.replace('0.35', `${0.15 * containerFactor}`));
                        containerGrad.addColorStop(0.5, clusterGlow.replace('0.35', `${0.45 * containerFactor}`));
                        containerGrad.addColorStop(1, clusterGlow.replace('0.35', `${0.15 * containerFactor}`));

                        ctx.fillStyle = containerGrad;
                        ctx.globalAlpha = cluster.alpha * (0.35 + containerFactor * 0.45);
                        ctx.fillRect(tickX, cluster.y, uniformWidth, cluster.totalHeight);
                    }

                    // 3. FASE 3: BANDA DE DESTELLO LATERAL RECTANGULAR (Imagen 4 - Ignición en el punto focal)
                    if (focusNormalized >= 0.60 && lateralFlarePower > 0.02) {
                        const flarePhase = (focusNormalized - 0.60) / 0.40; // 0 a 1 en el clímax
                        const bandY = cluster.y;
                        const bandHeight = cluster.totalHeight;
                        const flareSpreadX = (uniformWidth * 1.5 + flarePhase * 180) * lateralFlarePower;
                        const totalBandWidth = (uniformWidth / 2) + flareSpreadX;

                        const bandGrad = ctx.createLinearGradient(centerX - totalBandWidth, 0, centerX + totalBandWidth, 0);
                        bandGrad.addColorStop(0, 'rgba(0,0,0,0)');
                        bandGrad.addColorStop(0.20, clusterGlow.replace('0.35', `${0.08 * flarePhase * lateralFlarePower}`));
                        bandGrad.addColorStop(0.38, clusterGlow.replace('0.35', `${0.45 * flarePhase * lateralFlarePower}`));
                        bandGrad.addColorStop(0.48, `rgba(255, 255, 255, ${0.85 * flarePhase * lateralFlarePower})`);
                        bandGrad.addColorStop(0.50, `rgba(255, 255, 255, ${0.98 * flarePhase * cluster.alpha})`);
                        bandGrad.addColorStop(0.52, `rgba(255, 255, 255, ${0.85 * flarePhase * lateralFlarePower})`);
                        bandGrad.addColorStop(0.62, clusterGlow.replace('0.35', `${0.45 * flarePhase * lateralFlarePower}`));
                        bandGrad.addColorStop(0.80, clusterGlow.replace('0.35', `${0.08 * flarePhase * lateralFlarePower}`));
                        bandGrad.addColorStop(1, 'rgba(0,0,0,0)');

                        ctx.fillStyle = bandGrad;
                        ctx.globalAlpha = cluster.alpha * flarePhase;
                        ctx.fillRect(centerX - totalBandWidth, bandY, totalBandWidth * 2, bandHeight);
                    }

                    // 4. FASE 3: NÚCLEO INCANDESCENTE SÓLIDO UNIFICADO (Imagen 4 - Bloque blanco puro)
                    if (focusNormalized >= 0.65) {
                        const corePhase = (focusNormalized - 0.65) / 0.35; // 0 a 1
                        
                        const coreGrad = ctx.createLinearGradient(0, cluster.y - 2, 0, cluster.y + cluster.totalHeight + 2);
                        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
                        coreGrad.addColorStop(0.25, `rgba(255, 255, 255, ${0.95 * corePhase * cluster.alpha})`);
                        coreGrad.addColorStop(0.75, `rgba(255, 255, 255, ${0.95 * corePhase * cluster.alpha})`);
                        coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

                        ctx.fillStyle = coreGrad;
                        ctx.globalAlpha = cluster.alpha * corePhase * 0.95;
                        ctx.fillRect(tickX, cluster.y - 2, uniformWidth, cluster.totalHeight + 4);
                    }

                    // 5. LÍNEAS INDIVIDUALES (Se fusionan gradualmente en el bloque de luz blanco)
                    const lineVisibility = focusNormalized >= 0.75 
                        ? Math.max(0.15, 1 - (focusNormalized - 0.75) / 0.25 * 0.8) 
                        : 1.0;

                    cluster.streamLines.forEach(line => {
                        ctx.fillStyle = clusterColor;
                        ctx.globalAlpha = cluster.alpha * (0.75 + line.intensity * 0.25) * lineVisibility;
                        ctx.fillRect(tickX, cluster.y + line.y, uniformWidth, line.height);

                        // Núcleo blanco de línea visible solo antes de la ignición total
                        if (focusNormalized > 0.35 && focusNormalized < 0.75) {
                            ctx.fillStyle = '#ffffff';
                            ctx.globalAlpha = cluster.alpha * focusNormalized * 0.5 * line.intensity;
                            ctx.fillRect(tickX + 1, cluster.y + line.y, uniformWidth - 2, Math.max(0.6, line.height - 0.3));
                        }
                    });

                } else {
                    // B) FLUJO DE LÍNEAS CONTINUAS ESTÁNDAR (Siempre líneas discretas limpias)
                    cluster.streamLines.forEach(line => {
                        ctx.fillStyle = clusterColor;
                        ctx.globalAlpha = cluster.alpha * line.alpha * (0.6 + focusNormalized * 0.3);
                        ctx.fillRect(tickX, cluster.y + line.y, uniformWidth, line.height);

                        if (focusNormalized > 0.50 || line.intensity > 0.75) {
                            ctx.fillStyle = '#ffffff';
                            ctx.globalAlpha = cluster.alpha * (0.35 + focusNormalized * 0.45) * line.intensity;
                            ctx.fillRect(tickX + 1, cluster.y + line.y, uniformWidth - 2, Math.max(0.7, line.height - 0.4));
                        }
                    });
                }
            }

            // 6. LÍNEAS IMAGINARIAS DE REGLA DE TERCIOS (HUD Guide)
            if (showRuleOfThirds) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.save();
                
                const thirdX1 = width / 3;
                const thirdX2 = (width / 3) * 2;
                const thirdY1 = bottomBoundary / 3;
                const thirdY2 = (bottomBoundary / 3) * 2;

                ctx.strokeStyle = 'rgba(6, 182, 212, 0.16)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 6]);

                ctx.beginPath();
                ctx.moveTo(thirdX1, 0);
                ctx.lineTo(thirdX1, bottomBoundary);
                ctx.moveTo(thirdX2, 0);
                ctx.lineTo(thirdX2, bottomBoundary);
                ctx.moveTo(0, thirdY1);
                ctx.lineTo(width, thirdY1);
                ctx.moveTo(0, thirdY2);
                ctx.lineTo(width, thirdY2);
                ctx.stroke();

                ctx.setLineDash([]);
                const points = [
                    { x: thirdX1, y: thirdY1, label: 'T1' },
                    { x: thirdX2, y: thirdY1, label: 'T2' },
                    { x: thirdX1, y: thirdY2, label: 'T3' },
                    { x: thirdX2, y: thirdY2, label: 'T4' },
                ];

                points.forEach(p => {
                    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
                    ctx.beginPath();
                    ctx.moveTo(p.x - 8, p.y);
                    ctx.lineTo(p.x + 8, p.y);
                    ctx.moveTo(p.x, p.y - 8);
                                 ctx.font = "8px 'Inter', sans-serif";
                    ctx.fillStyle = 'rgba(6, 182, 212, 0.55)';
                    ctx.fillText(p.label, p.x + 8, p.y - 8);
                });

                ctx.restore();
            }

            // 7. Rótulos Inferiores de Sucursal
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;

            for (let idx = 0; idx < numBranches; idx++) {
                const b = currentBranches[idx];
                const laneX = idx * laneWidth;
                const centerX = laneX + laneWidth / 2;

                ctx.fillStyle = b.color;
                ctx.fillRect(centerX - 8, bottomBoundary + 2, 16, 2);

                ctx.font = "bold 9px 'Inter', sans-serif";
                ctx.fillStyle = b.color;
                ctx.textAlign = 'center';
                ctx.fillText(b.code, centerX, bottomBoundary + 14);

                ctx.save();
                ctx.translate(centerX, bottomBoundary + 22);
                ctx.rotate(-Math.PI / 4);
                ctx.font = "8px 'Inter', sans-serif";
                ctx.fillStyle = '#94a3b8';
                ctx.textAlign = 'right';
                const displayName = b.name.length > 15 ? b.name.slice(0, 14) + '..' : b.name;
                ctx.fillText(displayName, 0, 0);
                ctx.restore();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [isPlaying, speedMultiplier, density, glowPower, lateralFlarePower, currentBranches, showRuleOfThirds]);

    return (
        <div className="relative w-full h-[calc(100vh-56px)] bg-[#03050d] text-[#f4f4f5] font-sans overflow-hidden select-none flex flex-col">
            {/* Botón flotante para mostrar / ocultar controles del Terminal */}
            <div className="absolute top-3 right-4 z-40 flex items-center gap-2 pointer-events-auto">
                <button
                    onClick={() => setShowControlsBar(prev => !prev)}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/90 text-zinc-400 hover:text-white backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-medium shadow-xl"
                    title="Mostrar / Ocultar barra de controles (Atajo: Tecla H)"
                >
                    {showControlsBar ? <EyeOff size={13} className="text-cyan-400" /> : <Eye size={13} className="text-zinc-400" />}
                    <span>{showControlsBar ? 'Ocultar Controles' : 'Controles'}</span>
                </button>
            </div>

            {/* Header futurista minimalista estilo Gitmos (Ocultable) */}
            {showControlsBar && (
                <div className="absolute top-0 left-0 right-0 z-20 px-6 py-4 flex flex-wrap items-center justify-between gap-4 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200 pr-32">
                    <div className="flex items-center gap-3">
                        <span className="flex size-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_14px_#06b6d4]" />
                        <div className="flex flex-col">
                            <span className="text-xs tracking-[0.25em] font-bold text-white uppercase opacity-95">
                                Spectrogram Live Stream // Gitmos Engine
                            </span>
                            <span className="text-[10px] text-zinc-500 tracking-wider">
                                Ethereal Diffused Blocks & Subtle Lateral Flares
                            </span>
                        </div>
                    </div>

                    {/* Selector de Sucursal en Vivo & Estado */}
                    <div className="flex items-center gap-2 pointer-events-auto bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800 backdrop-blur-md">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/90 rounded-lg border border-zinc-800 text-[11px]">
                            <Database size={12} className={isLiveConnected ? "text-emerald-400 animate-pulse" : "text-amber-400"} />
                            <span className="text-zinc-400 font-semibold">SUCURSAL TEST:</span>
                            <select 
                                value={liveBranchId}
                                onChange={(e) => {
                                    setLiveBranchId(Number(e.target.value));
                                    lastProcessedComprobante.current = 0;
                                }}
                                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs max-w-[220px]"
                            >
                                {VERIFIED_BRANCHES.map(b => (
                                    <option key={b.branchId} value={b.branchId} className="bg-zinc-900 text-white">
                                        {b.code} - {b.name} ({b.ip})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
                            isLiveConnected 
                                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                        }`}>
                            <span className={`size-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                            <span>{liveStatusText}</span>
                        </span>
                    </div>

                    {/* Conmutador de Página 1 & Página 2 */}
                    <div className="flex items-center gap-2 pointer-events-auto bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 backdrop-blur-md">
                        <button
                            onClick={() => setCurrentPage(1)}
                            className={`px-3 py-1 text-xs rounded-lg font-bold transition flex items-center gap-1.5 ${
                                currentPage === 1 
                                    ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <span>PÁGINA 1 (SUC 01-36)</span>
                        </button>

                        <button
                            onClick={() => setCurrentPage(2)}
                            className={`px-3 py-1 text-xs rounded-lg font-bold transition flex items-center gap-1.5 ${
                                currentPage === 2 
                                    ? 'bg-purple-950 border border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]' 
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <span>PÁGINA 2 (SUC 37-71)</span>
                        </button>

                        <button
                            onClick={() => setAutoRotate(!autoRotate)}
                            title="Auto-rotar cada 12 segundos"
                            className={`px-2 py-1 text-[11px] rounded-lg border transition ${
                                autoRotate 
                                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {autoRotate ? 'AUTO ON' : 'AUTO OFF'}
                        </button>
                    </div>

                    {/* Selector de Modo: Multi-Sucursal vs Solo En Vivo vs Simulación */}
                    <div className="flex items-center gap-1 pointer-events-auto bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 backdrop-blur-md">
                        <button
                            onClick={() => setStreamMode('multi_live')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold transition flex items-center gap-1 ${
                                streamMode === 'multi_live'
                                    ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            <Radio size={12} className={streamMode === 'multi_live' ? 'text-emerald-400 animate-pulse' : ''} />
                            <span>🌐 RED EN VIVO ({VERIFIED_BRANCHES.length} SUC)</span>
                        </button>
                        <button
                            onClick={() => setStreamMode('live_only')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold transition flex items-center gap-1 ${
                                streamMode === 'live_only'
                                    ? 'bg-purple-950 border border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            <span>SÓLO {VERIFIED_BRANCHES.find(b => b.branchId === liveBranchId)?.code || 'S04'}</span>
                        </button>
                        <button
                            onClick={() => setStreamMode('all_channels')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold transition ${
                                streamMode === 'all_channels'
                                    ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            <span>SIMULACIÓN</span>
                        </button>
                    </div>

                    {/* Leyenda Visual Neón por Tipo de Operación */}
                    <div className="flex items-center gap-3 px-3 py-1 bg-zinc-950/80 rounded-xl border border-zinc-800 backdrop-blur-md text-[11px] pointer-events-auto shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                        <span className="flex items-center gap-1.5 text-zinc-300 font-semibold" title="Ventas normales en vivo con el color cromático de la sucursal">
                            <span className="size-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                            <span>Ventas en Vivo (Carril)</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-cyan-300 font-semibold" title="Pedidos digitales entrantes de la App / Web">
                            <span className="size-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
                            <span>App Móvil / Web</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-300 font-semibold" title="Devoluciones y Notas de Crédito">
                            <span className="size-2 rounded-full bg-[#fb923c] shadow-[0_0_8px_#fb923c]" />
                            <span>Devolución / NC</span>
                        </span>
                    </div>

                    {/* Métricas rápidas arriba a la derecha */}
                    <div className="flex items-center gap-4 text-xs pointer-events-auto">
                        <button
                            onClick={() => setShowDataStream(!showDataStream)}
                            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 text-xs font-bold ${
                                showDataStream 
                                    ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300' 
                                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            <Database size={13} />
                            <span>Data Stream ({dailySummary.count})</span>
                        </button>

                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-zinc-500 tracking-widest uppercase">
                                {streamMode === 'multi_live' ? 'VENTAS RED (EN VIVO)' : `VENTAS HOY (${VERIFIED_BRANCHES.find(b => b.branchId === liveBranchId)?.code || 'S04'})`}
                            </span>
                            <span className="text-emerald-400 font-bold text-sm tracking-wider">${dailySummary.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                        </div>

                        <button
                            onClick={() => setShowControls(!showControls)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition flex items-center gap-1.5 text-xs"
                        >
                            <Sliders size={13} />
                            <span>Ajustes</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Canvas Principal */}
            <div className="flex-1 w-full h-full relative cursor-crosshair">
                <canvas 
                    ref={canvasRef} 
                    className="w-full h-full block"
                    onClick={(e) => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        const colWidth = canvas.width / currentBranches.length;
                        const branchIdx = Math.min(currentBranches.length - 1, Math.max(0, Math.floor(clickX / colWidth)));
                        spawnCluster(branchIdx, true, clickY);
                    }}
                />
            </div>

            {/* HUD de Rendimiento en Vivo: FPS, Ping y Partículas */}
            <div className="absolute bottom-4 left-6 z-20 pointer-events-none flex items-center gap-3 px-3 py-1.5 rounded-xl bg-zinc-950/85 border border-zinc-800/80 backdrop-blur-md text-[11px] font-sans shadow-2xl">
                <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${perfMetrics.fps >= 55 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : perfMetrics.fps >= 40 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'}`} />
                    <span className="font-bold text-white">{perfMetrics.fps} FPS</span>
                    <span className="text-zinc-500 text-[10px]">({perfMetrics.frameTimeMs}ms)</span>
                </div>

                <span className="text-zinc-700">|</span>

                <div className="flex items-center gap-1.5">
                    <Zap size={11} className="text-cyan-400" />
                    <span className="text-zinc-400">LATENCIA:</span>
                    <span className="font-bold text-cyan-300">{perfMetrics.pingMs}ms</span>
                </div>

                <span className="text-zinc-700">|</span>

                <div className="flex items-center gap-1.5">
                    <Activity size={11} className="text-purple-400" />
                    <span className="text-zinc-400">LÍNEAS:</span>
                    <span className="font-bold text-purple-300">{perfMetrics.activeLines}</span>
                </div>

                <span className="text-zinc-700">|</span>

                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    perfMetrics.fps >= 55 ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300' : 'bg-amber-950 border border-amber-500/40 text-amber-300'
                }`}>
                    {perfMetrics.fps >= 55 ? 'GPU ÓPTIMA (60 FPS)' : 'CARGA MODERADA'}
                </span>
            </div>

            {/* Data Stream Live Telemetry Dashboard (Lateral Derecho - Estilo Gitmos) */}
            {showDataStream && (
                <div className="absolute top-20 right-6 z-30 w-80 max-h-[calc(100vh-160px)] flex flex-col rounded-xl bg-zinc-950/92 backdrop-blur-lg border border-zinc-800/90 shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="px-3.5 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                            <span className="text-[11px] font-bold tracking-wider text-white uppercase">
                                DATA STREAM // {ALL_69_BRANCHES.find(b => b.branchId === liveBranchId)?.name || 'RETIRO II'}
                            </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-sans">
                            {dailySummary.count} tickets hoy
                        </span>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
                        <div>
                            <span className="text-[10px] text-zinc-500 block uppercase">Facturación Hoy</span>
                            <span className="text-emerald-400 font-bold text-sm">
                                ${dailySummary.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-zinc-500 block uppercase">Modo Stream</span>
                            <span className="text-cyan-400 font-bold text-[11px]">
                                {streamMode === 'live_only' ? 'SOLO EN VIVO' : 'MULTICANAL'}
                            </span>
                        </div>
                    </div>

                    {/* Feed de tickets en vivo */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs scrollbar-thin scrollbar-thumb-zinc-800">
                        {liveTicketsHistory.length === 0 ? (
                            <div className="p-6 text-center text-zinc-600 text-xs">
                                Esperando tickets en vivo...
                            </div>
                        ) : (
                            liveTicketsHistory.map((ticket, idx) => (
                                <div 
                                    key={`${ticket.ticketId}_${idx}`}
                                    className={`p-2.5 rounded-lg border transition-all ${
                                        ticket.isMajor 
                                            ? 'bg-purple-950/25 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]' 
                                            : 'bg-zinc-900/60 border-zinc-800/70 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-[11px] mb-1">
                                        <div className="flex items-center gap-1.5">
                                             {ticket.branchCode && (
                                                <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-[9px] font-bold text-cyan-300">
                                                    {ticket.branchCode}
                                                </span>
                                            )}
                                            <span className="text-zinc-500">{ticket.hora}</span>
                                            <span className="font-bold text-white font-sans">#{ticket.ticketId}</span>
                                            {ticket.opType && ticket.opType !== 'POS_SALE' && (
                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${OPERATION_STYLES[ticket.opType].badge}`}>
                                                    {OPERATION_STYLES[ticket.opType].label}
                                                </span>
                                            )}
                                            {ticket.isMajor && (
                                                <span className="px-1.5 py-0.2 rounded bg-purple-900/60 border border-purple-500/50 text-[9px] font-bold text-purple-300">
                                                    CANASTA
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-bold text-emerald-400">
                                            ${ticket.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div className="text-[10px] text-zinc-400 truncate mb-1.5">
                                        {ticket.cliente}
                                    </div>

                                    {/* Lista de productos desglosados */}
                                    <div className="space-y-0.5 border-t border-zinc-800/60 pt-1.5">
                                        {ticket.items.map((it, iIdx) => (
                                            <div key={iIdx} className="flex items-center justify-between text-[10px] text-zinc-300">
                                                <span className="truncate pr-2 text-zinc-300">
                                                    <span className={`font-bold ${it.quantity >= 4 ? 'text-amber-300' : it.quantity >= 2 ? 'text-cyan-300' : 'text-zinc-400'}`}>
                                                        {it.quantity}x
                                                    </span>{' '}
                                                    {it.name || 'Producto'}
                                                </span>
                                                <span className="text-zinc-500 font-sans shrink-0">
                                                    ${it.price.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {showControls && (
                <div className="absolute bottom-20 right-6 z-30 w-72 p-4 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 shadow-2xl space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2 text-white font-semibold">
                            <Sparkles size={14} className="text-cyan-400" />
                            <span>Difuminación Etérea (Gitmos)</span>
                        </div>
                        <button 
                            onClick={() => spawnCluster(undefined, true)}
                            className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 transition text-[11px] font-bold flex items-center gap-1"
                        >
                            <Zap size={11} />
                            <span>Súper Cluster</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                            <span className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                                <Grid size={13} className="text-cyan-400" />
                                <span>Guías Regla de Tercios</span>
                            </span>
                            <button
                                onClick={() => setShowRuleOfThirds(!showRuleOfThirds)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                    showRuleOfThirds 
                                        ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300' 
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                                }`}
                            >
                                {showRuleOfThirds ? 'VISIBLE' : 'OCULTA'}
                            </button>
                        </div>

                        <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                                <span>Velocidad de Ascenso</span>
                                <span className="text-cyan-400 font-bold">{speedMultiplier.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.3" 
                                max="3.0" 
                                step="0.1"
                                value={speedMultiplier} 
                                onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                                <span>Densidad de Flujo Continuo</span>
                                <span className="text-purple-400 font-bold">{density.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="4.0" 
                                step="0.2"
                                value={density} 
                                onChange={(e) => setDensity(parseFloat(e.target.value))}
                                className="w-full accent-purple-400 bg-zinc-800 h-1.5 rounded cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                                <span>Potencia de Haz & Glow</span>
                                <span className="text-amber-400 font-bold">{glowPower.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="2.5" 
                                step="0.1"
                                value={glowPower} 
                                onChange={(e) => setGlowPower(parseFloat(e.target.value))}
                                className="w-full accent-amber-400 bg-zinc-800 h-1.5 rounded cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                                <span>Destello Lateral (Cauchy)</span>
                                <span className="text-rose-400 font-bold">{lateralFlarePower.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="2.0" 
                                step="0.1"
                                value={lateralFlarePower} 
                                onChange={(e) => setLateralFlarePower(parseFloat(e.target.value))}
                                className="w-full accent-rose-400 bg-zinc-800 h-1.5 rounded cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                isPlaying 
                                    ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800' 
                                    : 'bg-emerald-950 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900'
                            }`}
                        >
                            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                            <span>{isPlaying ? 'Pausar' : 'Reanudar'}</span>
                        </button>
                        <button
                            onClick={() => {
                                clustersRef.current = [];
                                setEventCount(0);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-2 left-6 z-20 text-[11px] text-zinc-600 tracking-wider pointer-events-none">
                [ Bloques Etéreos Semi-Translúcidos // Difuminación Suave en Y y en X // Calibrado con Gitmos ]
            </div>
        </div>
    );
}

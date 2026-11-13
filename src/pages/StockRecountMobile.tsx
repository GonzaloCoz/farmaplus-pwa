import React, { useState, useEffect, useMemo } from 'react';
import { 
    SlidersHorizontal, 
    Settings, 
    ClipboardCheck, 
    ChevronLeft, 
    ChevronRight, 
    Check, 
    MapPin, 
    Minus, 
    Plus
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { notify } from '@/lib/notifications';
import { getProductImageUrl } from '@/services/productImageService';
import { getRecountDifferences, getDeviceId, getDeviceName, getRecountSessionState, RecountProductDiff, RecountResultSubmission } from '@/services/preCountDB';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/services/db';

interface ProductItem {
    id: string;
    name: string;
    ean: string;
    eans?: string[];
    id_producto?: string;
    position: string;
    device: string;
    qty: number;
    initialQty: number;
    image: string;
    hasDifference?: boolean;
    systemStock?: number;
    totalCounted?: number;
}

export default function StockRecountMobile() {
    const [searchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'controlar' | 'diferencias' | 'todas'>('controlar');
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [secondsElapsed, setSecondsElapsed] = useState(15189); // ~ 04:13:09
    const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});
    const [currentProductIndex, setCurrentProductIndex] = useState(0);
    const [reloadTick, setReloadTick] = useState(0);
    const [operatorName, setOperatorName] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('recount_mobile_operator_name') || '';
        }
        return '';
    });
    const [nameInput, setNameInput] = useState<string>(operatorName);
    const [hasJoined, setHasJoined] = useState<boolean>(() => Boolean(operatorName.trim()));
    const [recountState, setRecountState] = useState<'idle' | 'waiting' | 'started'>('waiting');

    // Resolver ID de la sesión activa
    const effectiveSessionId = useMemo(() => {
        const fromParam = searchParams.get('sessionId') || searchParams.get('session_id');
        if (fromParam) return fromParam;
        if (typeof window !== 'undefined') {
            return localStorage.getItem('last_precount_session_id') || 
                   localStorage.getItem('precount_session_id') || 
                   sessionStorage.getItem('active_precount_session_id') || 
                   '';
        }
        return '';
    }, [searchParams]);

    const deviceId = useMemo(() => {
        try {
            return getDeviceId();
        } catch {
            return 'web-mobile-01';
        }
    }, []);

    const deviceDisplayName = useMemo(() => {
        if (operatorName && operatorName.trim()) return operatorName.trim();
        try {
            return getDeviceName() || 'Móvil Web';
        } catch {
            return 'Móvil Web';
        }
    }, [operatorName]);

    // Registrar presencia en DB + Realtime una vez que ingresó su nombre
    useEffect(() => {
        if (!effectiveSessionId || !hasJoined || !deviceDisplayName) return;

        const registerPresenceInDb = async () => {
            try {
                await (supabase as any).from('precount_connected_devices').upsert({
                    session_id: effectiveSessionId,
                    device_id: deviceId,
                    device_name: deviceDisplayName,
                    device_type: 'web',
                    device_model: 'Móvil Web',
                    status: 'online',
                    last_seen: new Date().toISOString()
                });
            } catch {}
        };

        const checkState = async () => {
            const st = await getRecountSessionState(effectiveSessionId);
            setRecountState(st);
            if (st === 'started') {
                setReloadTick(t => t + 1);
            }
        };

        registerPresenceInDb();
        checkState();

        const channel = supabase.channel(`recount_control_${effectiveSessionId}`, {
            config: { presence: { key: deviceId } }
        });

        channel
            .on('broadcast', { event: 'recount_assigned' }, () => {
                setRecountState('started');
                notify.info('¡Recuento iniciado!', 'Se asignaron tus productos únicos para controlar.');
                setReloadTick(t => t + 1);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        device_id: deviceId,
                        device_name: deviceDisplayName,
                        platform: 'web',
                        status: 'online',
                        last_seen: new Date().toISOString()
                    });
                }
            });

        const heartbeat = setInterval(async () => {
            registerPresenceInDb();
            const st = await getRecountSessionState(effectiveSessionId);
            setRecountState(prev => {
                if (prev !== 'started' && st === 'started') {
                    setReloadTick(t => t + 1);
                }
                return st;
            });
        }, 3000);

        return () => {
            clearInterval(heartbeat);
            supabase.removeChannel(channel);
        };
    }, [effectiveSessionId, hasJoined, deviceId, deviceDisplayName]);

    // Cargar datos reales de diferencias solo cuando el Admin haya iniciado el recuento
    useEffect(() => {
        let isMounted = true;
        async function loadRealData() {
            if (!hasJoined || recountState !== 'started') {
                if (isMounted) setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                let diffs: RecountProductDiff[] = [];

                // 1. Priorizar asignación exclusiva por dispositivo (recount_differences_<deviceId>.json)
                if (effectiveSessionId) {
                    try {
                        const { data: assignedData } = await (supabase as any)
                            .from('precount_device_files')
                            .select('content')
                            .eq('session_id', effectiveSessionId)
                            .eq('filename', `recount_differences_${deviceId}.json`)
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (assignedData && assignedData.length > 0 && assignedData[0].content) {
                            diffs = typeof assignedData[0].content === 'string'
                                ? JSON.parse(assignedData[0].content)
                                : assignedData[0].content;
                        }
                    } catch (e) {
                        console.warn('[StockRecountMobile] Error consultando asignación personalizada:', e);
                    }
                }

                // 2. Si no se encontró archivo individual, revisar recount_assignments.json por deviceId
                let hasAssignmentsManifest = false;
                if ((!diffs || diffs.length === 0) && effectiveSessionId) {
                    try {
                        const { data: manifestData } = await (supabase as any)
                            .from('precount_device_files')
                            .select('content')
                            .eq('session_id', effectiveSessionId)
                            .eq('filename', 'recount_assignments.json')
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (manifestData && manifestData.length > 0 && manifestData[0].content) {
                            hasAssignmentsManifest = true;
                            const parsedManifest = typeof manifestData[0].content === 'string'
                                ? JSON.parse(manifestData[0].content)
                                : manifestData[0].content;
                            const myAssignment = parsedManifest?.assignments?.[deviceId];
                            if (myAssignment && Array.isArray(myAssignment.items)) {
                                diffs = myAssignment.items;
                            }
                        }
                    } catch (e) {
                        console.warn('[StockRecountMobile] Error consultando recount_assignments.json:', e);
                    }
                }

                // 3. Fallback solo si NO existe un reparto personalizado activo
                if (!hasAssignmentsManifest && (!diffs || diffs.length === 0) && effectiveSessionId) {
                    try {
                        const { data } = await (supabase as any)
                            .from('precount_device_files')
                            .select('content')
                            .eq('session_id', effectiveSessionId)
                            .eq('filename', 'recount_differences.json')
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (data && data.length > 0 && data[0].content) {
                            diffs = typeof data[0].content === 'string' ? JSON.parse(data[0].content) : data[0].content;
                        }
                    } catch (e) {
                        console.warn('[StockRecountMobile] Error consultando recount_differences en Supabase:', e);
                    }
                }

                // 4. Fallback local: cálculo reactivo de la sesión en Dexie o cache (solo sin reparto activo)
                if (!hasAssignmentsManifest && (!diffs || diffs.length === 0) && effectiveSessionId) {
                    diffs = await getRecountDifferences(effectiveSessionId);
                }
                if (!hasAssignmentsManifest && (!diffs || diffs.length === 0) && effectiveSessionId) {
                    const cached = localStorage.getItem(`recount_differences_${effectiveSessionId}`);
                    if (cached) {
                        try {
                            diffs = JSON.parse(cached);
                        } catch {}
                    }
                }

                // Si no hay diferencias pero hay items contados generales en la sesión, mostrarlos
                if ((!diffs || diffs.length === 0) && effectiveSessionId) {
                    const allItems = await db.items.where('session_id').equals(effectiveSessionId).toArray();
                    if (allItems.length > 0) {
                        const sessionProducts = await db.precount_products.where('session_id').equals(effectiveSessionId).toArray();
                        const pMap = new Map(sessionProducts.map(p => [p.ean, p]));
                        
                        const converted: ProductItem[] = allItems.map((it, idx) => {
                            const cat = pMap.get(it.ean);
                            const sysStock = cat?.stock ?? (cat as any)?.systemStock ?? 0;
                            return {
                                id: it.id || `item-${it.ean}-${idx}`,
                                name: it.product_name || cat?.name || `Producto ${it.ean}`,
                                ean: it.ean,
                                position: it.location_tag || 'ESP-01',
                                device: it.device_name || 'ZEBRA-01',
                                qty: Number(it.quantity) || 0,
                                initialQty: Number(it.quantity) || 0,
                                image: '',
                                hasDifference: Number(it.quantity) !== sysStock,
                                systemStock: sysStock,
                                totalCounted: Number(it.quantity) || 0
                            };
                        });

                        if (isMounted) {
                            setProducts(converted);
                            setIsLoading(false);
                        }
                        return;
                    }
                }

                // Transformar RecountProductDiff[] a ProductItem[] (tarjetas por posición)
                const flatItems: ProductItem[] = [];
                (diffs || []).forEach(d => {
                    const positions = (d.positions && d.positions.length > 0)
                        ? d.positions
                        : [{ posCode: 'ESP-01', deviceName: 'ZEBRA-01', quantity: d.countedStock }];

                    positions.forEach((pos, idx) => {
                        flatItems.push({
                            id: `${d.ean}_${pos.posCode}_${pos.deviceName}_${idx}`,
                            name: d.name,
                            ean: d.ean,
                            eans: d.eans && d.eans.length > 0 ? d.eans : [d.ean],
                            id_producto: d.id_producto,
                            position: pos.posCode,
                            device: pos.deviceName || 'ZEBRA-01',
                            qty: Number(pos.quantity) || 0,
                            initialQty: Number(pos.quantity) || 0,
                            image: '',
                            hasDifference: d.difference !== 0,
                            systemStock: d.systemStock,
                            totalCounted: d.countedStock
                        });
                    });
                });

                if (isMounted) {
                    setProducts(flatItems);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('[StockRecountMobile] Error cargando datos:', err);
                if (isMounted) {
                    setProducts([]);
                    setIsLoading(false);
                }
            }
        }

        loadRealData();
        return () => { isMounted = false; };
    }, [effectiveSessionId, deviceId, reloadTick, hasJoined, recountState]);

    // Automatically resolve images via Farmaplus VTEX API or local cache
    useEffect(() => {
        products.forEach((p) => {
            if (p.ean && !resolvedImages[p.ean]) {
                getProductImageUrl(p.ean).then((url) => {
                    if (url) {
                        setResolvedImages((prev) => ({ ...prev, [p.ean]: url }));
                    }
                });
            }
        });
    }, [products]);

    // Timer simulation
    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTimer = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleIncrement = (id: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                const nextQty = p.qty + 1;
                return {
                    ...p,
                    qty: nextQty,
                    hasDifference: nextQty !== p.initialQty
                };
            }
            return p;
        }));
    };

    const handleDecrement = (id: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                const nextQty = Math.max(0, p.qty - 1);
                return {
                    ...p,
                    qty: nextQty,
                    hasDifference: nextQty !== p.initialQty
                };
            }
            return p;
        }));
    };

    // Lista única de productos agrupados para navegación Anterior / Siguiente
    const uniqueEans = useMemo(() => {
        const eans: string[] = [];
        products.forEach(p => {
            if (!eans.includes(p.ean)) eans.push(p.ean);
        });
        return eans;
    }, [products]);

    const handlePreviousProduct = () => {
        if (currentProductIndex > 0) {
            setCurrentProductIndex(prev => prev - 1);
            notify.info('Producto anterior', `Mostrando ${currentProductIndex} de ${uniqueEans.length}`);
        } else {
            notify.info('Inicio de lista', 'Estás en el primer producto');
        }
    };

    const handleNextProduct = () => {
        if (currentProductIndex < uniqueEans.length - 1) {
            setCurrentProductIndex(prev => prev + 1);
            notify.info('Siguiente producto', `Mostrando ${currentProductIndex + 2} de ${uniqueEans.length}`);
        } else {
            notify.info('Fin de lista', 'Estás en el último producto');
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = p.name.toLowerCase().includes(q);
                const matchEan = p.ean.toLowerCase().includes(q) || (p.eans || []).some(e => e.toLowerCase().includes(q));
                const matchPos = p.position.toLowerCase().includes(q);
                if (!matchName && !matchEan && !matchPos) return false;
            }

            // Tab filter
            if (activeTab === 'diferencias') {
                return p.hasDifference || p.qty !== p.initialQty;
            }
            if (activeTab === 'controlar') {
                // Si hay navegación entre productos, enfocarse en el producto actual si hay varios
                if (uniqueEans.length > 0 && currentProductIndex < uniqueEans.length) {
                    const currentEan = uniqueEans[currentProductIndex];
                    return p.ean === currentEan;
                }
                return true;
            }
            return true;
        });
    }, [products, searchQuery, activeTab, uniqueEans, currentProductIndex]);

    const handleConfirm = async () => {
        if (effectiveSessionId && products.length > 0) {
            try {
                // Agrupar total recontado por EAN y devolver resultado al diálogo Admin de MiPlus
                const grouped = new Map<string, { ean: string; eans?: string[]; id_producto?: string; name: string; initialQty: number; recountedQty: number }>();
                for (const p of products) {
                    const prev = grouped.get(p.ean);
                    if (prev) {
                        prev.initialQty += Number(p.initialQty) || 0;
                        prev.recountedQty += Number(p.qty) || 0;
                    } else {
                        grouped.set(p.ean, {
                            ean: p.ean,
                            eans: p.eans,
                            id_producto: p.id_producto,
                            name: p.name,
                            initialQty: Number(p.initialQty) || 0,
                            recountedQty: Number(p.qty) || 0,
                        });
                    }
                }

                const payload: RecountResultSubmission = {
                    device_id: deviceId,
                    device_name: deviceDisplayName,
                    platform: 'web',
                    submitted_at: new Date().toISOString(),
                    items: Array.from(grouped.values()),
                };

                const resultFilename = `recount_result_${deviceId}.json`;
                await (supabase as any)
                    .from('precount_device_files')
                    .delete()
                    .eq('session_id', effectiveSessionId)
                    .eq('filename', resultFilename);

                const { error: insertErr } = await (supabase as any)
                    .from('precount_device_files')
                    .insert({
                        session_id: effectiveSessionId,
                        device_id: deviceId,
                        device_name: deviceDisplayName,
                        filename: resultFilename,
                        content: JSON.stringify(payload),
                    });
                if (insertErr) throw insertErr;

                const channel = supabase.channel(`recount_control_${effectiveSessionId}`);
                await channel.send({
                    type: 'broadcast',
                    event: 'recount_result_submitted',
                    payload: { device_id: deviceId, device_name: deviceDisplayName },
                });

                setProducts(prev => prev.map(p => ({ ...p, initialQty: p.qty, hasDifference: false })));
                notify.success('Recuento Enviado', 'Tus diferencias recontadas fueron enviadas al panel Admin de MiPlus.');
                return;
            } catch (err) {
                console.error('Error enviando recuento:', err);
                notify.error('Error al enviar', 'No se pudo enviar el recuento al panel Admin.');
                return;
            }
        }
        notify.success('Recuento Confirmado', 'Los datos fueron sincronizados correctamente.');
    };


    if (!hasJoined) {
        return (
            <div className="h-dvh w-full bg-[#F4F4F5] text-zinc-900 flex items-center justify-center p-4 font-sans">
                <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-zinc-200/80 p-6 space-y-5">
                    <div className="space-y-1 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center mx-auto mb-3">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">Control de Diferencias</h1>
                        <p className="text-xs text-zinc-500">
                            Ingresá tu nombre para identificarte y recibir tus productos asignados.
                        </p>
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const clean = nameInput.trim();
                            if (!clean) return;
                            sessionStorage.setItem('recount_mobile_operator_name', clean);
                            setOperatorName(clean);
                            setHasJoined(true);
                        }}
                        className="space-y-3"
                    >
                        <input
                            type="text"
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="Ej: Gonzalo, Sofía..."
                            className="w-full h-11 px-4 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                        />
                        <button
                            type="submit"
                            disabled={!nameInput.trim()}
                            className="w-full h-11 rounded-xl bg-[#0066FF] text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.99] transition"
                        >
                            Unirse al recuento
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (recountState !== 'started') {
        return (
            <div className="h-dvh w-full bg-[#F4F4F5] text-zinc-900 flex items-center justify-center p-4 font-sans">
                <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-zinc-200/80 p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
                        <ClipboardCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-base font-bold">Esperando inicio del recuento</h2>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Estás conectado como <strong className="text-zinc-900">{deviceDisplayName}</strong>.
                            Aguardá a que el administrador presione <strong>Comenzar recuento</strong> para recibir tus EANs exclusivos.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        En línea y listo
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-dvh max-h-dvh w-full bg-[#F4F4F5] text-zinc-900 flex justify-center font-sans antialiased overflow-hidden select-none touch-manipulation">
            {/* Mobile Viewport Wrapper */}
            <div className="w-full max-w-[440px] h-full max-h-dvh bg-[#F4F4F5] flex flex-col relative shadow-xl border-x border-zinc-200/50">

                {/* 1. Header (Pinned at Top) */}
                <header className="relative px-4 pt-3 pb-2 flex items-center justify-between shrink-0 bg-[#F4F4F5] border-b border-zinc-200/30 z-20">
                    {/* Left: Farmaplus/Halu Icon Badge */}
                    <div className="w-[34px] h-[34px] rounded-[14px] bg-[#0066FF] flex items-center justify-center shadow-xs shadow-blue-500/25 text-white shrink-0">
                        <svg viewBox="0 0 900 900" className="w-[19px] h-[19px] fill-white" aria-hidden="true">
                            <path d="M835.93,498.13l-53.23,-88.22c-5.24,-8.68 -7.55,-18.8 -6.6,-28.88l6.26,-66.26c6.22,-65.88 -40.82,-124.86 -106.44,-133.45l-65.98,-8.64c-10.04,-1.32 -19.41,-5.83 -26.69,-12.86l-74.17,-71.52c-32.97,-31.82 -85.21,-31.82 -118.18,0l-74.17,71.52c-7.28,7.04 -16.65,11.54 -26.69,12.86l-65.98,8.64c-65.62,8.59 -112.66,67.57 -106.44,133.45l6.26,66.26c0.95,10.08 -1.36,20.2 -6.6,28.88l-53.23,88.22c-23.66,39.21 -12.05,90.15 26.29,115.21l86.25,56.39c8.47,5.54 14.94,13.66 18.46,23.15l23.11,62.42c22.98,62.04 90.95,94.78 153.8,74.05l63.2,-20.83c9.63,-3.18 19.99,-3.18 29.62,0l63.2,20.83c62.86,20.73 130.82,-12.01 153.8,-74.05l23.11,-62.42c3.52,-9.5 9.99,-17.61 18.46,-23.15l86.25,-56.39c38.34,-25.06 49.96,-76 26.29,-115.21ZM376.5,360.14c-27.16,39 -37.55,82.77 -30.78,129.85 2.67,15.51 -4.75,34.26 -21.53,39.38 -2.4,0.66 -4.79,0.96 -7.07,0.96 -17.38,0 -31.27,-17.35 -33.48,-32.87 -9.34,-61.89 4.6,-120.76 40.72,-171.86 10.2,-13.41 35.13,-25.76 50.56,-10.31 6.32,6.02 9.06,14.02 9.06,22.09s-2.8,16.38 -7.49,22.76ZM494.09,360.14c-27.16,39 -37.55,82.77 -30.78,129.85 2.67,15.51 -4.73,34.26 -21.53,39.38 -2.4,0.66 -4.79,0.96 -7.07,0.96 -17.38,0 -31.27,-17.35 -33.48,-32.87 -9.34,-61.89 4.62,-120.76 40.74,-171.86 10.2,-13.41 35.11,-25.76 50.54,-10.31 6.32,6.02 9.06,14.02 9.06,22.09s-2.8,16.38 -7.49,22.76Z" />
                        </svg>
                    </div>

                    {/* Center: Device Name & Timer (Dead Center of the Screen) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span className="font-bold text-[12.5px] tracking-wider text-zinc-900 uppercase">
                            {deviceDisplayName}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-500 tabular-nums leading-tight mt-0.5">
                            {formatTimer(secondsElapsed)}
                        </span>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        {/* Blue Checklist Button */}
                        <button 
                            type="button"
                            aria-label="Resumen"
                            className="w-[34px] h-[34px] rounded-[14px] bg-[#0066FF] hover:bg-[#005BEA] active:scale-95 text-white flex items-center justify-center shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
                        >
                            <ClipboardCheck className="w-4 h-4 stroke-[2.2]" />
                        </button>

                        {/* Filter Button */}
                        <button 
                            type="button"
                            aria-label="Filtros"
                            className="w-[34px] h-[34px] rounded-[14px] bg-[#EAEAEA] hover:bg-[#DFDFDF] active:scale-95 text-[#71717A] flex items-center justify-center transition-all cursor-pointer"
                        >
                            <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
                        </button>

                        {/* Settings Button */}
                        <button 
                            type="button"
                            aria-label="Ajustes"
                            className="w-[34px] h-[34px] rounded-[14px] bg-[#EAEAEA] hover:bg-[#DFDFDF] active:scale-95 text-[#71717A] flex items-center justify-center transition-all cursor-pointer"
                        >
                            <Settings className="w-4 h-4 stroke-[2]" />
                        </button>
                    </div>
                </header>

                {/* 2. Search Bar (Pinned) */}
                <div className="px-4 py-1.5 shrink-0 bg-[#F4F4F5] z-10">
                    <div className="relative flex items-center">
                        <div className="absolute left-3.5 text-zinc-400 pointer-events-none flex items-center">
                            <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 8.5h4M3 13.5h4M3 18.5h11" />
                                <circle cx="15.5" cy="9.5" r="4.5" />
                                <path d="M19 13l3 3" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Escanear o ingresar EAN..."
                            className="w-full h-10 pl-10 pr-3 rounded-2xl bg-white border border-zinc-200/90 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                        />
                    </div>
                </div>

                {/* 3. Segmented Tabs (Pinned) */}
                <div className="px-4 py-2 shrink-0 bg-[#F4F4F5] z-10">
                    <div className="w-full bg-zinc-200/70 p-1 rounded-full flex items-center justify-between gap-1 select-none">
                        <button
                            type="button"
                            onClick={() => setActiveTab('controlar')}
                            className={`flex-1 py-1.5 px-2 rounded-full text-[11.5px] font-semibold transition-all duration-150 text-center ${
                                activeTab === 'controlar'
                                    ? 'bg-white text-zinc-900 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                            A Controlar
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('diferencias')}
                            className={`flex-1 py-1.5 px-2 rounded-full text-[11.5px] font-semibold transition-all duration-150 text-center ${
                                activeTab === 'diferencias'
                                    ? 'bg-white text-zinc-900 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                            Con Diferencias
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('todas')}
                            className={`flex-1 py-1.5 px-2 rounded-full text-[11.5px] font-semibold transition-all duration-150 text-center ${
                                activeTab === 'todas'
                                    ? 'bg-white text-zinc-900 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                            Todas
                        </button>
                    </div>
                </div>

                {/* 4. Product Cards List (Fluid Smooth Scrolling Area) */}
                <main 
                    className="flex-1 min-h-0 overflow-y-auto px-4 py-1.5 space-y-2.5 overscroll-contain"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            className="bg-white rounded-2xl border border-zinc-200/80 shadow-2xs p-2 flex items-center gap-3 transition-all hover:border-zinc-300"
                        >
                            {/* Product Box Image (82x82 Square Thumbnail) */}
                            <div className="w-[82px] h-[82px] rounded-xl bg-white border border-zinc-100 flex items-center justify-center p-1 shrink-0 overflow-hidden select-none">
                                <img
                                    src={resolvedImages[product.ean] || product.image || `/products/${product.ean}.jpg`}
                                    alt={product.name}
                                    className="w-full h-full object-contain pointer-events-none"
                                    onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                    }}
                                />
                            </div>

                            {/* Product Info & Stepper */}
                            <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
                                {/* Title & EAN */}
                                <div className="space-y-0.5">
                                    <h3 className="font-bold text-[13px] text-zinc-900 leading-snug truncate" title={product.name}>
                                        {product.name}
                                    </h3>
                                    <p className="text-[11px] text-zinc-500 font-normal">
                                        EAN: {product.ean}
                                    </p>
                                </div>

                                {/* Divider line */}
                                <div className="h-[1px] bg-zinc-100 my-1.5 w-full" />

                                {/* Bottom Row: Position Badge & Stepper */}
                                <div className="flex items-center justify-between">
                                    {/* Position Badge & Device */}
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-800 text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0">
                                            <MapPin className="w-3 h-3 text-zinc-500 stroke-[2.2]" />
                                            {product.position}
                                        </span>
                                        <span className="text-[11px] text-zinc-400 font-normal truncate">
                                            {product.device}
                                        </span>
                                    </div>

                                    {/* Stepper Controls (- [Qty] +) */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Minus */}
                                        <button
                                            type="button"
                                            onClick={() => handleDecrement(product.id)}
                                            aria-label="Restar"
                                            className="w-[26px] h-[26px] rounded-[10px] bg-[#EAEAEA] hover:bg-[#E0E0E0] active:scale-90 text-[#71717A] flex items-center justify-center transition-all cursor-pointer select-none"
                                        >
                                            <Minus className="w-3 h-3 stroke-[2.5]" />
                                        </button>

                                        {/* Quantity Badge with Zebra Colors */}
                                        <span className={`w-[26px] h-[26px] rounded-[10px] text-xs font-bold flex items-center justify-center tabular-nums select-none transition-colors duration-150 ${
                                            product.qty > product.initialQty
                                                ? 'bg-[#C9FFB3] text-[#1A9C38]'
                                                : product.qty < product.initialQty
                                                ? 'bg-[#FFEEED] text-[#EE6142]'
                                                : 'bg-[#EAEAEA] text-[#71717A]'
                                        }`}>
                                            {product.qty}
                                        </span>

                                        {/* Plus */}
                                        <button
                                            type="button"
                                            onClick={() => handleIncrement(product.id)}
                                            aria-label="Sumar"
                                            className="w-[26px] h-[26px] rounded-[10px] bg-[#EAEAEA] hover:bg-[#E0E0E0] active:scale-90 text-[#71717A] flex items-center justify-center transition-all cursor-pointer select-none"
                                        >
                                            <Plus className="w-3 h-3 stroke-[2.5]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredProducts.length === 0 && (
                        <div className="py-16 text-center text-zinc-400 text-xs">
                            No se encontraron productos para los criterios seleccionados.
                        </div>
                    )}
                </main>

                {/* 5. Bottom Navigation Bar (Pinned with Safe Area, 3 Equal-Width Columns) */}
                <footer className="shrink-0 px-4 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] bg-[#F4F4F5] border-t border-zinc-200/80 z-30">
                    <div className="grid grid-cols-3 gap-2 w-full">
                        {/* Anterior */}
                        <button
                            type="button"
                            onClick={handlePreviousProduct}
                            className="h-[38px] w-full rounded-full bg-[#EAEAEA] hover:bg-[#E0E0E0] active:scale-98 text-[#71717A] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none px-2"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                            <span className="leading-none pt-[0.5px]">Anterior</span>
                        </button>

                        {/* Siguiente */}
                        <button
                            type="button"
                            onClick={handleNextProduct}
                            className="h-[38px] w-full rounded-full bg-[#EAEAEA] hover:bg-[#E0E0E0] active:scale-98 text-[#71717A] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none px-2"
                        >
                            <span className="leading-none pt-[0.5px]">Siguiente</span>
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                        </button>

                        {/* Confirmar (Electric Blue) */}
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="h-[38px] w-full rounded-full bg-[#0066FF] hover:bg-[#005BEA] active:scale-98 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/25 transition-all cursor-pointer select-none px-2"
                        >
                            <Check className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                            <span className="leading-none pt-[0.5px]">Confirmar</span>
                        </button>
                    </div>
                </footer>

            </div>
        </div>
    );
}

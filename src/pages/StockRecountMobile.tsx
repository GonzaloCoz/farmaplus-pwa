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
import { notify } from '@/lib/notifications';
import { getProductImageUrl } from '@/services/productImageService';

interface ProductItem {
    id: string;
    name: string;
    ean: string;
    position: string;
    device: string;
    qty: number;
    initialQty: number;
    image: string;
    hasDifference?: boolean;
}

const INITIAL_PRODUCTS: ProductItem[] = [
    {
        id: 'prod-tafirol',
        name: 'Tafirol Forte x 70 comprimidos',
        ean: '7798140257066',
        position: 'ESP-08',
        device: 'ZEBRA-01',
        qty: 2,
        initialQty: 2,
        image: '',
        hasDifference: false,
    },
    {
        id: 'prod-1',
        name: 'TREG 20 mg caps.x 15',
        ean: '7790839980910',
        position: 'ESP-01',
        device: 'ZEBRA-01',
        qty: 4,
        initialQty: 3,
        image: '/products/img_treg_20mg.png',
        hasDifference: true,
    },
    {
        id: 'prod-2',
        name: 'TREG 20 mg caps.x 15',
        ean: '7790839980910',
        position: 'ESP-02',
        device: 'ZEBRA-01',
        qty: 7,
        initialQty: 8,
        image: '/products/img_treg_20mg.png',
        hasDifference: true,
    },
    {
        id: 'prod-3',
        name: 'TREG 20 mg caps.x 15',
        ean: '7790839980910',
        position: 'ESP-03',
        device: 'ZEBRA-01',
        qty: 1,
        initialQty: 1,
        image: '/products/img_treg_20mg.png',
        hasDifference: true,
    },
    {
        id: 'prod-4',
        name: 'TREG 20 mg caps.x 15',
        ean: '7790839980910',
        position: 'ESP-04',
        device: 'ZEBRA-01',
        qty: 5,
        initialQty: 5,
        image: '/products/img_treg_20mg.png',
        hasDifference: false,
    },
    {
        id: 'prod-5',
        name: 'NUTRILON PROFUTURA 1 x 800 g',
        ean: '7791234567890',
        position: 'ESP-05',
        device: 'ZEBRA-01',
        qty: 4,
        initialQty: 2,
        image: '/products/img_nutrilon_1.png',
        hasDifference: true,
    },
    {
        id: 'prod-6',
        name: 'IBUPIRAC 400 mg comp. x 20',
        ean: '7791234567891',
        position: 'ESP-06',
        device: 'ZEBRA-01',
        qty: 12,
        initialQty: 12,
        image: '/products/img_treg_20mg.png',
        hasDifference: false,
    },
    {
        id: 'prod-7',
        name: 'PARACETAMOL 500 mg comp. x 24',
        ean: '7791234567892',
        position: 'ESP-07',
        device: 'ZEBRA-01',
        qty: 6,
        initialQty: 6,
        image: '/products/img_treg_20mg.png',
        hasDifference: false,
    }
];

export default function StockRecountMobile() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'controlar' | 'diferencias' | 'todas'>('controlar');
    const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
    const [secondsElapsed, setSecondsElapsed] = useState(15189); // ~ 04:13:09
    const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});

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

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = p.name.toLowerCase().includes(q);
                const matchEan = p.ean.includes(q);
                const matchPos = p.position.toLowerCase().includes(q);
                if (!matchName && !matchEan && !matchPos) return false;
            }

            // Tab filter
            if (activeTab === 'diferencias') {
                return p.hasDifference || p.qty !== p.initialQty;
            }
            if (activeTab === 'controlar') {
                return true;
            }
            return true;
        });
    }, [products, searchQuery, activeTab]);

    const handleConfirm = () => {
        notify.success('Recuento Confirmado', 'Los datos fueron sincronizados correctamente.');
    };

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
                            ZEBRA-01
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
                            className="h-[38px] w-full rounded-full bg-[#EAEAEA] hover:bg-[#E0E0E0] active:scale-98 text-[#71717A] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none px-2"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                            <span className="leading-none pt-[0.5px]">Anterior</span>
                        </button>

                        {/* Siguiente */}
                        <button
                            type="button"
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

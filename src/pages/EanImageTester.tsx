import React, { useState, useRef } from 'react';
import { lookupProductByEan, ProductLookupResult } from '@/services/productImageService';

export default function EanImageTester() {
    const [eanInput, setEanInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ProductLookupResult | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSearch = async (codeToSearch?: string) => {
        const query = (codeToSearch ?? eanInput).trim();
        if (!query) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const data = await lookupProductByEan(query);
            setResult(data);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    const handleQuickTest = (ean: string) => {
        setEanInput(ean);
        handleSearch(ean);
    };

    return (
        <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col items-center justify-center p-6 antialiased select-none font-sans">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">

                {/* Recuadro Cuadrado */}
                <div className="w-64 h-64 border border-zinc-200 rounded-lg bg-zinc-50 flex items-center justify-center p-3 overflow-hidden relative">
                    {loading ? (
                        <span className="text-xs text-zinc-400 font-medium">Buscando...</span>
                    ) : result?.imageUrl ? (
                        <img
                            src={result.imageUrl}
                            alt={result.productName || 'Producto'}
                            className="w-full h-full object-contain"
                        />
                    ) : hasSearched ? (
                        <span className="text-xs text-zinc-400 font-medium">Sin imagen</span>
                    ) : (
                        <span className="text-xs text-zinc-300 font-medium">Esperando EAN</span>
                    )}
                </div>

                {/* Info Textual (Monocromatica) */}
                {result && !loading && (
                    <div className="w-full text-center space-y-1">
                        {result.productName && (
                            <h2 className="text-sm font-semibold text-zinc-900 leading-snug">
                                {result.productName}
                            </h2>
                        )}
                        {result.brand && (
                            <p className="text-xs text-zinc-500 font-normal">
                                {result.brand}
                            </p>
                        )}
                        <p className="text-[11px] text-zinc-400 font-mono">
                            EAN: {result.ean}
                        </p>
                    </div>
                )}

                {/* Campo de Texto */}
                <div className="w-full space-y-3">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="numeric"
                            value={eanInput}
                            onChange={(e) => setEanInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ingresar o escanear EAN..."
                            autoFocus
                            className="flex-1 h-10 px-3 border border-zinc-300 rounded text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => handleSearch()}
                            disabled={loading || !eanInput.trim()}
                            className="h-10 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 text-xs font-medium rounded transition-colors cursor-pointer"
                        >
                            {loading ? '...' : 'Buscar'}
                        </button>
                    </div>

                    {/* Botones de prueba rapida (Monocromaticos) */}
                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-zinc-100">
                        <button
                            type="button"
                            onClick={() => handleQuickTest('7798140257066')}
                            className="text-[11px] font-mono text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer"
                        >
                            Tafirol (7798140257066)
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                            type="button"
                            onClick={() => handleQuickTest('7795323002413')}
                            className="text-[11px] font-mono text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer"
                        >
                            Nutrilon (7795323002413)
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

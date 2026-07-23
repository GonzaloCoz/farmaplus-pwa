import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw01 as Loader2, SearchLg as Search, XCircle as X } from '@untitledui/icons';
import { Dropdown, MenuItem } from '@/components/ui/dropdown';
import { Product, searchProducts } from '@/services/preCountDB';
import { db } from '@/services/db';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface SmartProductSearchProps {
    onSelect: (product: { name: string, ean: string, id_producto?: string }) => void;
    autoFocus?: boolean;
    className?: string;
    inputClassName?: string;
    sessionId?: string;
}

export function SmartProductSearch({ onSelect, autoFocus = true, className, inputClassName, sessionId }: SmartProductSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const debouncedQuery = useDebounce(query, 300);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectionLockRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Focus management
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    // Outside click management
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-scroll selected item into view when navigating with arrow keys
    useEffect(() => {
        if (isOpen && selectedIndex !== null && dropdownRef.current) {
            const selectedElement = dropdownRef.current.querySelector(`[data-proximity-index="${selectedIndex}"]`) as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedIndex, isOpen]);

    // Search Effect
    useEffect(() => {
        if (selectionLockRef.current) return;

        if (debouncedQuery.length < 2) {
            setResults([]);
            setIsOpen(false);
            setSelectedIndex(null);
            return;
        }

        const performSearch = async () => {
            setIsLoading(true);
            try {
                const queryLower = debouncedQuery.toLowerCase().trim();
                let filtered: Product[] = [];

                if (sessionId) {
                    const dbProducts = await db.precount_products
                        .where('session_id')
                        .equals(sessionId)
                        .filter(p =>
                            (p.name || '').toLowerCase().includes(queryLower) ||
                            (p.ean || '').includes(queryLower)
                        )
                        .limit(30)
                        .toArray();

                    filtered = dbProducts.map(p => ({
                        ean: p.ean,
                        name: p.name,
                        cost: p.cost,
                        salePrice: p.salePrice || 0,
                        id_producto: p.id_producto
                    }));
                } else {
                    const data = await searchProducts(debouncedQuery);
                    filtered = data;
                }

                if (!selectionLockRef.current) {
                    setResults(filtered);
                    setIsOpen(filtered.length > 0);
                    setSelectedIndex(filtered.length > 0 ? 0 : null);
                }
            } catch (error) {
                console.error('Error al buscar productos en buscador:', error);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, sessionId]);

    const handleSelect = (product: { name: string, ean: string, id_producto?: string }, index?: number) => {
        selectionLockRef.current = true;
        if (index !== undefined) {
            setSelectedIndex(index);
        }
        if (inputRef.current) inputRef.current.value = '';
        setQuery('');
        setIsOpen(false);
        setResults([]);
        onSelect(product);
        setTimeout(() => { selectionLockRef.current = false; }, 400);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (results.length > 0) {
                setSelectedIndex(prev => (prev === null ? 0 : (prev + 1) % results.length));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (results.length > 0) {
                setSelectedIndex(prev => (prev === null ? results.length - 1 : (prev - 1 + results.length) % results.length));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectionLockRef.current = true;
            const currentQuery = query.trim();

            if (inputRef.current) inputRef.current.value = '';
            setQuery('');
            setIsOpen(false);

            if (isOpen && selectedIndex !== null && results[selectedIndex]) {
                onSelect(results[selectedIndex]);
                setResults([]);
                setTimeout(() => { selectionLockRef.current = false; }, 400);
            } else if (results.length > 0) {
                onSelect(results[0]);
                setResults([]);
                setTimeout(() => { selectionLockRef.current = false; }, 400);
            } else if (currentQuery && sessionId) {
                const queryLower = currentQuery.toLowerCase();
                const lookupProduct = async () => {
                    try {
                        let found = await db.precount_products
                            .where('[session_id+ean]')
                            .equals([sessionId, currentQuery])
                            .first();

                        if (!found) {
                            found = await db.precount_products
                                .where('session_id')
                                .equals(sessionId)
                                .filter(p => (p.name || '').toLowerCase().includes(queryLower))
                                .first();
                        }

                        if (found) {
                            onSelect({ ean: found.ean, name: found.name, id_producto: found.id_producto });
                        } else {
                            onSelect({ ean: currentQuery, name: '' });
                        }
                    } catch (err) {
                        onSelect({ ean: currentQuery, name: '' });
                    } finally {
                        setResults([]);
                        setTimeout(() => { selectionLockRef.current = false; }, 400);
                    }
                };
                lookupProduct();
            } else if (currentQuery) {
                const quickLookup = async () => {
                    try {
                        const data = await searchProducts(currentQuery);
                        if (data.length > 0) {
                            onSelect(data[0]);
                        } else {
                            onSelect({ ean: currentQuery, name: '' });
                        }
                    } catch (err) {
                        onSelect({ ean: currentQuery, name: '' });
                    } finally {
                        setResults([]);
                        setTimeout(() => { selectionLockRef.current = false; }, 400);
                    }
                };
                quickLookup();
            } else {
                selectionLockRef.current = false;
            }
        }
    };

    // Auto-EAN detection (Omit Enter)
    useEffect(() => {
        const q = query.trim();
        if (!selectionLockRef.current && (q.length === 13 || q.length === 14) && /^\d+$/.test(q)) {
            const timer = setTimeout(async () => {
                selectionLockRef.current = true;
                if (inputRef.current) inputRef.current.value = '';
                setQuery('');
                setIsOpen(false);
                setResults([]);

                if (sessionId) {
                    try {
                        const found = await db.precount_products
                            .where('[session_id+ean]')
                            .equals([sessionId, q])
                            .first();
                        onSelect(found
                            ? { ean: found.ean, name: found.name, id_producto: found.id_producto }
                            : { ean: q, name: '' }
                        );
                    } catch (err) {
                        onSelect({ ean: q, name: '' });
                    } finally {
                        setTimeout(() => { selectionLockRef.current = false; }, 300);
                    }
                } else {
                    try {
                        const data = await searchProducts(q);
                        if (data.length > 0) {
                            onSelect(data[0]);
                        } else {
                            onSelect({ ean: q, name: '' });
                        }
                    } catch (err) {
                        onSelect({ ean: q, name: '' });
                    } finally {
                        setTimeout(() => { selectionLockRef.current = false; }, 300);
                    }
                }
            }, 150);

            return () => clearTimeout(timer);
        }
    }, [query, sessionId]);

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        setSelectedIndex(null);
        inputRef.current?.focus();
    };

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <div className="relative group w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors z-10 pointer-events-none" />
                <Input
                    ref={inputRef}
                    id="smart-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (results.length > 0) setIsOpen(true); }}
                    placeholder="Escanear EAN o buscar producto..."
                    className={cn("pl-10 h-10 text-xs font-semibold bg-transparent border-input shadow-none focus-visible:ring-primary/10 transition-all font-sans placeholder:text-xs placeholder:font-sans placeholder:font-normal w-full", inputClassName)}
                    autoComplete="off"
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                    {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground/60" />}
                    {query && !isLoading && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={handleClear}
                        >
                            <X className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            {isOpen && results.length > 0 && (
                <Dropdown
                    ref={dropdownRef}
                    checkedIndex={selectedIndex ?? undefined}
                    className="absolute top-full left-0 z-[100] mt-1.5 w-full min-w-[380px] sm:min-w-[440px] max-h-[300px] overflow-y-auto"
                >
                    {results.map((product, i) => (
                        <MenuItem
                            key={`${product.ean}-${i}`}
                            index={i}
                            label={
                                <div className="flex items-center justify-between gap-3 w-full min-w-0 py-0.5">
                                    <span className="font-bold text-xs truncate flex-1">{product.name || 'Producto sin nombre'}</span>
                                    <span className="font-mono text-[11px] text-muted-foreground font-semibold shrink-0 bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">{product.ean}</span>
                                </div>
                            }
                            checked={selectedIndex === i}
                            onSelect={() => handleSelect(product, i)}
                        />
                    ))}
                </Dropdown>
            )}
        </div>
    );
}

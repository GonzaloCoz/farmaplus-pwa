import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, XCircle as X, ScanBarcode as Barcode } from 'lucide-react';
import { searchProducts, Product } from '@/services/preCountDB';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartProductSearchProps {
    onSelect: (product: { name: string, ean: string, id_producto?: string }) => void;
    autoFocus?: boolean;
    className?: string;
}

export function SmartProductSearch({ onSelect, autoFocus = true, className }: SmartProductSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const debouncedQuery = useDebounce(query, 300);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectionLockRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Focus management
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    // Handle outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search Effect
    useEffect(() => {
        const performSearch = async () => {
            if (selectionLockRef.current) return;
            
            if (debouncedQuery.length < 2) {
                setResults([]);
                setIsOpen(false);
                return;
            }

            setIsLoading(true);
            try {
                const data = await searchProducts(debouncedQuery);
                if (!selectionLockRef.current) {
                    setResults(data);
                    setIsOpen(data.length > 0);
                    setSelectedIndex(0);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            
            selectionLockRef.current = true;
            const currentQuery = query.trim();
            
            // Immediate NATIVE UI update
            if (inputRef.current) inputRef.current.value = '';
            setQuery('');
            setIsOpen(false);
            setResults([]);

            if (isOpen && results.length > 0) {
                onSelect(results[selectedIndex]);
                setTimeout(() => { selectionLockRef.current = false; }, 500);
            } else if (currentQuery) {
                // If scanner was too fast for debounce, lookup manually now
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
                        setTimeout(() => { selectionLockRef.current = false; }, 500);
                    }
                };
                quickLookup();
            } else {
                selectionLockRef.current = false;
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelect = (product: { name: string, ean: string, id_producto?: string }) => {
        selectionLockRef.current = true;
        
        // Immediate NATIVE UI update
        if (inputRef.current) inputRef.current.value = '';
        setQuery('');
        setIsOpen(false);
        setResults([]);
        onSelect(product);
        setTimeout(() => { selectionLockRef.current = false; }, 500);
    };

    // Auto-EAN detection (Omit Enter)
    useEffect(() => {
        const q = query.trim();
        // Standard EAN full lengths: 13, 14
        if (!selectionLockRef.current && (q.length === 13 || q.length === 14) && /^\d+$/.test(q)) {
            const timer = setTimeout(async () => {
                selectionLockRef.current = true;
                if (inputRef.current) inputRef.current.value = '';
                setQuery('');
                setIsOpen(false);
                setResults([]);
                
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
            }, 150); // Small 150ms delay to allow manual typing a 14th digit without EAN-13 cutting it
            
            return () => clearTimeout(timer);
        }
    }, [query]);

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const listRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected item
    useEffect(() => {
        if (isOpen && listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedIndex, isOpen]);

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                <Input
                    ref={inputRef}
                    id="smart-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escanear EAN o buscar producto..."
                    className="pl-10 h-11 text-xs font-semibold bg-transparent border-input shadow-none focus-visible:ring-primary/10 transition-all font-mono placeholder:text-xs placeholder:font-sans placeholder:font-normal"
                    autoComplete="off"
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
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

            {/* Suggestions Dropdown */}
            <AnimatePresence>
                {isOpen && results.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 z-[100] mt-1.5 bg-popover text-popover-foreground rounded-xl border border-border/40 shadow-lg overflow-hidden max-h-[300px] overflow-y-auto"
                    >
                        <div className="p-1.5 space-y-0.5" ref={listRef}>
                            {results.map((product, index) => (
                                <button
                                    key={product.ean}
                                    onClick={() => handleSelect(product)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 text-xs rounded-lg flex items-center justify-between group transition-all duration-200 border border-transparent",
                                        index === selectedIndex
                                            ? "bg-primary/10 text-primary border-primary/20"
                                            : "hover:bg-muted/50 text-foreground"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className={cn("font-bold truncate", index === selectedIndex ? "text-primary" : "")}>{product.name}</div>
                                        <div className={cn("text-[10px] flex items-center gap-1.5 mt-0.5", index === selectedIndex ? "text-primary/70" : "text-muted-foreground/60")}>
                                            <Barcode className="size-3" />
                                            <span className="font-mono">{product.ean}</span>
                                        </div>
                                    </div>
                                    {index === selectedIndex && (
                                        <span className="text-[9px] font-black uppercase bg-primary/20 px-1.5 py-0.5 rounded text-primary tracking-wider">Enter</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


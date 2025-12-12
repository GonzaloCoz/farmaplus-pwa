
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, X, Barcode } from 'lucide-react';
import { searchProducts, Product } from '@/services/preCountDB';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartProductSearchProps {
    onSelect: (product: { name: string, ean: string }) => void;
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
            // If query is empty or just 1-2 chars, don't search unless it looks like EAN start? 
            // Actually for names 2 chars might be enough
            if (debouncedQuery.length < 2) {
                setResults([]);
                setIsOpen(false);
                return;
            }

            // If it looks like a full EAN (numeric & long), we might just want to wait for Enter? 
            // But user asked for suggestions. Let's search.
            setIsLoading(true);
            try {
                const data = await searchProducts(debouncedQuery);
                setResults(data);
                setIsOpen(data.length > 0);
                setSelectedIndex(0);
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
            if (isOpen && results.length > 0) {
                // Select currently highlighted suggestion
                handleSelect(results[selectedIndex]);
            } else if (query.trim()) {
                // Submit raw query as EAN (User scanned something that might not be in suggestion list yet or just wants fast mode)
                // We treat it as a direct EAN entry
                handleSelect({ ean: query.trim(), name: '' });
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelect = (product: { name: string, ean: string }) => {
        onSelect(product);
        setQuery(''); // Clear after select? Or keep? Usually clear to be ready for next or to show selected.
        // For this flow (Search -> Qty -> Next), clearing is better as the "Selected Product" info is shown elsewhere usually.
        setIsOpen(false);
        // We do NOT refocus here because parent will move focus to Quantity.
    };

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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                    ref={inputRef}
                    id="smart-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escanear EAN o buscar producto..."
                    className="pl-10 h-12 text-lg font-medium bg-card border-border/60 shadow-sm focus-visible:ring-primary/20 transition-all font-mono placeholder:font-sans"
                    autoComplete="off"
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    {query && !isLoading && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={handleClear}
                        >
                            <X className="w-4 h-4" />
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
                        className="absolute top-full left-0 right-0 z-[100] mt-1 bg-popover text-popover-foreground rounded-lg border shadow-xl overflow-hidden max-h-[300px] overflow-y-auto ring-1 ring-border/50"
                    >
                        <div className="p-1.5 space-y-0.5" ref={listRef}>
                            {results.map((product, index) => (
                                <button
                                    key={product.ean}
                                    onClick={() => handleSelect(product)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 text-sm rounded-md flex items-center justify-between group transition-all duration-200 border border-transparent",
                                        index === selectedIndex
                                            ? "bg-primary/15 text-primary-foreground/90 border-primary/20 shadow-sm"
                                            : "hover:bg-muted text-foreground"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className={cn("font-medium truncate", index === selectedIndex ? "text-primary" : "")}>{product.name}</div>
                                        <div className={cn("text-xs flex items-center gap-2", index === selectedIndex ? "text-primary/70" : "text-muted-foreground")}>
                                            <Barcode className="w-3 h-3" />
                                            <span className="font-mono opacity-80">{product.ean}</span>
                                        </div>
                                    </div>
                                    {index === selectedIndex && (
                                        <span className="text-xs font-semibold bg-background/50 px-1.5 py-0.5 rounded text-primary shadow-sm border border-primary/10">Enter</span>
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

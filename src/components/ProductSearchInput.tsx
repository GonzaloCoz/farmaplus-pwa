import { useState, useEffect, useRef } from 'react';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { searchProducts, Product } from '@/services/preCountDB';
import { cn } from '@/lib/utils';

interface ProductSearchInputProps {
    onSelect: (product: Product) => void;
    placeholder?: string;
    className?: string;
}

export function ProductSearchInput({
    onSelect,
    placeholder = 'Buscar producto por nombre o EAN...',
    className
}: ProductSearchInputProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Búsqueda con debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length >= 2) {
                try {
                    const products = await searchProducts(query, 8);
                    setResults(products);
                    setIsOpen(products.length > 0);
                    setSelectedIndex(0);
                } catch (error) {
                    console.error('Error searching products:', error);
                    setResults([]);
                }
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Navegación con teclado
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (product: Product) => {
        onSelect(product);
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.blur();
    };

    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === query.toLowerCase()
                ? <mark key={index} className="bg-primary/20 text-primary font-semibold">{part}</mark>
                : part
        );
    };

    return (
        <div className={cn('relative', className)}>
            {/* Input de búsqueda */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (results.length > 0) {
                            setIsOpen(true);
                        }
                    }}
                    placeholder={placeholder}
                    className="pl-10 pr-4"
                />
            </div>

            {/* Dropdown de resultados */}
            <AnimatePresence>
                {isOpen && results.length > 0 && (
                    <motion.div
                        ref={dropdownRef}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-lg elevation-3 max-h-[400px] overflow-y-auto"
                    >
                        <div className="p-2 space-y-1">
                            {results.map((product, index) => (
                                <motion.button
                                    key={product.ean}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => handleSelect(product)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={cn(
                                        'w-full text-left p-3 rounded-lg transition-colors',
                                        'hover:bg-primary hover:text-primary-foreground',
                                        'focus:outline-none focus:ring-2 focus:ring-ring',
                                        selectedIndex === index && 'bg-primary text-primary-foreground'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            'p-2 rounded-lg flex-shrink-0',
                                            selectedIndex === index ? 'bg-primary-foreground/20' : 'bg-muted'
                                        )}>
                                            <Package className={cn(
                                                'w-5 h-5',
                                                selectedIndex === index ? 'text-primary-foreground' : 'text-muted-foreground'
                                            )} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">
                                                {highlightMatch(product.name, query)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn(
                                                    'text-xs font-mono',
                                                    selectedIndex === index ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                                )}>
                                                    EAN: {highlightMatch(product.ean, query)}
                                                </span>
                                                {product.salePrice > 0 && (
                                                    <>
                                                        <span className={cn(
                                                            'text-xs',
                                                            selectedIndex === index ? 'text-primary-foreground/60' : 'text-muted-foreground'
                                                        )}>
                                                            •
                                                        </span>
                                                        <span className={cn(
                                                            'text-xs font-semibold',
                                                            selectedIndex === index ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                                        )}>
                                                            ${product.salePrice.toLocaleString()}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>

                        {/* Footer con hint de teclado */}
                        <div className="border-t border-border p-2 bg-muted/30">
                            <p className="text-xs text-muted-foreground text-center">
                                Usa ↑↓ para navegar, Enter para seleccionar
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mensaje cuando no hay resultados */}
            {isOpen && query.trim().length >= 2 && results.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-lg p-4"
                >
                    <p className="text-sm text-muted-foreground text-center">
                        No se encontraron productos
                    </p>
                </motion.div>
            )}
        </div>
    );
}

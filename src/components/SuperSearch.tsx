import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Home,
    Upload,
    BarChart3,
    Package,
    FileText,
    Beaker,
    Box,
    RefreshCw,
    Search as SearchIcon,
    Layers,
    MessageSquare,
    Files,
    X
} from "lucide-react";
import { getAllProducts } from "@/services/preCountDB";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SuperSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TABS = [
    { id: 'all', label: 'Todo', icon: Layers },
    { id: 'pages', label: 'Páginas', icon: Files },
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'actions', label: 'Acciones', icon: ZapIcon },
];

function ZapIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    )
}

export function SuperSearch({ open, onOpenChange }: SuperSearchProps) {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            // In a real scenario, we might fetch only when open or optimize this.
            // For now, loading limited set as before is fine.
            try {
                const allProducts = await getAllProducts();
                setProducts(allProducts);
            } catch (error) {
                console.error("Error loading search data:", error);
            }
        };

        if (open) {
            loadData();
            setActiveTab('all'); // Reset tab on open
            setSearchTerm('');
        }
    }, [open]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [open, onOpenChange]);

    const handleSelect = (callback: () => void) => {
        onOpenChange(false);
        callback();
    };

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products.slice(0, 10);
        return products.filter(p =>
            p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.ean.includes(searchTerm)
        ).slice(0, 50);
    }, [products, searchTerm]);

    const PAGES = [
        { name: "Dashboard", path: "/", icon: Home },
        { name: "Analista Inteligente", path: "/smart-analyst", icon: SearchIcon },
        { name: "Control de Vencimientos", path: "/expiration-control", icon: Beaker },
        { name: "Importar Inventario", path: "/stock", icon: Upload },
        { name: "Inventarios Cíclicos", path: "/cyclic-inventory", icon: BarChart3 },
        { name: "Productos", path: "/products", icon: Package },
        { name: "Reportes", path: "/reports", icon: FileText },
    ];

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            // Custom class to override default shadcn dialog styling if needed for glassmorphism
            className="bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl overflow-hidden sm:max-w-2xl"
        >
            {/* Custom Header Area */}
            <div className="flex items-center border-b border-border/40 px-3" cmdk-input-wrapper="">
                <SearchIcon className="mr-2 h-5 w-5 shrink-0 opacity-50" />
                <CommandInput
                    placeholder="Buscar en Farmaplus..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                    className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-none focus:ring-0"
                />
                {searchTerm && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-muted"
                        onClick={() => setSearchTerm('')}
                    >
                        <X className="w-3 h-3" />
                        <span className="sr-only">Clear</span>
                    </Button>
                )}
                <div className="ml-2 flex items-center gap-1">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">ESC</span>
                    </kbd>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-2 border-b border-border/40 bg-muted/20">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                            activeTab === tab.id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <CommandList className="max-h-[500px] p-2">
                <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
                    No se encontraron resultados para "{searchTerm}"
                </CommandEmpty>

                {/* PAGES SECTION */}
                {(activeTab === 'all' || activeTab === 'pages') && (
                    <CommandGroup heading="Páginas">
                        {PAGES.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((page) => (
                            <CommandItem
                                key={page.path}
                                onSelect={() => handleSelect(() => navigate(page.path))}
                                className="aria-selected:bg-primary/10 aria-selected:text-primary"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background mr-3">
                                    <page.icon className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium">{page.name}</span>
                                    <span className="text-[10px] text-muted-foreground">Navegación</span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {(activeTab === 'all') && <CommandSeparator className="my-2" />}

                {/* PRODUCTS SECTION */}
                {(activeTab === 'all' || activeTab === 'products') && filteredProducts.length > 0 && (
                    <CommandGroup heading="Productos">
                        {filteredProducts.map((product: any) => (
                            <CommandItem
                                key={product.ean}
                                onSelect={() => handleSelect(() => navigate(`/products?search=${product.ean}`))}
                                className="aria-selected:bg-primary/10 aria-selected:text-primary"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background mr-3">
                                    <Box className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium truncate">{product.description}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal border-border/50 text-muted-foreground">
                                            {product.ean}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">{product.laboratory}</span>
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {(activeTab === 'all' || activeTab === 'actions') && (
                    <CommandGroup heading="Acciones">
                        <CommandItem onSelect={() => handleSelect(() => window.location.reload())}>
                            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background mr-3">
                                <RefreshCw className="h-4 w-4" />
                            </div>
                            <span>Sincronizar Datos</span>
                        </CommandItem>
                    </CommandGroup>
                )}

            </CommandList>

            {/* Footer / Hints */}
            <div className="flex items-center justify-between p-2 border-t border-border/40 bg-muted/20 text-[10px] text-muted-foreground px-4">
                <div className="flex gap-3">
                    <span className="flex items-center gap-1"><kbd className="font-sans">↑↓</kbd> navegar</span>
                    <span className="flex items-center gap-1"><kbd className="font-sans">↵</kbd> seleccionar</span>
                </div>
                <span>Farmaplus Super Search</span>
            </div>
        </CommandDialog>
    );
}

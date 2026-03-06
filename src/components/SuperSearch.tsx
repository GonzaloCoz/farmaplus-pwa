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
    Chart as BarChart3,
    Widget as Package,
    Document as FileText,
    Widget as Beaker,
    Box,
    Restart as RefreshCw,
    Magnifer as SearchIcon,
    Layers,
    User,
    UsersGroupTwoRounded as UsersIcon,
    Buildings,
    ShieldCheck,
    CloseCircle as X,
    Forbidden as Ghost
} from "@solar-icons/react";
import { getAllProducts } from "@/services/preCountDB";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BRANCH_NAMES, ZONAL_USERS, BRANCH_USERS } from "@/config/users";

interface SuperSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TABS = [
    { id: 'all', label: 'Todo', icon: Layers },
    { id: 'pages', label: 'Páginas', icon: FileText },
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'branches', label: 'Sucursales', icon: Buildings },
    { id: 'users', label: 'Usuarios', icon: UsersIcon },
];

export function SuperSearch({ open, onOpenChange }: SuperSearchProps) {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const allProducts = await getAllProducts();
                setProducts(allProducts);
            } catch (error) {
                console.error("Error loading search data:", error);
            }
        };

        if (open) {
            loadData();
            setActiveTab('all');
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
        if (!searchTerm) return [];
        return products.filter(p =>
            p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.ean.includes(searchTerm)
        ).slice(0, 10);
    }, [products, searchTerm]);

    const filteredBranches = useMemo(() => {
        if (!searchTerm) return [];
        return BRANCH_NAMES.filter(b => b.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(name => ({ name, type: 'branch' }))
            .slice(0, 10);
    }, [searchTerm]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return [];
        const allUsers = [...ZONAL_USERS, ...BRANCH_USERS];
        return allUsers.filter(u =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10);
    }, [searchTerm]);

    const PAGES = [
        { name: "Dashboard", path: "/", icon: Home, desc: "Vista general de métricas" },
        { name: "Analista Inteligente", path: "/smart-analyst", icon: SearchIcon, desc: "Asistente inteligente" },
        { name: "Control de Vencimientos", path: "/stock/expiration-control", icon: Beaker, desc: "Gestión de vencimientos" },
        { name: "Inventarios Ciclicos", path: "/cyclic-inventory", icon: BarChart3, desc: "Ajustes e inventario" },
        { name: "Productos", path: "/products", icon: Package, desc: "Maestro de productos" },
        { name: "Reportes y Auditoría", path: "/reports", icon: FileText, desc: "Historial y logs" },
    ];

    const filteredPages = useMemo(() => {
        if (!searchTerm) return PAGES;
        return PAGES.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm]);

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            className="bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl overflow-hidden sm:max-w-[650px] rounded-3xl p-0"
        >
            <div className="flex flex-col max-h-[85vh]">
                {/* Search Bar Area */}
                <div className="flex items-center px-4 pt-4 pb-2" cmdk-input-wrapper="">
                    <CommandInput
                        placeholder="Buscar productos, sucursales..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                        className="flex h-12 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground/50 border-none focus:ring-0 font-medium"
                    />
                    <div className="flex items-center gap-2">
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-muted/50"
                                onClick={() => setSearchTerm('')}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded-lg border border-border/40 bg-muted/30 px-2 font-mono text-[9px] font-medium text-muted-foreground">
                            ESC
                        </kbd>
                    </div>
                </div>

                {/* Navigation Tabs - More compact and monochrome */}
                <div className="px-4 pb-3">
                    <div className="relative flex items-center gap-1 p-1 bg-muted/20 rounded-xl border border-border/40">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300 z-10 uppercase tracking-tighter",
                                    activeTab === tab.id
                                        ? "text-background dark:text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="search-tab-bg-mono"
                                        className="absolute inset-0 bg-foreground dark:bg-zinc-800 rounded-lg -z-10 shadow-sm"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "" : "opacity-60")} />
                                <span className="">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results Area */}
                <CommandList className="flex-1 px-3 pb-3 overflow-y-auto no-scrollbar">
                    <CommandEmpty className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 rounded-full bg-muted/20">
                                <Ghost className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-muted-foreground text-sm font-medium">Sin resultados</p>
                        </div>
                    </CommandEmpty>

                    {/* PAGES */}
                    {(activeTab === 'all' || activeTab === 'pages') && filteredPages.length > 0 && (
                        <CommandGroup heading="Navegación" className="px-2">
                            {filteredPages.map((page) => (
                                <CommandItem
                                    key={page.path}
                                    onSelect={() => handleSelect(() => navigate(page.path))}
                                    className="group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer aria-selected:bg-zinc-100 dark:aria-selected:bg-zinc-800 mb-1"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 border border-border/40 text-muted-foreground group-aria-selected:text-foreground group-aria-selected:border-foreground/20 transition-colors">
                                        <page.icon className="h-4 w-4" weight="LineDuotone" />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="font-bold text-xs opacity-90 group-aria-selected:opacity-100">{page.name}</span>
                                        <span className="text-[10px] text-muted-foreground line-clamp-1 group-aria-selected:text-muted-foreground/80">{page.desc}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* BRANCHES */}
                    {(activeTab === 'all' || activeTab === 'branches') && filteredBranches.length > 0 && (
                        <CommandGroup heading="Sucursales" className="px-2 mt-2">
                            {filteredBranches.map((branch) => (
                                <CommandItem
                                    key={branch.name}
                                    onSelect={() => handleSelect(() => navigate(`/reports?branch=${branch.name}`))}
                                    className="group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer aria-selected:bg-zinc-100 dark:aria-selected:bg-zinc-800 mb-1"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 border border-border/40 text-muted-foreground group-aria-selected:text-foreground group-aria-selected:border-foreground/20">
                                        <Buildings className="h-4 w-4" weight="LineDuotone" />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="font-bold text-xs opacity-90 group-aria-selected:opacity-100">Farmacia {branch.name}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-40 group-aria-selected:opacity-60">Sucursal</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* USERS */}
                    {(activeTab === 'all' || activeTab === 'users') && filteredUsers.length > 0 && (
                        <CommandGroup heading="Usuarios" className="px-2 mt-2">
                            {filteredUsers.map((user) => (
                                <CommandItem
                                    key={user.username}
                                    onSelect={() => handleSelect(() => navigate(`/admin/users?search=${user.username}`))}
                                    className="group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer aria-selected:bg-zinc-100 dark:aria-selected:bg-zinc-800 mb-1"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 border border-border/40 text-muted-foreground group-aria-selected:text-foreground group-aria-selected:border-foreground/20">
                                        {user.role === 'mod' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="font-bold text-xs opacity-90 group-aria-selected:opacity-100">{user.name}</span>
                                        <span className="text-[10px] text-muted-foreground group-aria-selected:text-muted-foreground/80">@{user.username} {user.role === 'mod' ? '(Admin)' : ''}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* PRODUCTS */}
                    {(activeTab === 'all' || activeTab === 'products') && filteredProducts.length > 0 && (
                        <CommandGroup heading="Productos" className="px-2 mt-2">
                            {filteredProducts.map((product: any) => (
                                <CommandItem
                                    key={product.ean}
                                    onSelect={() => handleSelect(() => navigate(`/products?search=${product.ean}`))}
                                    className="group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer aria-selected:bg-zinc-100 dark:aria-selected:bg-zinc-800 mb-1"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 border border-border/40 text-muted-foreground group-aria-selected:text-foreground group-aria-selected:border-foreground/20">
                                        <Box className="h-4 w-4" weight="LineDuotone" />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="font-bold text-xs truncate uppercase opacity-90 group-aria-selected:opacity-100">{product.description}</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-mono text-muted-foreground opacity-60 group-aria-selected:opacity-80">{product.ean}</span>
                                            <span className="text-[9px] text-muted-foreground/70 truncate group-aria-selected:text-muted-foreground/90">{product.laboratory}</span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* ACTIONS */}
                    {(activeTab === 'all') && (
                        <CommandGroup heading="Sistema" className="px-2 mt-2">
                            <CommandItem
                                onSelect={() => handleSelect(() => window.location.reload())}
                                className="group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer aria-selected:bg-zinc-100 dark:aria-selected:bg-zinc-800 mb-1"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 border border-border/40 text-muted-foreground group-aria-selected:text-foreground group-aria-selected:border-foreground/20">
                                    <RefreshCw className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-xs opacity-90 group-aria-selected:opacity-100">Sincronizar</span>
                                    <span className="text-[10px] text-muted-foreground group-aria-selected:text-muted-foreground/80">Actualizar base de datos local</span>
                                </div>
                            </CommandItem>
                        </CommandGroup>
                    )}
                </CommandList>

                {/* Minimal Footer */}
                <div className="flex items-center justify-center p-3 border-t border-border/20 bg-muted/10 text-[9px] uppercase tracking-widest font-black text-muted-foreground/30 px-6">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5 focus:outline-none select-none">
                            <span className="px-1 py-0.5 rounded bg-muted/40 border border-border/20">↑↓</span> NAVEGAR
                        </span>
                        <span className="flex items-center gap-1.5 focus:outline-none select-none">
                            <span className="px-1 py-0.5 rounded bg-muted/40 border border-border/20">ENTER</span> SELECCIONAR
                        </span>
                    </div>
                </div>
            </div>
        </CommandDialog>
    );
}

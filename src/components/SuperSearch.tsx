import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Command,
    CommandDialog,
    CommandDialogPopup,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandPanel,
    CommandFooter,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { 
    ArrowUpIcon, 
    ArrowDownIcon, 
    CornerDownLeftIcon 
} from "lucide-react";
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
        <CommandDialog onOpenChange={onOpenChange} open={open}>
            <CommandDialogPopup>
                <Command className="bg-transparent border-none">
                    {/* Search Bar Area */}
                    <div className="flex items-center justify-between gap-2 pr-4">
                        <CommandInput
                            placeholder="Buscar productos, sucursales..."
                            value={searchTerm}
                            onValueChange={setSearchTerm}
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
                            <KbdGroup className="hidden sm:flex">
                                <Kbd>ESC</Kbd>
                            </KbdGroup>
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

                    <CommandPanel>
                        <CommandList>
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
                                        >
                                            <span className="flex-1">{page.name}</span>
                                            <CommandShortcut>{page.desc}</CommandShortcut>
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
                                        >
                                            <span className="flex-1">Farmacia {branch.name}</span>
                                            <CommandShortcut>Sucursal</CommandShortcut>
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
                                        >
                                            <span className="flex-1">{user.name}</span>
                                            <CommandShortcut>@{user.username} {user.role === 'mod' ? '(Admin)' : ''}</CommandShortcut>
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
                                        >
                                            <span className="flex-1 truncate uppercase pr-4">{product.description}</span>
                                            <CommandShortcut>{product.ean}</CommandShortcut>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {/* ACTIONS */}
                            {(activeTab === 'all') && (
                                <CommandGroup heading="Sistema" className="px-2 mt-2">
                                    <CommandItem
                                        onSelect={() => handleSelect(() => window.location.reload())}
                                    >
                                        <span className="flex-1">Sincronizar base de datos</span>
                                        <CommandShortcut>↻ Actualizar</CommandShortcut>
                                    </CommandItem>
                                </CommandGroup>
                            )}
                        </CommandList>
                    </CommandPanel>

                    <CommandFooter>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <KbdGroup>
                                    <Kbd>
                                        <ArrowUpIcon className="w-3 h-3" />
                                    </Kbd>
                                    <Kbd>
                                        <ArrowDownIcon className="w-3 h-3" />
                                    </Kbd>
                                </KbdGroup>
                                <span>Navegar</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Kbd>
                                    <CornerDownLeftIcon className="w-3 h-3" />
                                </Kbd>
                                <span>Abrir</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Kbd>Esc</Kbd>
                            <span>Cerrar</span>
                        </div>
                    </CommandFooter>
                </Command>
            </CommandDialogPopup>
        </CommandDialog>
    );
}

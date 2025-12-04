import { useEffect, useState } from "react";
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
    Zap,
    RefreshCw,
    FileDown,
} from "lucide-react";
import { getAllProducts } from "@/services/preCountDB";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";

interface GlobalSearchCommandProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const pages = [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "Importar Inventario", path: "/stock", icon: Upload },
    { name: "Inventarios Cíclicos", path: "/cyclic-inventory", icon: BarChart3 },
    { name: "Productos", path: "/products", icon: Package },
    { name: "Reportes", path: "/reports", icon: FileText },
];

export function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [laboratories, setLaboratories] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const allProducts = await getAllProducts();
                setProducts(allProducts.slice(0, 10)); // Limit to 10 for performance

                const inventories = cyclicInventoryService.getAllCyclicInventories();
                const uniqueLabs = [...new Set(inventories.map(inv => inv.laboratory))];
                setLaboratories(uniqueLabs);
            } catch (error) {
                console.error("Error loading search data:", error);
            }
        };

        if (open) {
            loadData();
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

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Buscar páginas, productos, laboratorios..." />
            <CommandList>
                <CommandEmpty>No se encontraron resultados.</CommandEmpty>

                <CommandGroup heading="Páginas">
                    {pages.map((page) => (
                        <CommandItem
                            key={page.path}
                            onSelect={() => handleSelect(() => navigate(page.path))}
                        >
                            <page.icon className="mr-2 h-4 w-4" />
                            <span>{page.name}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandSeparator />

                {products.length > 0 && (
                    <>
                        <CommandGroup heading="Productos">
                            {products.map((product) => (
                                <CommandItem
                                    key={product.ean}
                                    onSelect={() => handleSelect(() => navigate(`/products?search=${product.ean}`))}
                                >
                                    <Box className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{product.description}</span>
                                        <span className="text-xs text-muted-foreground">EAN: {product.ean}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {laboratories.length > 0 && (
                    <>
                        <CommandGroup heading="Laboratorios">
                            {laboratories.map((lab) => (
                                <CommandItem
                                    key={lab}
                                    onSelect={() => handleSelect(() => navigate(`/cyclic-inventory?lab=${lab}`))}
                                >
                                    <Beaker className="mr-2 h-4 w-4" />
                                    <span>{lab}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                <CommandGroup heading="Acciones Rápidas">
                    <CommandItem onSelect={() => handleSelect(() => window.location.reload())}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        <span>Sincronizar Datos</span>
                    </CommandItem>
                    <CommandItem onSelect={() => handleSelect(() => navigate("/stock"))}>
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Exportar Inventario</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}

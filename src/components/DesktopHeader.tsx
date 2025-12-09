import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearchCommand } from "@/components/GlobalSearchCommand";
import { SyncStatusButton } from "@/components/SyncStatusButton";

// Mapping de rutas a títulos
const routeTitles: Record<string, string> = {
    "/": "Dashboard",
    "/stock": "Gestión de Stock",
    "/stock/pre-count": "Pre-Conteo Sucursal",
    "/stock/expiration-control": "Control de Vencimientos",
    "/stock/import": "Importar Inventario",
    "/cyclic-inventory": "Inventarios Cíclicos",
    "/products": "Productos",
    "/reports": "Reportes",
    "/settings": "Configuración",
    "/profile": "Perfil",
};

export function DesktopHeader() {
    const [searchOpen, setSearchOpen] = useState(false);
    const location = useLocation();

    // Obtener el título basado en la ruta actual
    const pageTitle = routeTitles[location.pathname] || "Dashboard";

    return (
        <>
            <header className="h-16 border-b border-border/40 bg-background/50 backdrop-blur-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto w-full h-full px-6 flex items-center justify-between">
                    {/* Left: Title/Breadcrumb */}
                    <div className="text-foreground">
                        <span className="text-sm font-semibold">{pageTitle}</span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Sync Status Button */}
                        <SyncStatusButton />

                        {/* Search Trigger */}
                        <Button
                            variant="outline"
                            className="relative w-64 justify-start text-sm text-muted-foreground h-9 px-3"
                            onClick={() => setSearchOpen(true)}
                        >
                            <Search className="mr-2 h-4 w-4" />
                            <span>Buscar todo...</span>
                            <div className="absolute right-2.5 flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground border border-border/50 rounded px-1.5 py-0.5 bg-background/50">
                                <span>Ctrl+K</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Global Search Command Palette */}
            <GlobalSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}

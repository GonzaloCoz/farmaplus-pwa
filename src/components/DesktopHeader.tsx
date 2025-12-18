
import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SuperSearch } from "@/components/SuperSearch";
import { SyncStatusButton } from "@/components/SyncStatusButton";

// Mapping de segmentos a títulos
const pathTitles: Record<string, string> = {
    "dashboard": "Dashboard",
    "stock": "Gestión de Stock",
    "pre-count": "Pre-Conteo Sucursal",
    "expiration-control": "Control de Vencimientos",
    "import": "Importar Inventario",
    "cyclic-inventory": "Inventarios Cíclicos",
    "products": "Productos",
    "reports": "Reportes",
    "settings": "Configuración",
    "profile": "Perfil",
    "admin": "Admin",
    "branches": "Sucursales",
    "smart-analyst": "Analista Inteligente"
};

export function DesktopHeader() {
    const [searchOpen, setSearchOpen] = useState(false);
    const location = useLocation();

    // Generar breadcrumbs
    const pathSegments = location.pathname.split('/').filter(Boolean);

    // Si estamos en root
    const breadcrumbs = pathSegments.length > 0
        ? pathSegments.map((segment, index) => {
            const path = `/${pathSegments.slice(0, index + 1).join('/')}`;
            const title = pathTitles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
            return { title, path, isLast: index === pathSegments.length - 1 };
        })
        : [{ title: 'Dashboard', path: '/', isLast: true }];

    return (
        <>
            <header className="h-16 border-b border-border/40 bg-background/50 backdrop-blur-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto w-full h-full px-6 flex items-center justify-between">
                    {/* Left: Breadcrumbs */}
                    <div className="flex items-center text-foreground">
                        {breadcrumbs.map((crumb, index) => (
                            <div key={crumb.path} className="flex items-center">
                                {index > 0 && <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />}
                                {crumb.isLast ? (
                                    <span className="text-sm font-semibold">{crumb.title}</span>
                                ) : (
                                    <Link
                                        to={crumb.path}
                                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {crumb.title}
                                    </Link>
                                )}
                            </div>
                        ))}
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
            <SuperSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}

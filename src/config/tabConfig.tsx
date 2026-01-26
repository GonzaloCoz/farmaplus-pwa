
import React from "react";
import { LayoutDashboard, Database, ClipboardList, Package, FileText, Settings, User, BarChart2, ShieldCheck, Microscope } from "lucide-react";

export const TAB_CONFIG: Record<string, { title: string, icon: React.ReactNode }> = {
    "/": { title: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    "/stock": { title: "Gestión de Stock", icon: <Database className="w-4 h-4" /> },
    "/stock/pre-count": { title: "Pre-Conteo", icon: <ClipboardList className="w-4 h-4" /> },
    "/stock/import": { title: "Importar", icon: <Package className="w-4 h-4" /> },
    "/cyclic-inventory": { title: "Inv. Cíclicos", icon: <ClipboardList className="w-4 h-4" /> },
    "/products": { title: "Productos", icon: <Package className="w-4 h-4" /> },
    "/reports": { title: "Reportes", icon: <BarChart2 className="w-4 h-4" /> },
    "/settings": { title: "Configuración", icon: <Settings className="w-4 h-4" /> },
    "/profile": { title: "Perfil", icon: <User className="w-4 h-4" /> },
    "/admin/audit": { title: "Auditoría", icon: <ShieldCheck className="w-4 h-4" /> },
    "/smart-analyst": { title: "Analista", icon: <Microscope className="w-4 h-4" /> },
};

export const getTabMetaForPath = (path: string) => {
    // Exact match
    if (TAB_CONFIG[path]) return TAB_CONFIG[path];

    // Dynamic routes (e.g. /cyclic-inventory/123)
    if (path.startsWith('/cyclic-inventory/')) {
        return { title: "Detalle Inventario", icon: <ClipboardList className="w-4 h-4" /> };
    }

    // Default
    return {
        title: path.split('/').pop() || "Página",
        icon: <FileText className="w-4 h-4" />
    };
};

import React from "react";
import { HomeSmile as Home, Upload01 as Upload, BarChart01 as BarChart3, Box as Package, File01 as FileText, Settings01 as Settings, TrendUp01 as TrendingUp, ShieldTick as ShieldCheck, Clock } from '@untitledui/icons';
import { ZebraIcon } from "@/components/icons/ZebraIcon";

export const TAB_CONFIG: Record<string, { title: string, icon: React.ReactNode }> = {
    "/": { title: "Dashboard", icon: <Home size={16} /> },
    "/stock": { title: "Stock", icon: <Upload size={16} /> },
    "/stock/pre-count": { title: "Colector de Datos", icon: <ZebraIcon className="w-4 h-4" /> },
    "/stock/import": { title: "Importar", icon: <Package size={16} /> },
    "/stock/expiration-control": { title: "Control de Vencimiento", icon: <Clock size={16} /> },
    "/cyclic-inventory": { title: "Inventarios Cíclicos", icon: <BarChart3 size={16} /> },
    "/comparison": { title: "Comparativa", icon: <TrendingUp size={16} /> },
    "/reports": { title: "Reportes", icon: <FileText size={16} /> },
    "/settings": { title: "Configuración", icon: <Settings size={16} /> },
    "/admin/audit": { title: "Auditoría", icon: <ShieldCheck size={16} /> },
    "/smart-analyst": { title: "Control de Vencimiento", icon: <Clock size={16} /> },
    "/inventory-reminder": { title: "Próximo Inventario", icon: <Clock size={16} /> },
    "/foro": { title: "Centro de Capacitación", icon: <FileText size={16} /> },
    "/showcase": { title: "🧪 Componentes", icon: <Settings size={16} /> },
};

export const getTabMetaForPath = (path: string) => {
    // Exact match
    if (TAB_CONFIG[path]) return TAB_CONFIG[path];

    // Dynamic routes (e.g. /cyclic-inventory/123)
    if (path.startsWith('/cyclic-inventory/')) {
        return { title: "Detalle Inventario", icon: <BarChart3 size={16} /> };
    }

    if (path.startsWith('/foro/')) {
        return { title: "Publicación", icon: <FileText size={16} /> };
    }

    // Default
    return {
        title: path.split('/').pop() || "Página",
        icon: <FileText size={16} />
    };
};

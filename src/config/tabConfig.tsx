
import React from "react";
import { Home, Upload, Chart as BarChart3, Box as Package, Document as FileText, Settings, GraphUp as TrendingUp, ShieldCheck, ClockCircle as Clock } from "@solar-icons/react";
import { ZebraIcon } from "@/components/icons/ZebraIcon";

export const TAB_CONFIG: Record<string, { title: string, icon: React.ReactNode }> = {
    "/": { title: "Dashboard", icon: <Home size={16} weight="LineDuotone" /> },
    "/stock": { title: "Stock", icon: <Upload size={16} weight="LineDuotone" /> },
    "/stock/pre-count": { title: "Colector de Datos", icon: <ZebraIcon className="w-4 h-4" /> },
    "/stock/import": { title: "Importar", icon: <Package size={16} weight="LineDuotone" /> },
    "/stock/expiration-control": { title: "Control de Vencimiento", icon: <Clock size={16} weight="LineDuotone" /> },
    "/cyclic-inventory": { title: "Inventarios Cíclicos", icon: <BarChart3 size={16} weight="LineDuotone" /> },
    "/comparison": { title: "Comparativa", icon: <TrendingUp size={16} weight="LineDuotone" /> },
    "/products": { title: "Productos", icon: <Package size={16} weight="LineDuotone" /> },
    "/reports": { title: "Reportes", icon: <FileText size={16} weight="LineDuotone" /> },
    "/settings": { title: "Configuración", icon: <Settings size={16} weight="LineDuotone" /> },
    "/admin/audit": { title: "Auditoría", icon: <ShieldCheck size={16} weight="LineDuotone" /> },
    "/smart-analyst": { title: "Control de Vencimiento", icon: <Clock size={16} weight="LineDuotone" /> },
    "/inventory-reminder": { title: "Próximo Inventario", icon: <Clock size={16} weight="LineDuotone" /> },
    "/foro": { title: "Centro de Capacitación", icon: <FileText size={16} weight="LineDuotone" /> },
};

export const getTabMetaForPath = (path: string) => {
    // Exact match
    if (TAB_CONFIG[path]) return TAB_CONFIG[path];

    // Dynamic routes (e.g. /cyclic-inventory/123)
    if (path.startsWith('/cyclic-inventory/')) {
        return { title: "Detalle Inventario", icon: <BarChart3 size={16} weight="LineDuotone" /> };
    }

    if (path.startsWith('/foro/')) {
        return { title: "Publicación", icon: <FileText size={16} weight="LineDuotone" /> };
    }

    // Default
    return {
        title: path.split('/').pop() || "Página",
        icon: <FileText size={16} weight="LineDuotone" />
    };
};

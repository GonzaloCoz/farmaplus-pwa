
import React from "react";
import { Widget as LayoutDashboard, Database, ClipboardList, Box as Package, Document as FileText, Settings, User, Chart as BarChart2, ShieldCheck, ClockCircle as Clock } from "@solar-icons/react";
import { ZebraIcon } from "@/components/icons/ZebraIcon";

export const TAB_CONFIG: Record<string, { title: string, icon: React.ReactNode }> = {
    "/": { title: "Dashboard", icon: <LayoutDashboard size={16} weight="LineDuotone" /> },
    "/stock": { title: "Gestión de Stock", icon: <Database size={16} weight="LineDuotone" /> },
    "/stock/pre-count": { title: "Colector de Datos", icon: <ZebraIcon className="w-4 h-4" /> },
    "/stock/import": { title: "Importar", icon: <Package size={16} weight="LineDuotone" /> },
    "/stock/expiration-control": { title: "Control de Vencimiento", icon: <Clock size={16} weight="LineDuotone" /> },
    "/cyclic-inventory": { title: "Inv. Cíclicos", icon: <ClipboardList size={16} weight="LineDuotone" /> },
    "/products": { title: "Productos", icon: <Package size={16} weight="LineDuotone" /> },
    "/reports": { title: "Reportes", icon: <BarChart2 size={16} weight="LineDuotone" /> },
    "/settings": { title: "Configuración", icon: <Settings size={16} weight="LineDuotone" /> },
    "/profile": { title: "Perfil", icon: <User size={16} weight="LineDuotone" /> },
    "/admin/audit": { title: "Auditoría", icon: <ShieldCheck size={16} weight="LineDuotone" /> },
    "/smart-analyst": { title: "Control de Vencimiento", icon: <Clock size={16} weight="LineDuotone" /> },
};

export const getTabMetaForPath = (path: string) => {
    // Exact match
    if (TAB_CONFIG[path]) return TAB_CONFIG[path];

    // Dynamic routes (e.g. /cyclic-inventory/123)
    if (path.startsWith('/cyclic-inventory/')) {
        return { title: "Detalle Inventario", icon: <ClipboardList size={16} /> };
    }

    // Default
    return {
        title: path.split('/').pop() || "Página",
        icon: <FileText size={16} weight="LineDuotone" />
    };
};

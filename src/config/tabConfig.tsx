import React from "react";
import { HomeSmile as Home, Upload01 as Upload, BarChart01 as BarChart3, Box as Package, File02 as FileText, Settings01 as Settings, TrendUp01 as TrendingUp, ShieldTick as ShieldCheck, Clock, User01 as Users, Building01 as Building, Zap, FileSearch02 } from '@untitledui/icons';
import { ZebraIcon } from "@/components/icons/ZebraIcon";

export const TAB_CONFIG: Record<string, { title: string, icon: React.ReactNode }> = {
    // Inicio
    "/": { title: "Inicio", icon: <Home size={16} /> },

    // Solicitudes
    "/solicitudes": { title: "Solicitudes", icon: <FileSearch02 size={16} /> },

    // Stock & Colectores
    "/stock": { title: "Stock", icon: <Upload size={16} /> },
    "/stock/colector": { title: "Colector de Datos", icon: <ZebraIcon className="w-4 h-4" /> },
    "/stock/recuento-movil": { title: "Recuento Móvil", icon: <ZebraIcon className="w-4 h-4" /> },
    "/stock/control-vencimiento": { title: "Control de Vencimiento", icon: <Clock size={16} /> },
    "/stock/importar": { title: "Importar Stock", icon: <Upload size={16} /> },
    "/colector": { title: "Colector Zebra", icon: <ZebraIcon className="w-4 h-4" /> },

    // Inventarios Cíclicos
    "/inventario-ciclico": { title: "Inventarios Cíclicos", icon: <BarChart3 size={16} /> },

    // Vencimientos & Recordatorio
    "/control-vencimiento": { title: "Control de Vencimiento", icon: <Clock size={16} /> },
    "/recordatorio-inventario": { title: "Próximo Inventario", icon: <Clock size={16} /> },

    // Comparativa & Reportes
    "/comparativa": { title: "Comparativa", icon: <TrendingUp size={16} /> },
    "/reportes": { title: "Reportes", icon: <FileText size={16} /> },

    // Configuración & Administración
    "/configuracion": { title: "Configuración", icon: <Settings size={16} /> },
    "/admin/auditoria": { title: "Auditoría", icon: <ShieldCheck size={16} /> },
    "/admin/usuarios": { title: "Usuarios", icon: <Users size={16} /> },
    "/admin/sucursales": { title: "Sucursales", icon: <Building size={16} /> },

    // Foro / Capacitación
    "/foro": { title: "Capacitación", icon: <FileText size={16} /> },
    "/foro/admin/edit": { title: "Editor de Recursos", icon: <FileText size={16} /> },
};

export const getTabMetaForPath = (path: string) => {
    // Exact match
    if (TAB_CONFIG[path]) return TAB_CONFIG[path];

    // Dynamic routes
    if (path.startsWith('/inventario-ciclico/')) {
        return { title: "Detalle de Inventario", icon: <BarChart3 size={16} /> };
    }

    if (path.startsWith('/reportes/')) {
        return { title: "Detalle de Reporte", icon: <FileText size={16} /> };
    }

    if (path.startsWith('/foro/')) {
        if (path.includes('/admin/edit/')) {
            return { title: "Editar Recurso", icon: <FileText size={16} /> };
        }
        return { title: "Publicación", icon: <FileText size={16} /> };
    }

    // Default
    return {
        title: "Página",
        icon: <FileText size={16} />
    };
};

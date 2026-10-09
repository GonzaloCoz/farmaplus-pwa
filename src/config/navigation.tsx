import React, { type ComponentType } from "react";
import {
  HomeSmile as Home,
  File02 as FileText,
  TrendUp01 as TrendingUp,
  FileSearch02,
  Settings01 as Settings,
  ShieldTick as ShieldCheck,
  User01 as Users,
  Building01 as Building,
  LayoutGrid01 as LayoutGrid,
  BarChart01 as BarChart3,
} from "@untitledui/icons";
import { Terminal } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import GitCompareArrowsIcon from "@hugeicons/core-free-icons/GitCompareArrowsIcon";
import CatalogueIcon from "@hugeicons/core-free-icons/CatalogueIcon";
import DateTimeIcon from "@hugeicons/core-free-icons/DateTimeIcon";
import { ZebraIcon } from "@/components/icons/ZebraIcon";

/**
 * Adapter to render any HugeIcon seamlessly in Sidebars, Navbars, and Tabs.
 */
export function createHugeIcon(iconDef: any, defaultStroke = 1.8) {
  return function HugeIconAdapter({ className, size = 18, weight, ...props }: any) {
    return (
      <HugeiconsIcon
        icon={iconDef}
        size={size}
        strokeWidth={defaultStroke}
        className={className}
        {...props}
      />
    );
  };
}

export const GitCompareArrows = createHugeIcon(GitCompareArrowsIcon);
export const Catalogue = createHugeIcon(CatalogueIcon);
export const DateTime = createHugeIcon(DateTimeIcon);

export interface NavItemConfig {
  title: string;
  shortLabel?: string;
  url: string;
  icon: ComponentType<any>;
  roles?: readonly ("admin" | "mod" | "branch")[];
  onlyUsername?: string;
  inSidebar?: boolean;
  inBottomNav?: boolean;
  comingSoon?: boolean;
}

/**
 * Single Source of Truth for App Navigation & Menu Icons.
 * Changing an icon or route here updates AppSidebar, BottomNavBar, and Tab headers.
 */
export const APP_NAVIGATION: NavItemConfig[] = [
  {
    title: "Inicio",
    shortLabel: "Inicio",
    url: "/",
    icon: Home,
    inSidebar: true,
    inBottomNav: true,
  },
  {
    title: "Stock",
    shortLabel: "Stock",
    url: "/stock/colector",
    icon: Catalogue,
    inSidebar: true,
    inBottomNav: true,
  },
  {
    title: "Control de Vencimiento",
    shortLabel: "Vencimiento",
    url: "/control-vencimiento",
    icon: DateTime,
    inSidebar: true,
  },
  {
    title: "Inventarios Cíclicos",
    shortLabel: "Cíclico",
    url: "/inventario-ciclico",
    icon: GitCompareArrows,
    inSidebar: true,
    inBottomNav: true,
  },
  {
    title: "Solicitudes",
    shortLabel: "Solicitudes",
    url: "/solicitudes",
    icon: FileSearch02,
    inSidebar: true,
  },

  {
    title: "Terminal Ventas (Live)",
    shortLabel: "Terminal",
    url: "/terminal-ventas",
    icon: Terminal,
    onlyUsername: "gcoz",
    inSidebar: true,
  },
];

/** Items filtered for Desktop Sidebar */
export const SIDEBAR_MENU_ITEMS = APP_NAVIGATION.filter((item) => item.inSidebar !== false);

/** Items filtered for Mobile Bottom Nav */
export const BOTTOM_NAV_ITEMS = APP_NAVIGATION.filter((item) => item.inBottomNav === true);

/** Additional paths for Tab headers */
const EXTRA_TAB_CONFIG: Record<string, { title: string; icon: React.ReactNode }> = {
  "/stock": { title: "Stock", icon: <Catalogue size={16} /> },
  "/stock/colector": { title: "Stock", icon: <Catalogue size={16} /> },
  "/stock/recuento-movil": { title: "Recuento Móvil", icon: <ZebraIcon className="w-4 h-4" /> },
  "/stock/control-vencimiento": { title: "Control de Vencimiento", icon: <DateTime size={16} /> },
  "/colector": { title: "Colector Zebra", icon: <ZebraIcon className="w-4 h-4" /> },
  "/configuracion": { title: "Configuración", icon: <Settings size={16} /> },
  "/admin/auditoria": { title: "Auditoría", icon: <ShieldCheck size={16} /> },
  "/admin/usuarios": { title: "Usuarios", icon: <Users size={16} /> },
  "/admin/sucursales": { title: "Sucursales", icon: <Building size={16} /> },
  "/foro": { title: "Capacitación", icon: <FileText size={16} /> },
  "/foro/admin/edit": { title: "Editor de Recursos", icon: <FileText size={16} /> },
};

/** Unified TAB_CONFIG */
export const TAB_CONFIG: Record<string, { title: string; icon: React.ReactNode }> = {
  ...Object.fromEntries(
    APP_NAVIGATION.map((item) => {
      const IconComponent = item.icon;
      return [item.url, { title: item.title, icon: <IconComponent size={16} className="w-4 h-4" /> }];
    })
  ),
  ...EXTRA_TAB_CONFIG,
};

export const getTabMetaForPath = (path: string = "") => {
  if (!path) return { title: "Página", icon: <FileText size={16} /> };
  if (TAB_CONFIG[path]) return TAB_CONFIG[path];

  if (path.startsWith("/inventario-ciclico/")) {
    return { title: "Detalle de Inventario", icon: <GitCompareArrows size={16} className="w-4 h-4" /> };
  }


  if (path.startsWith("/foro/")) {
    if (path.includes("/admin/edit/")) {
      return { title: "Editar Recurso", icon: <FileText size={16} /> };
    }
    return { title: "Publicación", icon: <FileText size={16} /> };
  }

  return {
    title: "Página",
    icon: <FileText size={16} />,
  };
};

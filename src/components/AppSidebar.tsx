import { Home, Upload, BarChart3, Package, FileText, Settings, User, Bell, LucideIcon, TrendingUp, Archive } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LogoExpanded from "@/assets/logotxt.svg";
import LogoCollapsed from "@/assets/logo.svg";
import { NotificationsMenu, SettingsMenu, UserMenu } from "@/components/HeaderMenus";

// Usamos marcado simple para el sidebar (evita wrappers que insertan espacio inesperado)

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Stock", url: "/stock", icon: Upload },
  { title: "Inventarios Cíclicos", url: "/cyclic-inventory", icon: BarChart3 },
  { title: "Comparativa", url: "/comparison", icon: TrendingUp },
  { title: "Productos", url: "/products", icon: Package },
  { title: "Reportes", url: "/reports", icon: FileText },
];

interface FooterMenuItem {
  title: string; url: string; icon: LucideIcon
}

// Footer menus ahora utilizan los menús flotantes reutilizables

interface AppSidebarMenuItemProps {
  item: {
    title: string;
    url: string;
    icon: LucideIcon;
    notification?: boolean;
  };
  end?: boolean;
}

function AppSidebarMenuItem({ item, end }: AppSidebarMenuItemProps) {
  return (
    <NavLink
      to={item.url}
      end={end}
      aria-label={item.title}
      className={({ isActive }) => cn(
        "group flex items-center gap-[14px] px-[18px] py-[10px] mx-3 rounded-[12px] transition-all duration-200",
        "text-gray-900 dark:text-gray-100 font-semibold",
        isActive
          ? "bg-white dark:bg-[#1e1e1e] text-black dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] ring-1 ring-gray-100/50 dark:ring-white/5"
          : "hover:bg-gray-100/80 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
      )}
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn(
            "h-5 w-5 transition-colors",
            isActive
              ? "text-black dark:text-white"
              : "text-gray-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white"
          )} />
          <span className={cn(
            "text-sm tracking-tight transition-colors",
            isActive
              ? "text-black dark:text-white"
              : "text-gray-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white"
          )}>{item.title}</span>
        </>
      )}
    </NavLink>
  );
}

function AppSidebarMenuItemMobile({ item, end }: AppSidebarMenuItemProps) {
  return (
    <NavLink
      to={item.url}
      end={end}
      aria-label={item.title}
      className={({ isActive }) => cn(
        "flex items-center gap-4 rounded-md px-4 py-2 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive && "bg-primary text-primary-foreground"
      )}
    >
      <item.icon className="h-5 w-5" />
      <span className="flex-1 whitespace-nowrap">{item.title}</span>
    </NavLink>
  );
}

import { useUser } from "@/contexts/UserContext";

export function AppSidebar() {
  const { user } = useUser();

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] bg-transparent pt-3 pb-6 h-full transition-all">
        <div className="px-8 mb-4">
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.1em]">
            Menú Principal
          </h2>
        </div>

        <nav className="flex-1 overflow-auto py-2 flex flex-col gap-1">
          {menuItems.map((item) => (
            <AppSidebarMenuItem
              key={item.title}
              item={item}
              end={item.url === '/'}
            />
          ))}
        </nav>
      </aside>
    </>
  )
}

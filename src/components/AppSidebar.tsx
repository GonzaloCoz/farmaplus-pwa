import { Home, Upload, BarChart3, Package, FileText, Settings, User, Bell, LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LogoExpanded from "@/assets/logotxt.svg";
import LogoCollapsed from "@/assets/logo.svg";
import { NotificationsMenu, SettingsMenu, UserMenu } from "@/components/HeaderMenus";
import { ThemeToggle } from "@/components/ThemeToggle";

// Usamos marcado simple para el sidebar (evita wrappers que insertan espacio inesperado)

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Stock", url: "/stock", icon: Upload },
  { title: "Inventarios Cíclicos", url: "/cyclic-inventory", icon: BarChart3 },
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
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full">
          <NavLink
            to={item.url}
            end={end}
            aria-label={item.title}
            className={({ isActive }) => cn(
              "flex h-full w-full items-center justify-center rounded-xl text-foreground/60 transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-sm",
              isActive && "bg-muted text-foreground shadow-sm"
            )}
          >
            <item.icon className="h-4 w-4 leading-none" />
          </NavLink>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{item.title}</p>
      </TooltipContent>
    </Tooltip>
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
      {/* Sin puntos de notificación aquí para evitar elementos decorativos inesperados */}
    </NavLink>
  );
}

export function AppSidebar() {
  return (
    <>
      {/* Se muestra solo en pantallas 'lg' y mayores */}
      <aside className="hidden lg:flex flex-col w-[72px] fixed inset-y-0 left-0 z-20 bg-transparent pt-6 pb-6">
        <div className="flex h-16 items-center justify-center">
          <img src={LogoCollapsed} alt="Logo Farmaplus" className="h-10 w-10" />
        </div>
        <nav className="flex-1 overflow-auto py-4 flex flex-col items-center gap-3">
          {menuItems.map((item) => <AppSidebarMenuItem key={item.title} item={item} end={item.url === '/'} />)}
        </nav>
        <nav className="mt-auto border-t border-border/40 p-3 flex flex-col items-center gap-3">
          <ThemeToggle />
          <NotificationsMenu />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full">
                <NavLink
                  to="/settings"
                  aria-label="Configuración"
                  className={({ isActive }) => cn(
                    "flex h-full w-full items-center justify-center rounded-xl text-foreground/60 transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-sm",
                    isActive && "bg-muted text-foreground shadow-sm"
                  )}
                >
                  <Settings className="h-4 w-4 leading-none" />
                </NavLink>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Configuración</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full">
                <NavLink
                  to="/profile"
                  aria-label="Perfil"
                  className={({ isActive }) => cn(
                    "flex h-full w-full items-center justify-center rounded-xl text-foreground/60 transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-sm",
                    isActive && "bg-muted text-foreground shadow-sm"
                  )}
                >
                  <User className="h-4 w-4 leading-none" />
                </NavLink>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Perfil</p>
            </TooltipContent>
          </Tooltip>
        </nav>
      </aside>
    </>
  )
}

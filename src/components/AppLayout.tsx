import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar";
import { TopAppBar } from "@/components/TopAppBar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { HomeSmile as Home, Scan, BarChart01 as BarChart2, CheckCircle, User01 as User, LayoutGrid01 as Beaker, Box, LayersTwo01 as Layers, LayoutGrid01 as LayoutDashboard, Database01 as Database, Clipboard as ClipboardList, LayoutGrid01 as Package, File02 as FileText, Settings01 as Settings, LifeBuoy02 } from '@untitledui/icons';
import { DesktopHeader } from "@/components/DesktopHeader";
import { SyncStatus } from "@/components/SyncStatus";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { useEffect, useState, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { CommandPalette } from "@/components/motion/command-palette";
import { getLaboratoriesForBranch } from "@/services/productService";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import {
  LayoutDashboard as DashboardIcon,
  BarChart3 as BarChartIcon,
  ClipboardList as ClipboardIcon,
  Scale as ScaleIcon,
  Clock as ClockIcon,
  LogOut as LogOutIcon,
  Settings as SettingsIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WindowRouter } from "@/components/WindowRouter";
import { getTabMetaForPath } from "@/config/tabConfig";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { AppUpdater } from "@/components/AppUpdater";
import { Capacitor } from "@capacitor/core";
import { SurfaceProvider } from "@/lib/surface-context";
import { Elevated } from "@/lib/elevated";
import { FeedbackWidget } from "@/components/motion/feedback-widget";
import { notify } from "@/lib/notifications";

export function AppLayout() {
  const { windows, activeWindowId } = useWindowManager();
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const isNative = Capacitor.isNativePlatform();
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [labs, setLabs] = useState<{ name: string, category: string, round: number }[]>([]);
  const [activeRounds, setActiveRounds] = useState<Record<string, number>>({});

  useEffect(() => {
    const handleOpen = () => setIsSearchOpen(true);
    window.addEventListener("open-command-palette", handleOpen);
    return () => window.removeEventListener("open-command-palette", handleOpen);
  }, []);

  useEffect(() => {
    const branch = user?.branchSheet || user?.branchName;
    if (!branch) {
      setLabs([]);
      setActiveRounds({});
      return;
    }
    Promise.all([
      getLaboratoriesForBranch(branch),
      cyclicInventoryService.getBranchConfig(branch)
    ]).then(([labsData, configData]) => {
      setLabs(labsData || []);
      setActiveRounds(configData?.rounds || {});
    });
  }, [user?.branchSheet, user?.branchName, isSearchOpen]);

  const commandItems = useMemo(() => {
    const items = [
      {
        id: "dashboard",
        label: "Dashboard",
        group: "Navegación",
        hint: "Vista general de métricas",
        icon: DashboardIcon,
        keywords: ["inicio", "home", "metricas", "dashboard"],
        onSelect: () => navigate("/"),
      },
      {
        id: "cyclic-inventory",
        label: "Inventarios Cíclicos",
        group: "Navegación",
        hint: "Ajustes e inventario",
        icon: BarChartIcon,
        keywords: ["inventario", "ciclico", "stock"],
        onSelect: () => navigate("/cyclic-inventory"),
      },
    ];

    if (user?.role === 'admin' || user?.role === 'mod') {
      items.push({
        id: "reports",
        label: "Reportes y Auditoría",
        group: "Navegación",
        hint: "Historial y logs",
        icon: ClipboardIcon,
        keywords: ["reporte", "auditoria", "log"],
        onSelect: () => navigate("/reports"),
      });
    }

    if (user?.role === 'admin') {
      items.push({
        id: "comparison",
        label: "Comparativa",
        group: "Navegación",
        hint: "Comparación de sucursales",
        icon: ScaleIcon,
        keywords: ["comparativa", "comparacion", "sucursales"],
        onSelect: () => navigate("/comparison"),
      });
    }

    items.push(
      {
        id: "expiration-control",
        label: "Control de Vencimiento",
        group: "Navegación",
        hint: "Gestión de vencimientos",
        icon: ClockIcon,
        keywords: ["control", "vencimiento", "fecha"],
        onSelect: () => navigate("/stock/expiration-control"),
      },
      {
        id: "settings",
        label: "Configuración",
        group: "Navegación",
        hint: "Ajustes de la aplicación",
        icon: SettingsIcon,
        keywords: ["configuracion", "ajustes", "preferencias"],
        onSelect: () => navigate("/settings"),
      },
      {
        id: "logout",
        label: "Cerrar sesión",
        group: "Sistema",
        hint: "Salir de la cuenta",
        icon: LogOutIcon,
        keywords: ["salir", "cerrar", "sesion", "logout"],
        onSelect: () => logout(),
      }
    );

    // Map and append active round laboratory items
    const labItems = labs
      .filter((l) => {
        const catNorm = (l.category || '').trim().toUpperCase();
        const activeRound = activeRounds[catNorm] || activeRounds['GENERAL'] || 1;
        return l.round === activeRound;
      })
      .map((l) => ({
        id: `lab-${l.name}-${l.category}`,
        label: l.name,
        group: "Laboratorios",
        hint: l.category.toUpperCase(),
        icon: BarChartIcon,
        keywords: ["laboratorio", l.name.toLowerCase(), "control", "inventario", l.category.toLowerCase()],
        onSelect: () => navigate(`/cyclic-inventory/${encodeURIComponent(l.name)}`),
      }));

    return [...items, ...labItems];
  }, [user, navigate, logout, labs, activeRounds]);

  return (
    <SurfaceProvider value={1}>
      <div className={cn(
        "isolate relative flex h-screen w-full overflow-hidden transition-all duration-500 bg-surface-1 text-foreground"
      )}>
        <div className={cn("flex-1 h-full relative p-0", !isElectron && "lg:p-2")}>
          {/* Outer container - Flat on mobile, framed on desktop */}
          <Elevated
            offset={1}
            className={cn(
              "relative h-full w-full overflow-hidden flex flex-col rounded-none lg:rounded-3xl",
              isElectron && "!bg-transparent !shadow-none !border-none"
            )}
          >
            {/* Header inside outer container */}
            <div className={cn(
              "hidden lg:block",
              isElectron ? "px-2 pt-1 pb-0" : "px-2 pt-1"
            )}>
              <DesktopHeader />
            </div>

            {/* The Wrapper Box (Behind Sidebar and Content) */}
            <Elevated
              offset={1}
              className="flex-1 lg:mx-4 lg:mb-4 lg:mt-0 lg:rounded-2xl border border-border/5 overflow-hidden flex p-0 gap-0 relative"
            >
              <div className="hidden lg:block">
                <AppSidebar />
              </div>

              {/* Main-content - Top-most Floating Dashboard Box (Framed on Desktop, Full on Mobile) */}
              <Elevated
                offset={1}
                className="flex-1 lg:m-2.5 lg:rounded-xl border border-black/[0.03] dark:border-white/[0.03] overflow-hidden flex flex-col z-10 transition-all duration-300"
              >
                <ScrollArea id="main-content" className="flex-1 w-full relative h-full">
                  <ScrollAreaViewport 
                    className="w-full relative lg:px-0 no-scrollbar" 
                  >
                    {/* Render windows as isolated instances */}
                    {windows.map((win) => (
                      <div
                        key={win.id}
                        className={cn(
                          "absolute inset-0 w-full h-full transition-opacity duration-300 overflow-y-auto custom-scrollbar md:no-scrollbar",
                          activeWindowId === win.id ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
                        )}
                        style={{ 
                          paddingTop: 'calc(var(--total-header-height) * var(--is-mobile, 1))',
                          paddingLeft: 'var(--safe-left)',
                          paddingRight: 'var(--safe-right)' 
                        }}
                      >
                        <WindowRouter
                          initialPath={win.path}
                          currentPath={win.path}
                          onPathChange={() => { }} // No-op, sync handled by useEffect
                        />
                      </div>
                    ))}

                    {/* Fallback for cases where no windows exist yet */}
                    {windows.length === 0 && <div className="p-4"><Outlet /></div>}
                  </ScrollAreaViewport>
                  <ScrollAreaScrollbar className="hidden lg:flex" />
                </ScrollArea>
              </Elevated>

              {/* Support & Feedback Widget floating inside sidebar */}
              <FeedbackWidget
                position="bottom-left"
                icon={<LifeBuoy02 className="h-[18px] w-[18px] transition-transform duration-300" />}
                className="hidden lg:block !absolute !bottom-6 !left-4"
                onSubmit={async (data) => {
                  console.log("Feedback received:", data.message);
                  notify.success("Feedback Enviado", "¡Muchas gracias por tus comentarios!");
                }}
              />
            </Elevated>

            <div className="sticky bottom-0 z-10">
              {!isNative && <BottomNavBar />}
            </div>
            {!isNative && <TopAppBar />}
            <SyncStatus />
          </Elevated>
        </div>
        <AppUpdater />
      </div>
      <CommandPalette
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        items={commandItems}
        placeholder="Buscar páginas, sucursales, productos..."
      />
    </SurfaceProvider>
  );
}


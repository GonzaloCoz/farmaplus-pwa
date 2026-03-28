import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar";
import { TopAppBar } from "@/components/TopAppBar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Scanner as Scan, Chart as BarChart2, CheckCircle, User, Widget as Beaker, Box, Layers, Widget as LayoutDashboard, Database, ClipboardList, Widget as Package, Document as FileText, Settings } from "@solar-icons/react";
import { DesktopHeader } from "@/components/DesktopHeader";
import { SyncStatus } from "@/components/SyncStatus";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { WindowRouter } from "@/components/WindowRouter";
import { getTabMetaForPath } from "@/config/tabConfig";
import { AppUpdater } from "@/components/AppUpdater";

export function AppLayout() {
  const { windows, activeWindowId } = useWindowManager();

  return (
    <div className="isolate relative flex h-screen w-full bg-[var(--body-bg)] overflow-hidden transition-all duration-500">
      <div className="flex-1 h-full relative p-0 lg:p-2">
        {/* Outer container - Flat on mobile, framed on desktop */}
        <div className="relative h-full w-full bg-[var(--layout-tray)] rounded-none lg:rounded-[1.5rem] lg:shadow-xl lg:border border-border/40 overflow-hidden flex flex-col">
          {/* Header inside outer container */}
          <div className="hidden lg:block px-2 pt-1">
            <DesktopHeader />
          </div>

          {/* The Wrapper Box (Behind Sidebar and Content) */}
          <div className="flex-1 bg-[var(--layout-wrapper)] lg:m-2 lg:mt-0 lg:rounded-[1.25rem] lg:shadow-sm border border-border/5 overflow-hidden flex p-0 gap-0">
            <div className="hidden lg:block">
              <AppSidebar />
            </div>

            {/* Main-content - Top-most Floating Dashboard Box */}
            <div className="flex-1 bg-[var(--layout-content)] lg:m-2.5 lg:rounded-[1.5rem] lg:shadow-md lg:border border-black/[0.03] dark:border-white/[0.03] overflow-hidden flex flex-col z-10 transition-all duration-300">
              <main id="main-content" className="flex-1 overflow-y-auto w-full relative">
                <div className="lg:hidden h-16" /> {/* Spacer for mobile TopAppBar */}
                <div className="w-full h-full relative px-4 lg:px-0">
                  {/* Render windows as isolated instances */}
                  {windows.map((win) => (
                    <div
                      key={win.id}
                      className={cn(
                        "absolute inset-0 w-full h-full overflow-y-auto transition-opacity duration-300",
                        activeWindowId === win.id ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
                      )}
                    >
                      <WindowRouter
                        initialPath={win.path}
                        currentPath={win.path}
                        onPathChange={() => { }} // No-op, sync handled by useEffect
                      />
                    </div>
                  ))}

                  {/* Fallback for cases where no windows exist yet */}
                  {windows.length === 0 && <Outlet />}
                </div>
              </main>
            </div>
          </div>

          <div className="sticky bottom-0 z-10">
            <BottomNavBar />
          </div>
          <TopAppBar />
          <SyncStatus />
        </div>
      </div>
      <AppUpdater />
    </div>
  );
}

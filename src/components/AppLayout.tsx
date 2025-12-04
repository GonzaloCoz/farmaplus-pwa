import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar";
import { TopAppBar } from "@/components/TopAppBar";
import { Outlet } from "react-router-dom";
import { SyncStatus } from './SyncStatus';
import { DesktopHeader } from "@/components/DesktopHeader";

export function AppLayout() {
  return (
    <div className="flex h-screen w-full bg-muted/40 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 h-full relative p-2 lg:ml-[72px]">
        <div className="relative h-full w-full bg-background rounded-[2rem] shadow-md border border-border/50 overflow-hidden flex flex-col">
          <div className="hidden lg:block">
            <DesktopHeader />
          </div>
          <main id="main-content" className="flex-1 overflow-y-auto w-full relative">
            <div className="lg:hidden h-16" /> {/* Spacer for mobile TopAppBar */}
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
          <div className="sticky bottom-0 z-10">
            <BottomNavBar />
          </div>
          <TopAppBar />
          <SyncStatus />
        </div>
      </div>
    </div>
  );
}

import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar";
import { PageTransition } from "@/components/PageTransition";

import { TopAppBar } from "@/components/TopAppBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 h-full relative overflow-hidden pt-[env(safe-area-inset-top)]">
        <main id="main-content" className="absolute inset-0 overflow-y-auto w-full pb-24 sm:pb-0">
          <div className="lg:hidden h-16" /> {/* Spacer for mobile TopAppBar */}
          <PageTransition>
            {children}
          </PageTransition>
        </main>
        <TopAppBar />
        <BottomNavBar />
      </div>
    </div>
  );
}

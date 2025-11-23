import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar"; // Importar BottomNavBar
import { useIsMobile } from "@/hooks/use-mobile"; // Importar useIsMobile

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile(); // Usar el hook para detectar móvil

  return (
    <div className="relative flex h-[100dvh] w-full bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        {children}
        {isMobile && <BottomNavBar />}
      </div>
    </div>
  );
}

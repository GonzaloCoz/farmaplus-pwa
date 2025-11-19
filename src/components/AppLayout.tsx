import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar"; // Importar BottomNavBar
import { useIsMobile } from "@/hooks/use-mobile"; // Importar useIsMobile

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile(); // Usar el hook para detectar móvil
  
  return (
    <div className="relative flex min-h-screen w-full bg-background">
      <AppSidebar />
      {children}
      {isMobile && <BottomNavBar />} {/* Renderizar BottomNavBar solo en móvil */}
    </div>
  );
}

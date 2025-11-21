import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Package,
  BarChart3,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/import", icon: Upload, label: "Importar" },
  { to: "/cyclic-inventory", icon: FileText, label: "Cíclico" },
  { to: "/products", icon: Package, label: "Productos" },
  { to: "/reports", icon: BarChart3, label: "Reportes" },
];

export function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm sm:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid h-16 grid-cols-5 items-center justify-center text-xs">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 text-muted-foreground transition-all",
                isActive && "text-primary"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex h-8 w-16 items-center justify-center">
                  <div
                    className={cn(
                      "absolute h-8 w-16 scale-0 rounded-full bg-secondary transition-transform",
                      isActive && "scale-100"
                    )}
                  />
                  <Icon
                    className={cn(
                      "relative z-10 h-5 w-5",
                      isActive && "text-primary"
                    )}
                  />
                </div>
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
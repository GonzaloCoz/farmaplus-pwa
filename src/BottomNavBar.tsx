import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Widget as LayoutGrid,
    Upload,
    Document as FileText,
    Box as Package,
    Chart as BarChart3,
} from "@solar-icons/react";
import { useUser } from "@/contexts/UserContext";

const navItems = [
    { to: "/", icon: LayoutGrid, label: "Dashboard" },
    { to: "/stock", icon: Upload, label: "Stock" },
    { to: "/cyclic-inventory", icon: FileText, label: "Cíclico" },
    { to: "/products", icon: Package, label: "Productos", roles: ['admin', 'mod'] as const },
    { to: "/reports", icon: BarChart3, label: "Reportes", roles: ['admin', 'mod'] as const },
];

export function BottomNavBar() {
    const { user } = useUser();

    // Filtrar items según el rol del usuario
    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => {
            if (!('roles' in item)) return true;
            return user?.role ? (item.roles as readonly string[]).includes(user.role) : false;
        });
    }, [user?.role]);
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 w-full border-t bg-background/95 backdrop-blur-sm sm:hidden pb-[env(safe-area-inset-bottom)]">
            <div className="grid h-20 items-center justify-center text-xs" style={{ gridTemplateColumns: `repeat(${filteredNavItems.length}, 1fr)` }}>
                {filteredNavItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors",
                                isActive && "text-primary"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className="relative flex h-8 w-16 items-center justify-center">
                                    <motion.div
                                        className="absolute h-8 w-16 rounded-full bg-secondary"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: isActive ? 1 : 0 }}
                                        transition={{ duration: 0.2, ease: [0.2, 0.0, 0, 1.0] }}
                                    />
                                    <motion.div
                                        animate={{
                                            scale: isActive ? 1.1 : 1,
                                            rotate: isActive ? [0, -10, 10, 0] : 0,
                                        }}
                                        transition={{
                                            duration: 0.3,
                                            ease: [0.2, 0.0, 0, 1.0],
                                        }}
                                    >
                                        <Icon
                                            weight={isActive ? "BoldDuotone" : "LineDuotone"}
                                            className={cn(
                                                "relative z-10 h-5 w-5",
                                                isActive && "text-primary"
                                            )}
                                        />
                                    </motion.div>
                                </div>
                                <motion.span
                                    className="font-medium"
                                    animate={{
                                        scale: isActive ? 1.05 : 1,
                                    }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {label}
                                </motion.span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
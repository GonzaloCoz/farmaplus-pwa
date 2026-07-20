import { NavLink } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LayoutGrid01 as LayoutGrid, Upload01 as Upload, File02 as FileText, Box as Package, BarChart01 as BarChart3 } from '@untitledui/icons';
import { useUser } from "@/contexts/UserContext";
import { ZebraIcon } from "@/components/icons/ZebraIcon";

const navItems = [
    { to: "/", icon: LayoutGrid, label: "Dashboard" },
    { to: "/stock", icon: Upload, label: "Stock" },
    { to: "/cyclic-inventory", icon: FileText, label: "Cíclico" },
    { to: "/reports", icon: BarChart3, label: "Reportes", roles: ['admin', 'mod'] as const },
];

export function BottomNavBar() {
    const { user } = useUser();
    const [isHidden, setIsHidden] = useState(() => {
        return typeof window !== 'undefined' && localStorage.getItem('is_zebra_counting') === 'true';
    });

    useEffect(() => {
        const handleStateChange = () => {
            setIsHidden(localStorage.getItem('is_zebra_counting') === 'true');
        };
        window.addEventListener('zebraCountingStateChange', handleStateChange);
        return () => window.removeEventListener('zebraCountingStateChange', handleStateChange);
    }, []);

    // Filtrar items según el rol del usuario
    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => {
            if (!('roles' in item)) return true;
            return user?.role ? (item.roles as readonly string[]).includes(user.role) : false;
        });
    }, [user?.role]);

    if (isHidden) return null;
    return (
        <nav 
            style={{ paddingBottom: 'var(--safe-bottom)' }}
            className="relative z-50 w-full border-t bg-background backdrop-blur-sm sm:hidden bottom-nav"
        >
            <div className="grid items-center justify-center text-xs" style={{ height: 'var(--nav-height)', gridTemplateColumns: `repeat(${filteredNavItems.length}, 1fr)` }}>
                {filteredNavItems.map(({ to, icon: Icon, label, zebraIcon }: any) => (
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
                                        {zebraIcon ? (
                                            <ZebraIcon className={cn("relative z-10 h-5 w-5", isActive && "text-primary")} />
                                        ) : (
                                            <Icon
                                                weight={isActive ? "BoldDuotone" : "LineDuotone"}
                                                className={cn("relative z-10 h-5 w-5", isActive && "text-primary")}
                                            />
                                        )}
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

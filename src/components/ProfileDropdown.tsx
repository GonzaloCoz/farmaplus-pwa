import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Monitor as Mirroring, Settings, Logout as LogOut } from "@solar-icons/react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CURRENT_APP_VERSION } from "@/hooks/useAppVersion";

export function ProfileDropdown() {
    const { themeMode, setThemeMode } = useTheme();
    const { user, logout } = useUser();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    const getInitials = () => {
        if (!user) return "??";
        if (user.role === 'branch' && user.branchName) {
            const branchName = user.branchName.replace(/^farmacia\s+/i, '');
            return `F${branchName.charAt(0).toUpperCase()}`;
        }
        const names = user.name.split(' ');
        if (names.length >= 2) {
            return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
        }
        return user.name.charAt(0).toUpperCase();
    };

    const handleLogout = () => {
        setOpen(false);
        logout();
        navigate("/login");
    };

    const handleSettings = () => {
        setOpen(false);
        navigate("/settings");
    };

    const initials = getInitials();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={
                <button
                    className="group flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden transition-all bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                    style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                >
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-secondary-foreground">
                        {initials}
                    </div>
                </button>
            } />
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-72 p-0 rounded-lg border border-border/60 shadow-sm bg-popover"
            >
                {/* Header - User Info */}
                <div className="flex items-center gap-3 p-4 pb-3">
                    <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-muted/60 border border-border/40 text-foreground/80 text-sm font-bold shrink-0">
                        {initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">
                            {user?.name || "Usuario"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                            @{user?.username || "user"}
                        </span>
                    </div>
                </div>

                <Separator className="opacity-50" />

                {/* Menu Items */}
                <div className="p-2 space-y-1">
                    {/* Theme Selector (Segmented UI) */}
                    <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Tema</span>
                        <div className="flex p-1 bg-muted/50 rounded-xl border border-border/40">
                            <button
                                onClick={() => setThemeMode('light')}
                                className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    themeMode === 'light' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                                title="Claro"
                            >
                                <Sun className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setThemeMode('dark')}
                                className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    themeMode === 'dark' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                                title="Oscuro"
                            >
                                <Moon className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setThemeMode('system')}
                                className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    themeMode === 'system' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                                title="Sistema"
                            >
                                <Mirroring className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Settings */}
                    <button
                        onClick={handleSettings}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-muted/60 transition-colors group"
                    >
                        <Settings className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-medium">Configuración</span>
                    </button>
                </div>

                <Separator className="opacity-50" />

                {/* Logout */}
                <div className="p-2">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors group"
                    >
                        <LogOut className="h-[18px] w-[18px] group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Cerrar Sesión</span>
                    </button>
                </div>

                {/* Footer - Version */}
                <div className="px-4 py-2.5 border-t border-border/40">
                    <p className="text-[11px] text-muted-foreground">
                        {CURRENT_APP_VERSION}
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}


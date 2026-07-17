import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    DropdownLabel,
    DropdownSeparator,
    MenuItem,
} from "@/components/ui/dropdown";
import { Settings01 as Settings, LogOut01 as LogOut } from '@untitledui/icons';
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { surfaceClasses } from "@/lib/surface-classes";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CURRENT_APP_VERSION } from "@/hooks/useAppVersion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function ProfileDropdown() {
    const { theme, toggleTheme } = useTheme();
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
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownTrigger render={
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "group shrink-0 cursor-pointer overflow-hidden",
                        surfaceClasses(3)
                    )}
                    style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                >
                    <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-current">
                        {initials}
                    </div>
                </Button>
            } />
            <DropdownContent
                align="end"
                sideOffset={8}
                className="w-64"
            >
                <DropdownLabel className="px-3 py-2 flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground truncate">{user?.name || "Usuario"}</span>
                    <span className="text-[11px] text-muted-foreground truncate">@{user?.username || "user"}</span>
                </DropdownLabel>

                <DropdownSeparator />

                <MenuItem
                    index={0}
                    icon={Settings}
                    label="Configuración"
                    onSelect={handleSettings}
                />

                <div className="relative flex h-9 items-center justify-between px-3 outline-none">
                    <span className="text-[13px] text-muted-foreground">Modo oscuro</span>
                    <Switch
                        checked={theme === 'dark'}
                        onCheckedChange={toggleTheme}
                    />
                </div>

                <DropdownSeparator />

                <MenuItem
                    index={1}
                    icon={LogOut}
                    label="Cerrar Sesión"
                    onSelect={handleLogout}
                    className="text-destructive focus:text-destructive"
                />

                <DropdownSeparator />

                <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 select-none">
                    {CURRENT_APP_VERSION}
                </div>
            </DropdownContent>
        </DropdownMenu>
    );
}


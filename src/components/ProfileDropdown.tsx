import { cn } from "@/lib/utils";
import { surfaceClasses } from "@/lib/surface-classes";
import { useUser } from "@/contexts/UserContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/dialog-sidebar/settings-dialog";

export function ProfileDropdown() {
    const { user } = useUser();
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
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

    const initials = getInitials();

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettingsDialog(true)}
                className={cn(
                    "h-[34px] w-[34px] rounded-lg group shrink-0 cursor-pointer overflow-hidden",
                    surfaceClasses(3)
                )}
                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                title="Configuración"
            >
                <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-current">
                    {initials}
                </div>
            </Button>

            {/* Diálogo de Configuración con Sidebar interno */}
            <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />
        </>
    );
}



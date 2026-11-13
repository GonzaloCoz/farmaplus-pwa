import { cn } from "@/lib/utils";
import { surfaceClasses } from "@/lib/surface-classes";
import { useUser } from "@/contexts/UserContext";
import { useAvatarMode, getUserInitials } from "@/hooks/useAvatarMode";
import { useIcons } from "@/lib/icon-context";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/dialog-sidebar/settings-dialog";

export function ProfileDropdown() {
    const { user } = useUser();
    const icons = useIcons();
    const { avatarMode, avatarImage } = useAvatarMode();
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);

    const initials = getUserInitials(user);

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettingsDialog(true)}
                className={cn(
                    "h-[34px] w-[34px] rounded-lg group shrink-0 cursor-pointer overflow-hidden p-0 [&>span]:size-full",
                    surfaceClasses(3)
                )}
                title="Configuración"
            >
                <div className="size-full rounded-lg overflow-hidden bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">
                    {avatarMode === "photo" && avatarImage ? (
                        <img
                            src={avatarImage}
                            alt={user?.name || "Usuario"}
                            className="size-full object-cover select-none"
                        />
                    ) : avatarMode === "photo" ? (
                        <icons.user size={16} strokeWidth={2} className="text-current" />
                    ) : (
                        initials
                    )}
                </div>
            </Button>

            {/* Diálogo de Configuración con Sidebar interno */}
            <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />
        </>
    );
}



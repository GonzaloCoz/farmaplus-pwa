import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Grid3x3, Plus, RotateCcw, Check, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { hasPermission } from "@/config/permissions";

interface DashboardHeaderProps {
    isEditMode: boolean;
    setIsEditMode: (value: boolean) => void;
    onOpenPresets: () => void;
    onOpenGallery: () => void;
    onResetLayout: () => void;
    hasHiddenWidgets: boolean;
}

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export function DashboardHeader({
    isEditMode,
    setIsEditMode,
    onOpenPresets,
    onOpenGallery,
    onResetLayout,
    hasHiddenWidgets
}: DashboardHeaderProps) {
    const { user } = useUser();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return "Buenos días";
        if (hour >= 12 && hour < 20) return "Buenas tardes";
        return "Buenas noches";
    };

    return (
        <motion.div variants={itemVariants} className="space-y-1">
            {/* Date */}
            <div className="text-muted-foreground text-xs font-normal">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
            </div>

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-medium tracking-tight text-foreground">
                    {getGreeting()}, {(user?.role === 'admin' || user?.role === 'mod') ? user?.name.split(' ')[0] : (user?.branchName || 'Sucursal')} <span className="wave">👋</span>
                </h1>

                <div className="flex gap-2">
                    {isEditMode && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenPresets}
                            >
                                <Grid3x3 className="h-4 w-4 mr-2" />
                                Presets
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onOpenGallery}
                                disabled={!hasHiddenWidgets}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar Widget
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onResetLayout}
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Resetear
                            </Button>
                        </>
                    )}

                    {/* Animated Edit Button - Gated by permission */}
                    {hasPermission(user, 'EDIT_DASHBOARD_LAYOUT') && (
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                variant={isEditMode ? "default" : "outline"}
                                size="sm"
                                onClick={() => setIsEditMode(!isEditMode)}
                                className={cn(
                                    "relative overflow-hidden transition-all duration-300",
                                    isEditMode && "bg-green-600 hover:bg-green-700"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <AnimatePresence mode="wait">
                                        {isEditMode ? (
                                            <motion.div
                                                key="check"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Check className="h-4 w-4" />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="edit"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Edit3 className="h-4 w-4" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <span>{isEditMode ? 'Guardar' : 'Editar Dashboard'}</span>
                                </div>
                            </Button>
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

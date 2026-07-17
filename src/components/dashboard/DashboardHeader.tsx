import { motion } from "framer-motion";
import { cn, normalizeString } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export function DashboardHeader() {
    const { user } = useUser();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return "Buenos días";
        if (hour >= 12 && hour < 20) return "Buenas tardes";
        return "Buenas noches";
    };

    const getBranchAwards = (branchName?: string) => {
        if (!branchName) return [];
        const normalized = normalizeString(branchName);
        const awards: { emoji: string; tooltip: string }[] = {
            "DEVOTO III": [
                { emoji: "🏆", tooltip: "Doble mérito: 1.º en finalizar y menor diferencia de stock. ¡Felicitaciones!" },
            ],
            "BOEDO": [
                { emoji: "🥈", tooltip: "2.º Puesto en finalización. ¡Gracias por su excelente compromiso y trabajo!" },
                { emoji: "🥉", tooltip: "3.º Puesto en menor diferencia de stock. ¡Gran precisión!" },
            ],
            "VILLA BALLESTER II": [
                { emoji: "🥉", tooltip: "3.º Puesto en finalización. ¡Gracias por su excelente compromiso y trabajo!" },
            ],
            "BELGRANO VIII": [
                { emoji: "🥈", tooltip: "2.º Puesto en menor diferencia de stock. ¡Gran precisión!" },
            ],
            "RECOLETA IV": [
                { emoji: "🏅", tooltip: "4.º Puesto en menor diferencia de stock. ¡Excelente control de inventario!" },
            ],
            "PALERMO III": [
                { emoji: "🏅", tooltip: "5.º Puesto en menor diferencia de stock. ¡Excelente control de inventario!" },
            ],
        }[normalized] || [];
        return awards;
    };

    return (
        <motion.div variants={itemVariants} className="space-y-1 pt-4 lg:pt-0">
            {/* Date */}
            <div className="text-muted-foreground text-xs font-normal">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
            </div>

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-medium tracking-tight text-foreground">
                    {getGreeting()}, {user?.name.split(' ')[0]}
                    {user?.branchName && (
                        <span className="text-muted-foreground font-normal ml-2">
                            — {user.branchName}
                        </span>
                    )}
                    {(() => {
                        const awards = getBranchAwards(user?.branchName);
                        if (awards.length > 0) {
                            return awards.map((award, idx) => (
                                <Tooltip key={idx}>
                                    <TooltipTrigger render={
                                        <span className="ml-1 hidden lg:inline-block cursor-help select-none">
                                            {award.emoji}
                                        </span>
                                    } />
                                    <TooltipContent>
                                        <p className="text-xs font-normal text-popover-foreground">
                                            {award.tooltip}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            ));
                        }
                        return (
                            <span className="wave ml-2 hidden lg:inline-block">👋</span>
                        );
                    })()}
                </h1>
            </div>
        </motion.div>
    );
}

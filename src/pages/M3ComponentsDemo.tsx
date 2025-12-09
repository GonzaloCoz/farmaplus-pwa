import { useState } from "react";
import { motion } from "framer-motion";
import { Chip, ChipGroup } from "@/components/Chip";
import { Badge } from "@/components/Badge";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { CircularProgress } from "@/components/CircularProgress";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { SegmentedButton, SegmentOption } from "@/components/SegmentedButton";
import { AnimatedTabs, Tab } from "@/components/AnimatedTabs";
import { BottomSheet } from "@/components/BottomSheet";
import { ExtendedFab, MiniFab } from "@/components/ExtendedFab";
import {
    Bell,
    Heart,
    Star,
    Filter,
    Plus,
    Settings,
    User,
    Home,
    ShoppingCart,
} from "lucide-react";
import { staggerContainerVariants, staggerItemVariants } from "@/utils/AnimationConfig";

const filterOptions: SegmentOption[] = [
    { value: "all", label: "Todos", icon: <Home className="w-4 h-4" /> },
    { value: "active", label: "Activos", icon: <Star className="w-4 h-4" /> },
    { value: "completed", label: "Completados", icon: <ShoppingCart className="w-4 h-4" /> },
];

const tabs: Tab[] = [
    { id: "overview", label: "Resumen", icon: <Home className="w-5 h-5" /> },
    { id: "components", label: "Componentes", icon: <Settings className="w-5 h-5" />, badge: 12 },
    { id: "profile", label: "Perfil", icon: <User className="w-5 h-5" /> },
];

export default function M3ComponentsDemo() {
    const { showSnackbar } = useSnackbar();
    const [selectedChips, setSelectedChips] = useState<string[]>(["chip1"]);
    const [segmentValue, setSegmentValue] = useState("all");
    const [activeTab, setActiveTab] = useState("overview");
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
    const [progress, setProgress] = useState(65);

    const handleChipToggle = (chipId: string) => {
        setSelectedChips((prev) =>
            prev.includes(chipId)
                ? prev.filter((id) => id !== chipId)
                : [...prev, chipId]
        );
    };

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
            className="container mx-auto px-4 py-8 max-w-6xl"
        >
            {/* Header */}
            <motion.div variants={staggerItemVariants} className="mb-8">
                <h1 className="text-display-small font-bold mb-2">
                    Material Design 3 Components
                </h1>
                <p className="text-body-large text-muted-foreground">
                    Demostración de todos los componentes M3 implementados
                </p>
            </motion.div>

            {/* Badges Section */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Badges</h2>
                <div className="flex flex-wrap gap-6 items-center">
                    <Badge content={5} variant="default">
                        <Bell className="w-6 h-6" />
                    </Badge>
                    <Badge content={99} variant="destructive">
                        <Bell className="w-6 h-6" />
                    </Badge>
                    <Badge content={150} max={99} variant="primary">
                        <Bell className="w-6 h-6" />
                    </Badge>
                    <Badge dot variant="success">
                        <Bell className="w-6 h-6" />
                    </Badge>
                    <Badge content="NEW" variant="warning">
                        <Star className="w-6 h-6" />
                    </Badge>
                </div>
            </motion.section>

            {/* Chips Section */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Chips</h2>
                <ChipGroup>
                    <Chip
                        label="Filtro 1"
                        variant="filter"
                        selected={selectedChips.includes("chip1")}
                        onSelect={() => handleChipToggle("chip1")}
                        icon={<Filter className="w-4 h-4" />}
                    />
                    <Chip
                        label="Filtro 2"
                        variant="filter"
                        selected={selectedChips.includes("chip2")}
                        onSelect={() => handleChipToggle("chip2")}
                        icon={<Star className="w-4 h-4" />}
                    />
                    <Chip
                        label="Favorito"
                        variant="suggestion"
                        icon={<Heart className="w-4 h-4" />}
                        onSelect={() => showSnackbar({ message: "Chip de sugerencia clickeado!", variant: "info" })}
                    />
                    <Chip
                        label="Etiqueta"
                        variant="input"
                        onDelete={() => showSnackbar({ message: "Chip eliminado", variant: "success" })}
                    />
                </ChipGroup>
            </motion.section>

            {/* Segmented Buttons */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Segmented Buttons</h2>
                <SegmentedButton
                    options={filterOptions}
                    value={segmentValue}
                    onChange={(value) => setSegmentValue(value as string)}
                />
            </motion.section>

            {/* Tabs */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Animated Tabs</h2>
                <AnimatedTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    variant="default"
                    className="mb-4"
                />
                <AnimatedTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    variant="pills"
                />
            </motion.section>

            {/* Progress Indicators */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Progress Indicators</h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-title-medium mb-3">Linear Progress</h3>
                        <div className="space-y-4">
                            <AnimatedProgressBar value={progress} variant="primary" showLabel />
                            <AnimatedProgressBar value={75} variant="success" size="large" />
                            <AnimatedProgressBar variant="warning" /> {/* Indeterminate */}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => setProgress(Math.max(0, progress - 10))}
                                className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80"
                            >
                                -10%
                            </button>
                            <button
                                onClick={() => setProgress(Math.min(100, progress + 10))}
                                className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80"
                            >
                                +10%
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-title-medium mb-3">Circular Progress</h3>
                        <div className="flex gap-6 items-center">
                            <CircularProgress value={progress} showLabel />
                            <CircularProgress value={85} variant="success" size="large" />
                            <CircularProgress variant="primary" /> {/* Indeterminate */}
                            <CircularProgress variant="warning" size="small" />
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* Snackbar Triggers */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Snackbars</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => showSnackbar({ message: "Operación exitosa", variant: "success" })}
                        className="px-4 py-2 bg-success text-success-foreground rounded-lg hover:opacity-90"
                    >
                        Success
                    </button>
                    <button
                        onClick={() => showSnackbar({ message: "Advertencia importante", variant: "warning" })}
                        className="px-4 py-2 bg-warning text-warning-foreground rounded-lg hover:opacity-90"
                    >
                        Warning
                    </button>
                    <button
                        onClick={() => showSnackbar({ message: "Error al procesar", variant: "error" })}
                        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90"
                    >
                        Error
                    </button>
                    <button
                        onClick={() =>
                            showSnackbar({
                                message: "Cambios guardados",
                                variant: "info",
                                action: { label: "Deshacer", onClick: () => console.log("Undo") },
                            })
                        }
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                    >
                        With Action
                    </button>
                </div>
            </motion.section>

            {/* Bottom Sheet */}
            <motion.section variants={staggerItemVariants} className="mb-12">
                <h2 className="text-headline-small font-semibold mb-4">Bottom Sheet</h2>
                <button
                    onClick={() => setBottomSheetOpen(true)}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                    Abrir Bottom Sheet
                </button>
            </motion.section>

            {/* FABs */}
            <ExtendedFab
                label="Crear Nuevo"
                extended
                onClick={() => showSnackbar({ message: "FAB clickeado!", variant: "success" })}
            />

            <MiniFab
                icon={<Plus className="w-5 h-5" />}
                onClick={() => showSnackbar({ message: "Mini FAB clickeado!", variant: "info" })}
                className="fixed bottom-20 left-6"
            />

            {/* Bottom Sheet Component */}
            <BottomSheet
                open={bottomSheetOpen}
                onClose={() => setBottomSheetOpen(false)}
                title="Bottom Sheet Demo"
                variant="modal"
            >
                <div className="space-y-4">
                    <p className="text-body-large">
                        Este es un bottom sheet con gestos de arrastre. Puedes arrastrarlo hacia abajo para cerrarlo.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                            <div
                                key={item}
                                className="p-4 bg-secondary rounded-lg text-center elevation-1"
                            >
                                Item {item}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            setBottomSheetOpen(false);
                            showSnackbar({ message: "Bottom sheet cerrado", variant: "success" });
                        }}
                        className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                    >
                        Cerrar
                    </button>
                </div>
            </BottomSheet>
        </motion.div>
    );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ScanBarcode, FileSpreadsheet, Save, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CyclicFabProps {
    onScan: () => void;
    onManualSearch: () => void;
    onExport: () => void;
    onFinalize: () => void;
    isScanning?: boolean;
}

export function CyclicFab({ onScan, onManualSearch, onExport, onFinalize }: CyclicFabProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const menuItems = [
        { label: 'Escanear', icon: ScanBarcode, onClick: onScan, color: 'bg-blue-500' },
        { label: 'Buscar Manual', icon: Search, onClick: onManualSearch, color: 'bg-indigo-500' },
        { label: 'Exportar Excel', icon: FileSpreadsheet, onClick: onExport, color: 'bg-emerald-500' },
        { label: 'Finalizar', icon: Save, onClick: onFinalize, color: 'bg-primary' },
    ];

    return (
        <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 pb-8 lg:pb-0">
            <AnimatePresence>
                {isOpen && (
                    <div className="flex flex-col items-end gap-3 mb-2">
                        {menuItems.map((item, index) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                                className="flex items-center gap-2"
                            >
                                <span className="bg-background/90 backdrop-blur px-2 py-1 rounded-md text-sm font-medium shadow-sm border">
                                    {item.label}
                                </span>
                                <Button
                                    size="icon"
                                    className={cn("h-10 w-10 rounded-full shadow-lg", item.color, "hover:brightness-110 text-white border-none")}
                                    onClick={() => {
                                        item.onClick();
                                        setIsOpen(false);
                                    }}
                                >
                                    <item.icon className="h-5 w-5" />
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleOpen}
                className={cn(
                    "h-14 w-14 rounded-2xl shadow-xl flex items-center justify-center transition-colors duration-300",
                    isOpen ? "bg-muted text-foreground rotate-45" : "bg-primary text-primary-foreground"
                )}
            >
                {isOpen ? <Plus className="h-6 w-6 rotate-45 transition-transform" /> : <Plus className="h-6 w-6" />}
            </motion.button>
        </div>
    );
}

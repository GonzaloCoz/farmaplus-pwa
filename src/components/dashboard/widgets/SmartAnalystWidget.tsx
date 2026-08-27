import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllExpirationItems } from '@/services/expirationDB';
import { CpuChip01 as BrainCircuit, AlertTriangle, ChevronRight as ArrowRight, CheckCircle } from '@untitledui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { WidgetSkeleton } from '../WidgetSkeleton';

interface AlertItem {
    productName: string;
    batchNumber: string;
    expirationDate: string;
    reminderMonths: number;
    daysUntilExpiry: number;
}

import { useUser } from '@/contexts/UserContext';

import { notify } from '@/lib/notifications';

export function SmartAnalystWidget() {
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();

    const handleBlockedClick = () => {
        if (!isAdmin) {
            notify.info("Próximamente", "La herramienta de Control de Vencimiento estará disponible muy pronto.", { id: 'blocked-feature' });
        } else {
            navigate('/control-vencimiento');
        }
    };

    // Poll for changes every 5 seconds and auto-play carousel
    useEffect(() => {
        if (!isAdmin) {
            setIsLoading(false);
            return;
        }
        analyzeData();
        const dataInterval = setInterval(analyzeData, 5000);
        return () => clearInterval(dataInterval);
    }, [user?.branchName, isAdmin]);

    // Carousel Timer
    useEffect(() => {
        if (!isAdmin || alerts.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % alerts.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [alerts.length, isAdmin]);

    const analyzeData = async () => {
        if (!isAdmin) return;
        try {
            // ... truncated analyzeData logic ...
        } catch (error) {
            console.error("Smart Analyst Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <WidgetSkeleton variant="analyst" />;

    const alertCount = alerts.length;
    const isClean = !isAdmin || alertCount === 0;
    const currentAlert = alerts[currentIndex];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="h-full"
        >
            <div
                className="flex flex-col h-full justify-between relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
                onClick={handleBlockedClick}
                role="button"
                tabIndex={0}
            >
                {/* Header Background Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-30" />

                <CardHeader className="pb-0 pt-4 px-5 text-foreground">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-medium tracking-tight">
                            Control de Vencimientos
                        </CardTitle>
                        {isClean ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <BrainCircuit className="w-5 h-5 text-primary" />}
                    </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col px-5 pb-5 pt-0 min-h-0">
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-3xl font-bold ${isClean ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                            {isClean ? 'Todo en Orden' : `${alertCount}`}
                        </span>
                        {!isClean && <span className="text-sm text-muted-foreground">Alertas</span>}
                    </div>

                    {isClean && (
                        <p className="text-xs text-muted-foreground line-clamp-3">
                            No detectamos productos próximos a vencer según tus recordatorios configurados.
                        </p>
                    )}

                    {!isClean && currentAlert && (
                        <div className="flex-1 relative min-h-0 mb-2">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`${currentAlert.productName}-${currentAlert.batchNumber}`}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute inset-0 flex flex-col justify-center border-l-2 border-primary/50 pl-3 py-1"
                                >
                                    <p className="font-medium text-sm truncate text-foreground leading-tight mb-1" title={currentAlert.productName}>
                                        {currentAlert.productName}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                                        <span className="font-mono bg-muted/50 px-1 rounded text-[10px]">Lote: {currentAlert.batchNumber}</span>
                                        <span>•</span>
                                        <span className={currentAlert.daysUntilExpiry <= 30 ? "text-red-500 font-medium" : "text-amber-500"}>
                                            Vence: {currentAlert.expirationDate}
                                        </span>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}

                    {!isClean && alerts.length > 1 && (
                        <div className="flex gap-1 mb-2">
                            {alerts.slice(0, 5).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex % 5 ? 'w-4 bg-primary' : 'w-1.5 bg-primary/20'}`}
                                />
                            ))}
                        </div>
                    )}

                    {!isClean && (
                        <Button
                            className="w-full h-8 text-xs mt-auto"
                            size="sm"
                            variant="outline"
                            onClick={() => navigate('/control-vencimiento')}
                        >
                            Ver Detalles <ArrowRight className="w-3 h-3 ml-2" />
                        </Button>
                    )}
                </CardContent>
            </div>
        </motion.div>
    );
}

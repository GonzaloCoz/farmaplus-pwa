import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllExpirationItems } from '@/services/expirationDB';
import { BrainCircuit, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface AlertItem {
    productName: string;
    batchNumber: string;
    expirationDate: string;
    reminderMonths: number;
    daysUntilExpiry: number;
}

import { useUser } from '@/contexts/UserContext';

export function SmartAnalystWidget() {
    const { user } = useUser();
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();

    // Poll for changes every 5 seconds and auto-play carousel
    useEffect(() => {
        analyzeData();
        const dataInterval = setInterval(analyzeData, 5000);
        return () => clearInterval(dataInterval);
    }, [user?.branchName]);

    // Carousel Timer
    useEffect(() => {
        if (alerts.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % alerts.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [alerts.length]);

    const analyzeData = async () => {
        try {
            // Pass the current branch name to filter items
            const allItems = await getAllExpirationItems(user?.branchName);
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // 1-12
            const currentYear = now.getFullYear(); // 2024

            // Normalize current date value for comparison (YYYYMM)
            const currentValue = currentYear * 100 + currentMonth;

            const identifiedAlerts: AlertItem[] = [];

            // 1. Filter for the LATEST version of each product (by EAN)
            // This prevents duplicate alerts from multiple sessions and ensures we use the most recent data
            const latestItemsMap = new Map<string, typeof allItems[0]>();
            allItems.forEach(item => {
                const existing = latestItemsMap.get(item.ean);
                if (!existing || item.timestamp > existing.timestamp) {
                    latestItemsMap.set(item.ean, item);
                }
            });

            latestItemsMap.forEach(item => {
                item.batches.forEach(batch => {
                    // Ignore batches with 0 quantity or non-active status (sold, transferred, etc.)
                    if (batch.quantity <= 0) return;
                    if (batch.status && batch.status !== 'active') return;

                    const reminder = batch.reminderMonths;
                    if (!reminder) return; // No reminder set

                    // Parse MMP/AA or MM/AAAA
                    const parts = batch.expirationDate.split('/');
                    if (parts.length < 2) return;

                    let bMonth = parseInt(parts[0]);
                    let bYear = parseInt(parts[1]);

                    // Normalize Year (2-digit to 4-digit)
                    if (bYear < 100) bYear += 2000;

                    // Calculate Expiry Value YYYYMM
                    const expiryValue = bYear * 100 + bMonth;

                    // Simple approach: Convert everything to total months
                    const totalExpiryMonths = bYear * 12 + bMonth;
                    const totalCurrentMonths = currentYear * 12 + currentMonth;

                    const monthsDiff = totalExpiryMonths - totalCurrentMonths;

                    // If we are within the reminder buffer (or past it)
                    if (monthsDiff <= reminder) {
                        // Calculate approximate days for display
                        const expiryDateObj = new Date(bYear, bMonth - 1, 1); // 1st of month
                        const diffTime = expiryDateObj.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        identifiedAlerts.push({
                            productName: item.productName,
                            batchNumber: batch.batchNumber,
                            expirationDate: batch.expirationDate,
                            reminderMonths: reminder,
                            daysUntilExpiry: diffDays
                        });
                    }
                });
            });

            // Sort by urgency (expiry date ascending)
            identifiedAlerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

            // State update with check to avoid carousel reset if data is identical
            setAlerts(prev => {
                const isSame = JSON.stringify(prev) === JSON.stringify(identifiedAlerts);
                return isSame ? prev : identifiedAlerts;
            });

        } catch (error) {
            console.error("Smart Analyst Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return null; // Or skeleton

    const alertCount = alerts.length;
    const isClean = alertCount === 0;
    const currentAlert = alerts[currentIndex];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="h-full"
        >
            <Card
                className="flex flex-col h-full bg-card justify-between relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate('/smart-analyst')}
                role="button"
                tabIndex={0}
            >
                {/* Header Background Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50" />

                <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Control de Vencimientos
                        </CardTitle>
                        {isClean ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <BrainCircuit className="w-4 h-4 text-primary" />}
                    </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col px-4 pb-4 pt-0 min-h-0">
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
                            onClick={() => navigate('/smart-analyst')}
                        >
                            Ver Detalles <ArrowRight className="w-3 h-3 ml-2" />
                        </Button>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}

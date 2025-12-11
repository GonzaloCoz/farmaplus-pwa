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

export function SmartAnalystWidget() {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();

    // Poll for changes every 5 seconds and auto-play carousel
    useEffect(() => {
        analyzeData();
        const dataInterval = setInterval(analyzeData, 5000);
        return () => clearInterval(dataInterval);
    }, []);

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
            const allItems = await getAllExpirationItems();
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // 1-12
            const currentYear = now.getFullYear(); // 2024

            // Normalize current date value for comparison (YYYYMM)
            const currentValue = currentYear * 100 + currentMonth;

            const identifiedAlerts: AlertItem[] = [];

            allItems.forEach(item => {
                item.batches.forEach(batch => {
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
            <Card className="h-full flex flex-col relative overflow-hidden shadow-none border">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`p-1.5 rounded-lg ${isClean ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {isClean ? <CheckCircle2 className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />}
                                </div>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                    Analista Inteligente
                                </CardTitle>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-black ${isClean ? 'text-green-600' : 'text-indigo-600'}`}>
                                    {isClean ? 'Todo en Orden' : `${alertCount} Alertas`}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                        {isClean
                            ? "No detectamos productos próximos a vencer según tus recordatorios configurados."
                            : `Hemos detectado ${alertCount} lotes que requieren tu atención inmediata.`
                        }
                    </p>

                    {!isClean && currentAlert && (
                        <div className="relative h-20 mb-2">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`${currentAlert.productName}-${currentAlert.batchNumber}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute inset-0 flex items-center justify-between p-3 bg-muted/40 rounded border shadow-sm"
                                >
                                    <div className="overflow-hidden pr-2">
                                        <p className="font-bold text-sm truncate text-foreground">{currentAlert.productName}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Lote: <span className="font-mono">{currentAlert.batchNumber}</span>
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Vence: {currentAlert.expirationDate}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 shrink-0 flex flex-col items-center gap-0.5 py-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="text-[10px] font-bold">
                                            {currentAlert.daysUntilExpiry <= 0 ? '¡VENCIDO!' : `${Math.floor(currentAlert.daysUntilExpiry / 30) || '<1'} Meses`}
                                        </span>
                                    </Badge>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Dots Indicator */}
                    {!isClean && alerts.length > 1 && (
                        <div className="flex justify-center gap-1 mb-3">
                            {alerts.slice(0, 5).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex % 5 ? 'w-4 bg-indigo-500' : 'w-1.5 bg-indigo-200'}`}
                                />
                            ))}
                            {alerts.length > 5 && <div className="h-1.5 w-1.5 rounded-full bg-indigo-100" />}
                        </div>
                    )}

                    {!isClean && (
                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-auto"
                            size="sm"
                            onClick={() => navigate('/vencimientos')}
                        >
                            Revisar Vencimientos <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}

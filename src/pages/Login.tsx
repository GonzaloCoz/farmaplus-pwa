import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { Package, TrendingUp, ShieldCheck, ArrowRight, Lock, User, HelpCircle, AlertTriangle } from "lucide-react";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import { loadDefaultData } from "@/services/preCountDB";

// Componente visual para la demo (similar a MetricCard)
function DemoMetricCard({ title, value, icon: Icon, color }: any) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-white/20 w-full max-w-[200px]"
        >
            <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Hoy</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className="text-xs text-muted-foreground font-medium">{title}</div>
        </motion.div>
    );
}

export default function Login() {
    const navigate = useNavigate();
    const { login } = useUser();
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [currentFeature, setCurrentFeature] = useState(0);

    const features = [
        {
            id: 1,
            component: (
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-xl shadow-2xl border border-white/20 w-[320px] h-[220px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">Control de Stock</h3>
                                <p className="text-[10px] text-gray-500">Última actualización: 14:00hs</p>
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-gray-800">15,234</span>
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between text-xs border-b pb-2 border-gray-100">
                            <span className="font-medium text-gray-600">Amoxidal 500mg</span>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">142 un.</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b pb-2 border-gray-100">
                            <span className="font-medium text-gray-600">Tafirol 1g</span>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">89 un.</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-600">Dermaglós Emulsión</span>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-bold">12 un.</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            title: "Control de Inventario",
            description: "Monitorea el stock en tiempo real con detalle por producto y alertas automáticas de reposición."
        },
        {
            id: 2,
            component: (
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-xl shadow-2xl border border-white/20 w-[320px] h-[220px] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">Métricas de Eficiencia</h3>
                                <p className="text-[10px] text-gray-500">Rendimiento mensual</p>
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-emerald-600">99.2%</span>
                    </div>

                    <div className="flex gap-1 items-end h-[100px] mt-2 justify-between px-2">
                        {[65, 80, 75, 90, 85, 95, 99].map((h, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 w-6 group">
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    className="w-full bg-emerald-500/20 group-hover:bg-emerald-500 rounded-t-sm transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 px-2 mt-1">
                        <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
                    </div>
                </div>
            ),
            title: "Análisis de Rendimiento",
            description: "Visualiza la evolución de tu farmacia con gráficos interactivos y reportes de productividad."
        },
        {
            id: 3,
            component: (
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-xl shadow-2xl border border-white/20 w-[320px] h-[220px] flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform hover:scale-110" />

                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-orange-100 z-10">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="z-10">
                            <h3 className="font-bold text-gray-800 text-sm">Próximos Vencimientos</h3>
                            <p className="text-[10px] text-orange-600 font-medium">Requieren atención inmediata</p>
                        </div>
                    </div>

                    <div className="flex-1 space-y-3 z-10">
                        <div className="bg-orange-50 p-2.5 rounded-lg border border-orange-100 flex justify-between items-center group cursor-pointer hover:bg-orange-100 transition-colors">
                            <div>
                                <p className="text-xs font-bold text-gray-800">Lotrial 10mg</p>
                                <p className="text-[10px] text-gray-500">Lote: B4592 • Vence: 15/12/2025</p>
                            </div>
                            <span className="text-[10px] font-bold text-orange-600 bg-white px-2 py-1 rounded shadow-sm">15 días</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-100 flex justify-between items-center opacity-80">
                            <div>
                                <p className="text-xs font-bold text-gray-800">Ibuprofeno 600</p>
                                <p className="text-[10px] text-gray-500">Lote: A1234 • Vence: 20/01/2026</p>
                            </div>
                            <span className="text-[10px] text-gray-500">50 días</span>
                        </div>
                    </div>
                </div>
            ),
            title: "Control de Vencimientos",
            description: "Evita pérdidas con nuestro sistema inteligente de detección temprana de lotes por vencer."
        },
        {
            id: 4,
            component: (
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-xl shadow-2xl border border-white/20 w-[320px] h-[220px] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">Sincronización Cloud</h3>
                                <p className="text-[10px] text-gray-500">Base de datos centralizada</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-bold text-green-600">Online</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                            <p className="text-xl font-bold text-indigo-600">1.2M</p>
                            <p className="text-[10px] text-gray-500 font-medium">Registros Proc.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                            <p className="text-xl font-bold text-indigo-600">0.4s</p>
                            <p className="text-[10px] text-gray-500 font-medium">Latencia Media</p>
                        </div>
                    </div>

                    <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                            <span>Estado de réplica</span>
                            <span>Completo</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-full animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                </div>
            ),
            title: "Infraestructura Segura",
            description: "Tus datos respaldados en la nube con encriptación de grado militar y acceso 24/7."
        }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentFeature((prev) => (prev + 1) % features.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [features.length]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (username && password) {
                const success = await login(username, password);

                if (success) {
                    notify.success("¡Bienvenido a Farmaplus!", `Sesión iniciada como ${username.replace(/\./g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase())}`);

                    // Asegurar que los productos base estén cargados
                    // La lógica de sucursales ahora se maneja en CyclicInventory via lab_sucu.xlsx
                    await loadDefaultData();

                    navigate("/");
                } else {
                    notify.error("Credenciales inválidas", "Verifique su usuario y contraseña.");
                }
            } else {
                notify.error("Datos incompletos", "Por favor ingresa usuario y contraseña");
            }
        } catch (error) {
            console.error(error);
            notify.error("Error de conexión", "Ocurrió un error al iniciar sesión");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-slate-50 dark:bg-[#0c0e12]">
            {/* Sección Izquierda - Showcase */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center p-12">
                {/* Fondo decorativo Premium */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f1115] via-[#1a1d24] to-[#0c0e12]" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-40 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 opacity-40 animate-pulse" />

                <div className="relative z-10 w-full max-w-[500px] h-[400px] flex flex-col items-center justify-center text-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentFeature}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50, transition: { duration: 0.3 } }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="flex flex-col items-center gap-8"
                        >
                            {/* Widget Visualization */}
                            <div className="transform hover:scale-105 transition-transform duration-500">
                                {features[currentFeature].component}
                            </div>

                            {/* Introduction Text */}
                            <div className="space-y-4 max-w-sm">
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-3xl font-bold text-white tracking-tight"
                                >
                                    {features[currentFeature].title}
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-lg text-gray-400 leading-relaxed"
                                >
                                    {features[currentFeature].description}
                                </motion.p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Indicators */}
                    <div className="absolute bottom-0 flex gap-2">
                        {features.map((_, index) => (
                            <div
                                key={index}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentFeature ? "w-8 bg-blue-500" : "w-2 bg-white/20"
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Sección Derecha - Login */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-[#0c0e12] transition-colors duration-500">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Bienvenido de nuevo
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Ingresa tus credenciales para acceder al sistema.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Usuario</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        placeholder="nombre.apellido"
                                        className="pl-9 h-11 bg-muted/30 border-border/50 focus:bg-background transition-all"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-9 h-11 bg-muted/30 border-border/50 focus:bg-background transition-all"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-medium"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Ingresando...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    Ingresar al Sistema <ArrowRight className="w-4 h-4" />
                                </span>
                            )}
                        </Button>
                    </form>

                    <div className="pt-6 border-t border-border/50">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <HelpCircle className="w-4 h-4" />
                            <span>¿Problemas para ingresar?</span>
                            <a
                                href="https://teams.microsoft.com/l/chat/0/0?users=soporte@farmaplus.com.ar" // Placeholder
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                            >
                                Contactar Soporte
                            </a>
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-4 opacity-50">
                            Farmaplus PWA v1.2.0 &copy; 2025
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

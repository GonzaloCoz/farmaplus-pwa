import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { Package, TrendingUp, ShieldCheck, ArrowRight, Lock, User, HelpCircle } from "lucide-react";
import { toast } from "sonner";
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (username && password) {
                const success = await login(username, password);

                if (success) {
                    toast.success(`¡Bienvenido a Farmaplus ${username.replace(/\./g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase())}!`);

                    // Asegurar que los productos base estén cargados
                    // La lógica de sucursales ahora se maneja en CyclicInventory via lab_sucu.xlsx
                    await loadDefaultData();

                    navigate("/");
                } else {
                    toast.error("Credenciales inválidas. Verifique su usuario y contraseña.");
                }
            } else {
                toast.error("Por favor ingresa usuario y contraseña");
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al iniciar sesión");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex">
            {/* Sección Izquierda - Showcase */}
            <div className="hidden lg:flex w-1/2 bg-slate-50 relative overflow-hidden items-center justify-center p-12">
                {/* Fondo decorativo */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50/50" />
                <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="relative z-10 max-w-lg w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-primary rounded-xl shadow-lg shadow-primary/20">
                                <Package className="w-8 h-8 text-primary-foreground" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Farmaplus PWA</h1>
                        </div>
                        <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                            Gestión inteligente de inventario y stock.
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Optimiza el control de tus sucursales con herramientas avanzadas de seguimiento y análisis en tiempo real.
                        </p>
                    </motion.div>

                    {/* Demo Visual */}
                    <div className="relative h-[300px] w-full">
                        {/* Tarjetas flotantes */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="absolute top-0 left-0 z-20"
                        >
                            <DemoMetricCard
                                title="Stock Total"
                                value="12,450"
                                icon={Package}
                                color="bg-blue-500"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="absolute top-12 right-0 z-10"
                        >
                            <DemoMetricCard
                                title="Eficiencia"
                                value="98.5%"
                                icon={TrendingUp}
                                color="bg-green-500"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.6 }}
                            className="absolute bottom-0 left-12 right-12 z-30"
                        >
                            <Card className="bg-white/95 backdrop-blur shadow-xl border-white/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Progreso de Sincronización
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-2xl font-bold text-gray-800">100%</span>
                                        <ShieldCheck className="w-5 h-5 text-green-500" />
                                    </div>
                                    <AnimatedProgressBar value={100} variant="success" size="small" />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Sección Derecha - Login */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
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
                                        className="pl-9"
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
                                        className="pl-9"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
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

                    <div className="pt-6 border-t">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <HelpCircle className="w-4 h-4" />
                            <span>¿Problemas para ingresar?</span>
                            <a
                                href="https://teams.microsoft.com/l/chat/0/0?users=soporte@farmaplus.com.ar" // Placeholder
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                            >
                                Contactar Soporte en Teams
                            </a>
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-4">
                            Farmaplus PWA v1.2.0 &copy; 2025
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

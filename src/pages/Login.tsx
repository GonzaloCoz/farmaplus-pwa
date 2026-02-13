import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, User, HelpCircle, ArrowRight } from "lucide-react";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import { loadDefaultData } from "@/services/preCountDB";

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
                    notify.success("¡Bienvenido a Farmaplus!", `Sesión iniciada como ${username.replace(/\./g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase())}`);
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
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#fafafa]">
            {/* Animated Background Layers */}
            <div className="absolute inset-0 z-0">
                {/* Fixed base gradient */}
                <div className="absolute inset-0 bg-gradient-to-tr from-gray-100 via-gray-50 to-white" />

                {/* Moving Blobs */}
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute -top-20 -left-20 w-96 h-96 bg-gray-200/50 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        x: [0, -80, 0],
                        y: [0, 60, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute top-1/2 -right-20 w-[500px] h-[500px] bg-gray-300/30 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        x: [0, 40, 0],
                        y: [0, 100, 0],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute -bottom-40 left-1/4 w-[600px] h-[600px] bg-gray-200/40 rounded-full blur-[130px]"
                />
            </div>

            {/* Login Card Container */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[440px] px-6"
            >
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-white rounded-2xl elevation-2 flex items-center justify-center mb-6 border border-gray-100 overflow-hidden">
                        <img src="/logo.png" alt="Farmaplus" className="w-10 h-10 object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Farmaplus</h1>
                    <p className="text-gray-400 font-medium text-sm mt-1">Gestión Inteligente de Inventario</p>
                </div>

                <Card className="border-white/40 bg-white/70 backdrop-blur-2xl shadow-2xl shadow-gray-200/50 rounded-[2.5rem] overflow-hidden">
                    <CardContent className="p-8 sm:p-10">
                        <div className="space-y-2 mb-8 text-center sm:text-left">
                            <h2 className="text-2xl font-bold text-gray-900 leading-tight">Acceso al Sistema</h2>
                            <p className="text-sm text-gray-400 font-medium">Ingresa tus credenciales para continuar</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Usuario</Label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-900 transition-colors">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <Input
                                            id="username"
                                            placeholder="nombre.apellido"
                                            className="pl-12 h-14 bg-white/50 border-gray-100 rounded-2xl focus:ring-0 focus:border-gray-900 transition-all text-[15px] font-medium placeholder:text-gray-300"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Contraseña</Label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-900 transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            className="pl-12 h-14 bg-white/50 border-gray-100 rounded-2xl focus:ring-0 focus:border-gray-900 transition-all text-[15px] font-medium placeholder:text-gray-300"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 hover:gap-5 elevation-3 active:scale-[0.98]"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        <span className="font-bold tracking-tight">Verificando...</span>
                                    </span>
                                ) : (
                                    <>
                                        <span className="font-bold tracking-tight text-[15px]">Ingresar ahora</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-10 pt-8 border-t border-gray-100/50">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <a
                                    href="https://teams.microsoft.com/l/chat/0/0?users=soporte@farmaplus.com.ar"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors bg-gray-50/50 px-4 py-2 rounded-xl border border-gray-100"
                                >
                                    <HelpCircle className="w-3.5 h-3.5" />
                                    ¿NECESITAS AYUDA?
                                </a>
                                <span className="text-[10px] font-black text-gray-300 tracking-[0.2em] uppercase">
                                    V1.2.0 • 2025
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Subtle Texture Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')]" />
        </div>
    );
}

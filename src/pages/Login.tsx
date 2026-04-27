import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, User, QuestionCircle as HelpCircle } from "@solar-icons/react";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import { loadDefaultData } from "@/services/preCountDB";

export default function Login() {
    const { login, user } = useUser();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    // Redirigir si ya está autenticado
    useEffect(() => {
        if (user) {
            navigate("/", { replace: true });
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("[Login] handleLogin started");
        setIsLoading(true);

        try {
            console.log("[Login] Credentials:", { username, hasPassword: !!password });
            if (username && password) {
                console.log("[Login] Calling context login...");
                const success = await login(username, password);
                console.log("[Login] Context login result:", success);

                if (success) {
                    const displayName = username
                        .replace(/\./g, ' ')
                        .replace(/(^\w|\s\w)/g, m => m.toUpperCase());
                    notify.success(`¡Bienvenido a Farmaplus ${displayName}!`);
                    await loadDefaultData();
                    navigate("/", { replace: true });
                } else {
                    notify.error("Credenciales inválidas", "Verifique su usuario y contraseña.");
                }
            } else {
                notify.warning("Campos requeridos", "Por favor ingresa usuario y contraseña.");
            }
        } catch (error) {
            console.error(error);
            notify.error("Error de acceso", "Ocurrió un error al iniciar sesión.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#cccccc] dark:bg-[#cccccc] overflow-hidden transition-all duration-500 font-sans">
            {/* Panel Izquierdo - Formulario */}
            <div className="w-full lg:w-[40%] h-full flex flex-col p-8 lg:p-12 xl:p-16 z-10 relative bg-[#cccccc] dark:bg-[#cccccc] overflow-hidden">
                <div className="max-w-sm mx-auto w-full pt-4 lg:pt-8 xl:pt-12">
                    {/* Cabecera: Logo y Bienvenida alineados a la derecha */}
                    <div className="flex items-center gap-6 mb-12">
                        <img
                            src="/logo.png"
                            alt="Farmaplus Logo"
                            className="h-20 w-auto object-contain"
                        />
                        <div className="flex flex-col">
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-heading">
                                Bienvenido
                            </h1>
                            <p className="text-gray-600 text-sm leading-tight">
                                Ingresa tus credenciales para continuar
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                                    Usuario
                                </Label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-3.5 h-4 w-4 text-gray-500 group-focus-within:text-black transition-colors" />
                                    <input
                                        id="username"
                                        placeholder="nombre.apellido"
                                        className="w-full pl-10 h-12 bg-white/50 border-transparent focus:bg-white focus:ring-0 outline-none transition-all rounded-md px-4 text-sm text-black"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                                    Contraseña
                                </Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-gray-400 group-focus-within:text-black transition-colors" />
                                    <input
                                        id="password"
                                        type="password"
                                        placeholder="Tu contraseña"
                                        className="w-full pl-10 h-12 bg-white/50 border-transparent focus:bg-white focus:ring-0 outline-none transition-all rounded-lg px-4 text-sm text-black"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-base font-semibold bg-black text-white hover:opacity-90 transition-all rounded-lg shadow-sm"
                            disabled={isLoading}
                        >
                            {isLoading ? "Accediendo..." : "Ingresar"}
                        </Button>

                        <div className="text-center pt-2">
                            <a
                                href="https://teams.microsoft.com/l/chat/0/0?users=GHCoz@farmaplus.com.ar&message=Hola Gonzalo, necesito ayuda con el acceso al PWA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#4B53BC] transition-colors group"
                            >
                                <HelpCircle className="w-4 h-4 text-gray-500 group-hover:text-[#4B53BC] transition-colors" />
                                <span>¿Necesitas ayuda?</span>
                            </a>
                        </div>
                    </form>
                </div>
            </div>

            {/* Panel Derecho - Imagen bg.svg */}
            <div className="hidden lg:block lg:w-[60%] h-full relative overflow-hidden bg-[#cccccc]">
                <div
                    className="absolute inset-0 w-full h-full"
                    style={{
                        backgroundImage: `url('/bg.svg')`,
                        backgroundSize: 'cover',
                        backgroundPosition: '10% center',
                        backgroundRepeat: 'no-repeat',
                        filter: 'contrast(1) opacity(0.9)'
                    }}
                />

                {/* Overlay gradual - Se ajusta al color de fondo #cccccc con un difuminado más suave */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#cccccc] via-[#cccccc]/40 to-transparent pointer-events-none w-1/2" />
            </div>
        </div>
    );
}

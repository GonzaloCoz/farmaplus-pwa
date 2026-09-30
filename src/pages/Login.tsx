import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
const Beams = React.lazy(() => import("@/components/ui/Beams"));
import { InputGroup, InputField } from "@/components/ui/input-group";
import { StatefulButton, type ButtonState } from "@/components/ui/stateful-button";
import { useIcons } from "@/lib/icon-context";
import { WindowControls } from "@/components/WindowControls";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function Login() {
    const { login, user } = useUser();
    const navigate = useNavigate();
    const icons = useIcons();
    
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonState, setButtonState] = useState<ButtonState>("idle");
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    const handleDragMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [role="button"], [data-no-drag]')) {
            return;
        }
        if (e.button === 0 && isTauri) {
            try {
                getCurrentWindow().startDragging();
            } catch (err) {
                console.error("Drag error:", err);
            }
        }
    };

    const handleHeaderDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [role="button"], [data-no-drag]')) {
            return;
        }
        if (isTauri) {
            try {
                getCurrentWindow().toggleMaximize();
            } catch (err) {
                console.error("Toggle maximize error:", err);
            }
        }
    };

    // Redirect if already authenticated
    useEffect(() => {
        if (user) {
            navigate("/", { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        setButtonState("loading");

        const success = await login(username, password);
        if (success) {
            setButtonState("success");
            setTimeout(() => {
                navigate("/", { replace: true });
            }, 600);
        } else {
            setButtonState("error");
            setError("Usuario o contraseña incorrectos");
            setLoading(false);
            setTimeout(() => {
                setButtonState("idle");
            }, 2000);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[oklch(0.11_0_0)] text-white overflow-hidden font-sans select-none relative">
            {/* Top draggable titlebar for Tauri desktop */}
            {isTauri && (
                <div 
                    data-tauri-drag-region
                    onMouseDown={handleDragMouseDown}
                    onDoubleClick={handleHeaderDoubleClick}
                    className="absolute top-0 left-0 right-0 h-11 flex items-center justify-end px-3.5 z-50 select-none bg-transparent"
                >
                    <WindowControls />
                </div>
            )}
            {/* Left Panel: Form */}
            <div className="w-full lg:w-[42%] xl:w-[38%] h-full flex flex-col justify-center items-center p-6 sm:p-10 md:p-12 z-10 relative bg-[oklch(0.11_0_0)] border-r border-[oklch(1_0_0/0.05)] [--muted-foreground:oklch(0.68_0_0)] [--foreground:oklch(0.96_0_0)] [--border:oklch(0.24_0_0)] [--card:oklch(0.15_0_0)] [--muted:oklch(0.18_0_0)]">
                <div className="max-w-sm w-full flex flex-col justify-center gap-8 py-8">
                    {/* Brand Logo & Intro */}
                    <div>
                        <h1 className="font-sans text-3xl font-semibold tracking-tight text-[oklch(0.98_0_0)]">
                            Iniciar sesión
                        </h1>
                        <p className="mt-2 text-[oklch(0.68_0_0)] text-sm">
                            Te damos la bienvenida de nuevo. Ingresa tus datos.
                        </p>
                    </div>

                    <div>
                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <InputGroup className="w-full">
                                <InputField
                                    index={0}
                                    label="Usuario"
                                    placeholder="Ingresa tu usuario"
                                    icon={icons.mail}
                                    value={username}
                                    onChange={(val) => {
                                        setUsername(val);
                                        if (error) setError("");
                                    }}
                                    error={error ? "Por favor ingresa un usuario válido." : undefined}
                                />
                                <InputField
                                    index={1}
                                    label="Contraseña"
                                    type="password"
                                    placeholder="Ingresa tu contraseña"
                                    icon={icons.lock}
                                    value={password}
                                    onChange={(val) => {
                                        setPassword(val);
                                        if (error) setError("");
                                    }}
                                    error={error ? "Por favor ingresa tu contraseña." : undefined}
                                />
                            </InputGroup>

                            {/* Submit Button */}
                            <StatefulButton
                                type="submit"
                                state={buttonState}
                                loadingText="Ingresando..."
                                successText="Ingresado"
                                errorText="Intenta de nuevo"
                                disabled={loading}
                                className="w-full h-11 rounded-full mt-4 text-sm"
                            >
                                Iniciar sesión
                            </StatefulButton>
                        </form>
                    </div>

                    {/* Support / Help footer */}
                    <div className="text-center pt-6 border-t border-[oklch(1_0_0/0.05)]">
                        <a
                            href="https://teams.microsoft.com/l/chat/0/0?users=GHCoz@farmaplus.com.ar&message=Hola Gonzalo, necesito ayuda con el acceso al PWA"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-semibold text-[oklch(0.55_0_0)] hover:text-[oklch(0.95_0_0)] transition-colors group justify-center"
                        >
                            <HelpCircle className="w-4 h-4 text-[oklch(0.45_0_0)] group-hover:text-[oklch(0.95_0_0)] transition-colors" />
                            <span>¿Necesitas ayuda con el acceso?</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Right Panel: Animated Beams Panel */}
            <div className="hidden lg:block lg:w-[58%] xl:w-[62%] h-full relative overflow-hidden bg-black">
                {/* 3D Beams Background from React Bits */}
                <div className="absolute inset-0 z-0">
                    <React.Suspense fallback={<div className="w-full h-full bg-black animate-pulse" />}>
                        <Beams
                            beamWidth={1.5}
                            beamHeight={20}
                            beamNumber={12}
                            lightColor="#ffffff"
                            speed={1.5}
                            noiseIntensity={2.5}
                            scale={0.2}
                            rotation={-12}
                        />
                    </React.Suspense>
                </div>

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.11_0_0)]/80 via-transparent to-[oklch(0.11_0_0)]/30 pointer-events-none z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.11_0_0)] via-transparent to-transparent pointer-events-none w-1/4 z-10" />

                {/* Text Content */}
                <div className="relative flex h-full flex-col justify-end p-16 xl:p-20 z-20">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 0.85, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="font-medium text-sm text-white/80 tracking-wide drop-shadow-sm uppercase"
                    >
                        Monitoreo y Control
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="mt-3 max-w-lg text-balance font-sans text-3xl font-medium text-white leading-tight drop-shadow-md"
                    >
                        Monitorea tus inventarios cíclicos en tiempo real con total precisión.
                    </motion.h2>
                </div>
            </div>
        </div>
    );
}

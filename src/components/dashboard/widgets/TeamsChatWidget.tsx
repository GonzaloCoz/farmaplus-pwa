import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, MessageSquarePlus, AlertTriangle, FileCheck, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";

const QUICK_ACTIONS = [
    {
        label: "Diferencia de Stock",
        icon: AlertTriangle,
        message: "Hola, he detectado una diferencia de stock importante en...",
        color: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-200"
    },
    {
        label: "Confirmar Cierre",
        icon: FileCheck,
        message: "El cierre del inventario cíclico ha sido completado y verificado.",
        color: "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200"
    },
    {
        label: "Solicitud Urgente",
        icon: MessageSquarePlus,
        message: "Necesito autorización urgente para...",
        color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200"
    }
];

// Corporate Colors
const AI_COLORS = {
    dark: "#08102E",
    blue: "#045598",
    light: "#a5b1e1ff"
};

const MotionOrb = () => {
    return (
        <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Core Glow */}
            <motion.div
                className="absolute inset-0 rounded-full blur-xl opacity-50"
                style={{
                    background: `radial-gradient(circle at center, ${AI_COLORS.light}, ${AI_COLORS.blue})`
                }}
                animate={{
                    scale: [0.8, 1, 0.9, 0.8],
                    opacity: [0.4, 0.6, 0.5, 0.4]
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.4, 0.8, 1]
                }}
            />

            {/* Moving Gradients Layer 1 */}
            <motion.div
                className="absolute w-28 h-28 rounded-full blur-lg mix-blend-screen"
                style={{
                    background: `conic-gradient(from 0deg, ${AI_COLORS.dark}, ${AI_COLORS.blue}, ${AI_COLORS.light}, ${AI_COLORS.dark})`
                }}
                animate={{
                    rotate: 360,
                    scale: [0.9, 1.1, 1.0, 0.9]
                }}
                transition={{
                    rotate: { duration: 7, repeat: Infinity, ease: "linear" },
                    scale: { duration: 6, repeat: Infinity, ease: "easeInOut" }
                }}
            />

            {/* Moving Gradients Layer 2 */}
            <motion.div
                className="absolute w-24 h-24 rounded-full blur-md mix-blend-overlay"
                style={{
                    background: `conic-gradient(from 180deg, ${AI_COLORS.light}, ${AI_COLORS.blue}, ${AI_COLORS.dark}, ${AI_COLORS.light})`
                }}
                animate={{
                    rotate: -360,
                    scale: [1.1, 0.9, 0.95, 1.1]
                }}
                transition={{
                    rotate: { duration: 9, repeat: Infinity, ease: "linear" },
                    scale: { duration: 8, repeat: Infinity, ease: "easeInOut" }
                }}
            />

            {/* Central Highlight / Liquid Glass Effect */}
            <motion.div
                className="absolute w-20 h-20 rounded-full backdrop-blur-md z-10 flex items-center justify-center overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    boxShadow: `0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255,255,255,0.1)`
                }}
                animate={{
                    boxShadow: [
                        `0 0 20px ${AI_COLORS.blue}40, inset 0 0 10px rgba(255,255,255,0.1)`,
                        `0 0 35px ${AI_COLORS.light}50, inset 0 0 20px rgba(255,255,255,0.2)`,
                        `0 0 20px ${AI_COLORS.blue}40, inset 0 0 10px rgba(255,255,255,0.1)`
                    ]
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                {/* Glossy Reflection */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none" />

                {/* Chat Icon */}
                <MessageSquare className="w-10 h-10 text-white drop-shadow-md relative z-10" strokeWidth={2} />
            </motion.div>
        </div>
    );
};

export function TeamsChatWidget() {
    const { user } = useUser();
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [isTyping, setIsTyping] = useState(false);

    // Teams Deep Link Generator
    const openTeamsChat = (text: string) => {
        const encodedMessage = encodeURIComponent(text);
        const targetEmail = user?.email || "gcoz@farmaplus.com"; // Reemplaza con tu mail de Teams o el del destinatario
        const url = `https://teams.microsoft.com/l/chat/0/0?users=${targetEmail}&message=${encodedMessage}`;
        window.open(url, '_blank');
        setMessage("");
    };

    const handleSend = () => {
        if (!message.trim()) return;
        openTeamsChat(message);
    };

    const handleQuickAction = (actionMessage: string) => {
        openTeamsChat(actionMessage);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <Card className="h-full flex flex-col border-border/50 bg-gradient-to-br from-card/50 to-muted/20 backdrop-blur-sm overflow-hidden relative group">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at top right, ${AI_COLORS.light}, transparent 70%)`
                }}
            />

            {/* Header: Cleaned up to match standard widget format (Left aligned Text, no icon or block) */}
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 relative z-10">
                <CardTitle className="text-lg font-medium tracking-tight">
                    Chat Teams
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-4 relative z-10 p-4">
                {/* Visual AI Orb Area */}
                <div className="flex-1 flex flex-col justify-center items-center text-center -mt-4">
                    <MotionOrb />

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="space-y-1 relative z-20 mt-2"
                    >
                        <h3 className="font-semibold text-lg">Hola {user?.name?.split(' ')[0] || 'Gonzalo'}</h3>
                        <p className="text-muted-foreground text-xs max-w-[200px] mx-auto">
                            ¿En qué puedo ayudarte hoy?
                        </p>
                    </motion.div>
                </div>

                {/* Quick Actions (Chips) with updated default styling */}
                <div className="flex flex-wrap gap-2 justify-center mb-1">
                    {QUICK_ACTIONS.map((action, idx) => (
                        <motion.button
                            key={action.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8 + (idx * 0.1) }}
                            onClick={() => handleQuickAction(action.message)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium border transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm bg-background/50 backdrop-blur-sm",
                                action.color
                            )}
                        >
                            <action.icon className="h-3 w-3" />
                            {action.label}
                        </motion.button>
                    ))}
                </div>

                {/* Input Area */}
                <div className="relative mt-auto">
                    <div className="relative flex items-center bg-background/80 backdrop-blur border rounded-full shadow-sm focus-within:ring-2 transition-all group-hover:shadow-md"
                        style={{ borderColor: `${AI_COLORS.light}30` }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-primary rounded-full shrink-0 ml-1"
                            onClick={() => setIsTyping(!isTyping)}
                            title="Adjuntar Reporte"
                        >
                            <Paperclip className="h-4 w-4" />
                        </Button>

                        <Input
                            ref={inputRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu mensaje..."
                            className="border-none shadow-none focus-visible:ring-0 bg-transparent h-10 px-2 text-sm"
                        />

                        <Button
                            onClick={handleSend}
                            size="icon"
                            className="h-9 w-9 rounded-full mr-1 transition-all shrink-0"
                            style={{
                                backgroundColor: message.trim() ? AI_COLORS.blue : undefined,
                                opacity: message.trim() ? 1 : 0.5
                            }}
                            disabled={!message.trim()}
                        >
                            <Send className="h-4 w-4 text-white" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

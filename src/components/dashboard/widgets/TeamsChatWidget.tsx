import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Plain as Send, ChatLine as MessageSquare, Danger as AlertTriangle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { getTeamsRecipient } from "@/config/teamsConfig";

const QUICK_ACTIONS = [
    {
        label: "Diferencia de Stock",
        icon: AlertTriangle,
        color: "text-orange-500 border-orange-500/50 bg-orange-500/5",
        message: "Hola, he detectado una diferencia de stock importante en...",
    },
    {
        label: "Confirmar Cierre",
        icon: MessageSquare,
        color: "text-emerald-500 border-emerald-500/50 bg-emerald-500/5",
        message: "Solicito confirmar el cierre del inventario para...",
    },
    {
        label: "Solicitud Urgente",
        icon: Plus,
        color: "text-blue-500 border-blue-500/50 bg-blue-500/5",
        message: "Necesito autorización urgente para...",
    }
];

const Paperclip = ({ className }: { className?: string }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

const AI_COLORS = {
    dark: "#08102E",
    blue: "#045598",
    light: "#3b82f6" // Classic blue for the orb glow
};

const MotionOrb = () => {
    return (
        <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Core Glow */}
            <motion.div
                className="absolute inset-0 rounded-full blur-2xl opacity-40 bg-blue-500/50"
                animate={{
                    scale: [0.9, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Main Orb Body */}
            <div
                className="absolute w-24 h-24 rounded-full z-0 overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.5)]"
                style={{
                    background: `radial-gradient(circle at 30% 30%, ${AI_COLORS.light}, ${AI_COLORS.blue})`
                }}
            >
                {/* Glass Highlight */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30" />
            </div>

            {/* Central Icon */}
            <div className="relative z-10 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-white drop-shadow-md" strokeWidth={1.5} />
            </div>
        </div>
    );
};

export function TeamsChatWidget() {
    const { user } = useUser();
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const openTeamsChat = (text: string) => {
        const encodedMessage = encodeURIComponent(text);
        const targetEmail = getTeamsRecipient(user?.branchName);
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
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="h-full flex flex-col no-scrollbar p-4 sm:p-5">
            {/* Header: Clean & Integrated */}
            <div className="flex flex-row items-center justify-between mb-4">
                <span className="text-[20px] font-bold text-foreground tracking-tight">Chat Teams</span>
            </div>

            <div className="flex-1 flex flex-col relative z-10">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center text-center -mt-4">
                    <div className="scale-90 mb-4 sm:mb-6">
                        <MotionOrb />
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-[19px] sm:text-[21px] font-bold text-foreground tracking-tight leading-tight">
                            Hola {user?.name?.split(' ')[0] || 'Gonzalo'}
                        </h3>
                        <p className="text-muted-foreground text-[12px] sm:text-sm">
                            ¿En qué puedo ayudarte hoy?
                        </p>
                    </div>
                </div>

                {/* Quick Actions Area: Row layout */}
                <div className="flex flex-row items-center justify-between gap-2 px-1 mb-4">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.message)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full border text-[10px] font-bold transition-all active:scale-[0.95]",
                                action.color
                            )}
                        >
                            <action.icon className="w-3.5 h-3.5" />
                            <span className="truncate">{action.label}</span>
                        </button>
                    ))}
                </div>

                {/* Single Area Input: Reverted design */}
                <div className="px-3 pb-4">
                    <div className="bg-muted/40 border border-border/40 rounded-full flex items-center p-1 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5">
                        <div className="flex items-center justify-center w-9 h-9 text-muted-foreground ml-1">
                            <Paperclip className="w-5 h-5 opacity-60" />
                        </div>
                        
                        <input
                            ref={inputRef as any}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown as any}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 bg-transparent border-none focus:outline-none text-[13px] px-2 placeholder:text-muted-foreground/50"
                        />
                        
                        <Button
                            onClick={handleSend}
                            size="icon"
                            className={cn(
                                "h-9 w-9 rounded-full transition-all flex items-center justify-center shadow-lg mr-0.5",
                                message.trim() 
                                    ? "bg-[#045598] hover:bg-[#03447a] text-white" 
                                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                            )}
                            disabled={!message.trim()}
                        >
                            <Send className="h-5 w-5" strokeWidth={1.5} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

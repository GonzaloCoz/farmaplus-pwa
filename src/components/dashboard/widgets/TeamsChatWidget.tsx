import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { getTeamsRecipient } from "@/config/teamsConfig";
import { cn } from "@/lib/utils";
import {
  HelpCircle as CircleQuestionMarkIcon,
  Sparkles as SparklesIcon,
  X,
  CornerDownLeft as CornerDownLeftIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TextSwap } from "@/components/ui/text-swap";
import { useAIChat } from "@/hooks/useAIChat";
import { aiChatService } from "@/services/aiChatService";
import { useProactiveAlerts } from "@/hooks/useProactiveAlerts";

const DEFAULT_WELCOME_MESSAGE = `Hola. Soy tu **Asistente de Inventarios y Teams** de Farmaplus.
Puedo responder tus dudas sobre auditoría de stock, control de vencimientos, diferencias y el proceso general de inventarios cíclicos.
También puedo redactar mensajes pre-configurados para que los envíes directamente por **Microsoft Teams**.
*Prueba preguntando: "¿Cómo reporto una diferencia de stock?", "¿Cómo cierro un laboratorio?" o "¿Cómo audito vencimientos?"*`;

const DEFAULT_LINKS = [
  { label: "Enviar Alerta de Stock", type: "teams" as const, target: "Hola, he detectado una diferencia de stock importante." },
  { label: "Ir a Inventarios", type: "navigate" as const, route: "/cyclic-inventory" },
  { label: "Ver Vencimientos", type: "navigate" as const, route: "/stock/expiration-control" },
  { label: "Ver Reportes", type: "navigate" as const, route: "/reports" },
  { label: "Soporte Técnico", type: "teams" as const, target: "Hola, necesito asistencia técnica con el sistema de inventarios." },
  { label: "Centro de Capacitación", type: "navigate" as const, route: "/foro" }
];

export const TeamsChatWidget = memo(function TeamsChatWidget() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  
  const {
    messages,
    isGenerating,
    streamedText,
    actions,
    error,
    sendMessage,
    injectProactiveMessage,
    resetChat
  } = useAIChat();

  const { alert, dismissAlert } = useProactiveAlerts(user?.branchName);
  const [showAlertBanner, setShowAlertBanner] = useState(false);

  // Pre-load the Ollama model into memory as soon as the chat widget mounts.
  // This eliminates the cold-start delay on the user's first message.
  useEffect(() => {
    aiChatService.warmup();
  }, []);

  const handleTriggerProactive = useCallback(() => {
    if (!alert) return;
    
    let displayName = "🔍 Analizar alerta de sistema";
    if (alert.type === 'discrepancy' && alert.details.laboratory) {
      displayName = `🔍 Analizar diferencias del laboratorio ${alert.details.laboratory}`;
    } else if (alert.type === 'stalled' && alert.details.laboratory) {
      displayName = `⏳ Revisar estado del laboratorio ${alert.details.laboratory}`;
    } else if (alert.type === 'expiration' && alert.details.productName) {
      displayName = `⚠️ Auditar vencimiento de ${alert.details.productName}`;
    }

    injectProactiveMessage(alert.suggestedQuery, displayName, user?.branchName);
    setShowAlertBanner(false);
    dismissAlert();
  }, [alert, injectProactiveMessage, user?.branchName, dismissAlert]);

  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    if (alert && messages.length === 0 && !isGenerating && !autoTriggeredRef.current) {
      setShowAlertBanner(true);
      autoTriggeredRef.current = true;

      const timer = setTimeout(() => {
        handleTriggerProactive();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [alert, messages.length, isGenerating, handleTriggerProactive]);

  const [thinkingIndex, setThinkingIndex] = useState(0);
  const THINKING_STATES = useMemo(() => [
    "Pensando...",
    "Consultando la base de datos...",
    "Analizando inventarios...",
    "Generando respuesta..."
  ], []);

  useEffect(() => {
    if (isGenerating && !streamedText) {
      const interval = setInterval(() => {
        setThinkingIndex((prev) => (prev + 1) % THINKING_STATES.length);
      }, 1250);
      return () => clearInterval(interval);
    } else {
      setThinkingIndex(0);
    }
  }, [isGenerating, streamedText, THINKING_STATES.length]);

  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or stream chunks
  useEffect(() => {
    const scrollToBottom = () => {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
    };
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, streamedText, isGenerating]);

  const openTeamsChat = useCallback((text: string) => {
    const encodedMessage = encodeURIComponent(text);
    const targetEmail = getTeamsRecipient(user?.branchName);
    const url = `https://teams.microsoft.com/l/chat/0/0?users=${targetEmail}&message=${encodedMessage}`;
    window.open(url, '_blank');
  }, [user?.branchName]);

  const handleClear = useCallback(() => {
    autoTriggeredRef.current = false;
    resetChat();
    setQuery("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [resetChat]);

  const handleSend = useCallback(() => {
    if (!query.trim() || isGenerating) return;
    sendMessage(query, user?.branchName);
    setQuery("");
  }, [query, isGenerating, sendMessage, user?.branchName]);

  const renderResponseText = (text: string) => {
    return text.split("\n").map((line, index) => {
      if (line.trim() === "") return null;
      
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const content = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-bold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      // Handle simple list items
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li key={index} className="ml-4 list-disc text-sm text-foreground/90 font-medium leading-relaxed my-0.5">
            {content}
          </li>
        );
      }

      // Handle numbered list items
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <li key={index} className="ml-4 list-decimal text-sm text-foreground/90 font-medium leading-relaxed my-0.5">
            {content}
          </li>
        );
      }

      return (
        <p key={index} className="leading-relaxed text-sm text-foreground/90 font-medium py-1">
          {content}
        </p>
      );
    });
  };

  const showWelcome = messages.length === 0 && !streamedText && !isGenerating;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      {/* Top Search Bar */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3 bg-muted/10 dark:bg-zinc-900/10 shrink-0">
        <div className="text-blue-500 shrink-0">
          <SparklesIcon className={cn("size-4", isGenerating && "animate-pulse")} />
        </div>
        <input
          disabled={isGenerating}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          placeholder="Pregunta a la IA sobre stock, vencimientos..."
          ref={inputRef}
          className="flex-1 bg-transparent border-none focus:outline-none text-sm font-semibold placeholder:text-muted-foreground/45 text-foreground leading-relaxed h-8 focus:ring-0"
          value={query}
        />
        {(query || messages.length > 0 || isGenerating) && (
          <button
            onClick={handleClear}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            title="Limpiar chat"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Proactive Alert Banner */}
      {showAlertBanner && alert && (
        <div className={cn(
          "px-4 py-2.5 border-b text-xs flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300",
          alert.severity === 'critical' 
            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" 
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
        )}>
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span className="truncate">
              {alert.type === 'discrepancy' && `Diferencias detectadas en laboratorio ${alert.details.laboratory}`}
              {alert.type === 'stalled' && `Laboratorio estancado: ${alert.details.laboratory}`}
              {alert.type === 'expiration' && `Producto por vencer: ${alert.details.productName}`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              variant="ghost"
              className={cn(
                "h-6 px-2 text-[10px] font-bold rounded-md hover:bg-black/5 dark:hover:bg-white/5",
                alert.severity === 'critical' ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
              )}
              onClick={handleTriggerProactive}
            >
              Analizar ahora
            </Button>
            <button
              onClick={() => {
                setShowAlertBanner(false);
                dismissAlert();
              }}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Body Area */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full w-full">
          <ScrollAreaViewport 
            ref={viewportRef as any}
            className="h-full w-full outline-none"
            scrollFade
          >
            <div className="p-5 flex flex-col gap-4">
              {showWelcome && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="text-muted-foreground text-sm space-y-3 leading-relaxed">
                    {renderResponseText(DEFAULT_WELCOME_MESSAGE)}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {DEFAULT_LINKS.map((link, index) => (
                      <Button
                        key={`${link.route || link.target}-${index}`}
                        onClick={() => {
                          if (link.type === "navigate" && link.route) {
                            navigate(link.route);
                          } else if (link.type === "teams" && link.target) {
                            openTeamsChat(link.target);
                          }
                        }}
                        size="sm"
                        variant="secondary"
                        className="text-xs font-bold px-4 py-2 h-auto rounded-full hover:bg-muted border border-border/30 bg-muted/40 shadow-xs"
                      >
                        {link.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat History */}
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "flex flex-col gap-1 w-full animate-in fade-in duration-200",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <span className={cn(
                    "text-xs font-semibold px-1 mb-1",
                    msg.role === "user" ? "text-muted-foreground" : "text-blue-500 flex items-center gap-1.5"
                  )}>
                    {msg.role === "user" ? (
                      "Tú"
                    ) : (
                      <>
                        <SparklesIcon className="size-3.5" /> Asistente de Inventarios
                      </>
                    )}
                  </span>
                  
                  <div className={cn(
                    "text-sm rounded-2xl px-4 py-2.5 max-w-[85%] border leading-relaxed",
                    msg.role === "user" 
                      ? "bg-primary/10 dark:bg-zinc-800 text-foreground border-primary/10" 
                      : "bg-muted/10 dark:bg-zinc-900/10 text-muted-foreground border-border/20 space-y-2"
                  )}>
                    {msg.role === "user" ? (
                      msg.displayContent || msg.content
                    ) : (
                      renderResponseText(msg.content)
                    )}
                  </div>
                </div>
              ))}

              {/* Generating Block */}
              {isGenerating && (
                <div className="flex flex-col gap-1 items-start w-full animate-in fade-in duration-200">
                  <span className="text-xs font-semibold text-blue-500 px-1 flex items-center gap-1.5 mb-1">
                    <SparklesIcon className="size-3.5 animate-pulse" />
                    <TextSwap text={!streamedText ? THINKING_STATES[thinkingIndex] : "Asistente de Inventarios (Escribiendo...)"} />
                  </span>

                  {!streamedText ? (
                    <div className="flex flex-col gap-2 w-full max-w-[85%] pt-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-[92%]" />
                      <Skeleton className="h-4 w-[60%]" />
                    </div>
                  ) : (
                    <div className="text-sm rounded-2xl px-4 py-2.5 max-w-[85%] border bg-muted/10 dark:bg-zinc-900/10 text-muted-foreground border-border/20 space-y-2 relative">
                      {renderResponseText(streamedText)}
                      <span className="inline-block w-1.5 h-3.5 bg-blue-500 animate-pulse ml-1 align-middle" />
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div 
                  aria-live="polite" 
                  className="text-red-500 text-xs font-semibold p-4 rounded-xl border border-red-500/20 bg-red-500/5 animate-in shake duration-300" 
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Action Buttons for the latest response */}
              {!isGenerating && !showWelcome && (
                <div className="mt-2 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  {actions.length > 0 ? (
                    actions.map((link, index) => (
                      <Button
                        key={`${link.route || link.target}-${index}`}
                        onClick={() => {
                          if (link.type === "navigate" && link.route) {
                            navigate(link.route);
                          } else if (link.type === "teams" && link.target) {
                            openTeamsChat(link.target);
                          }
                        }}
                        size="sm"
                        variant="secondary"
                        className="text-xs font-bold px-4 py-2 h-auto rounded-full hover:bg-muted border border-border/30 bg-muted/40 shadow-xs"
                      >
                        {link.label}
                      </Button>
                    ))
                  ) : (
                    // Default fallback buttons when no actions are returned
                    DEFAULT_LINKS.slice(0, 3).map((link, index) => (
                      <Button
                        key={`${link.route || link.target}-${index}`}
                        onClick={() => {
                          if (link.type === "navigate" && link.route) {
                            navigate(link.route);
                          } else if (link.type === "teams" && link.target) {
                            openTeamsChat(link.target);
                          }
                        }}
                        size="sm"
                        variant="secondary"
                        className="text-xs font-bold px-4 py-2 h-auto rounded-full hover:bg-muted border border-border/30 bg-muted/40 shadow-xs"
                      >
                        {link.label}
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>
      </div>
    </div>
  );
});

import { ArrowDown as ArrowDownIcon, ArrowLeft as ArrowLeftIcon, ArrowUp as ArrowUpIcon, ArrowDownLeft as CornerDownLeftIcon, SearchLg as SearchIcon, Stars01 as SparklesIcon } from '@untitledui/icons';
import { useNavigate } from "react-router-dom";
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Command,
    CommandDialog,
    CommandDialogPopup,
    CommandEmpty,
    CommandFooter,
    CommandGroup,
    CommandGroupLabel,
    CommandInput,
    CommandItem,
    CommandList,
    CommandPanel,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { EmptyMedia } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { aiChatService, parseActions, type AIAction } from "@/services/aiChatService";
import { normalizeString } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommandItem {
    value: string;
    label: string;
    shortcut?: string;
    path?: string;
    keywords?: string[];
    action?: () => void;
}

interface CommandGroup {
    value: string;
    items: CommandItem[];
}

interface AIState {
    mode: boolean;
    query: string;
    submittedQuery: string;
    response: string;
    referenceLinks: AIAction[];
    isGenerating: boolean;
    error: string | null;
}

const initialAIState: AIState = {
    error: null,
    isGenerating: false,
    mode: false,
    query: "",
    referenceLinks: [],
    response: "",
    submittedQuery: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function markdownToSafeHTML(markdown: string): string {
    return markdown
        .split("\n\n")
        .map((para) => `<p>${para.trim()}</p>`)
        .join("");
}

function contains(source: string, query: string): boolean {
    if (!query.trim()) return true;
    const normalizedSource = normalizeString(source);
    const normalizedQuery = normalizeString(query);
    return normalizedSource.includes(normalizedQuery);
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface SuperSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SuperSearch({ open, onOpenChange }: SuperSearchProps) {
    const navigate = useNavigate();
    const { allBranches } = useUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [aiState, setAIState] = useState<AIState>(initialAIState);
    const [profiles, setProfiles] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            supabase
                .from("profiles")
                .select("username, full_name, role")
                .then(({ data }) => {
                    if (data) setProfiles(data);
                });
        }
    }, [open]);

    const aiInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const commandResetKeyRef = useRef(0);

    // Ctrl+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onOpenChange]);

    // Cleanup on unmount
    useEffect(() => {
        return () => { abortControllerRef.current?.abort(); };
    }, []);

    // Focus AI input when entering AI mode
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        if (aiState.mode && !aiState.isGenerating) {
            timer = setTimeout(() => aiInputRef.current?.focus(), 50);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [aiState.mode, aiState.isGenerating]);

    // Escape in AI mode → back to search
    useEffect(() => {
        if (!open || !aiState.mode) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleBackToSearch();
            }
        };
        document.addEventListener("keydown", handler, true);
        return () => document.removeEventListener("keydown", handler, true);
    }, [open, aiState.mode]);

    // ── Dynamic command groups ────────────────────────────────────────────────

    const commandGroups = useMemo((): CommandGroup[] => {
        const PAGES: CommandItem[] = [
            { value: "dashboard", label: "Dashboard", shortcut: "Vista general de métricas", path: "/", keywords: ["inicio", "home", "metricas"] },
            { value: "smart-analyst", label: "Analista Inteligente", shortcut: "Asistente con IA", path: "/smart-analyst", keywords: ["ia", "ai", "analista"] },
            { value: "cyclic-inventory", label: "Inventarios Cíclicos", shortcut: "Ajustes e inventario", path: "/cyclic-inventory", keywords: ["inventario", "ciclico", "stock"] },
            { value: "reports", label: "Reportes y Auditoría", shortcut: "Historial y logs", path: "/reports", keywords: ["reporte", "auditoria", "log"] },
        ];

        const filteredPages = searchQuery.trim()
            ? PAGES.filter(p =>
                contains(p.label, searchQuery) ||
                (p.keywords?.some(k => contains(k, searchQuery)) ?? false)
            )
            : PAGES;

        const branchItems: CommandItem[] = searchQuery.trim()
            ? allBranches
                .filter(b => contains(b, searchQuery))
                .slice(0, 8)
                .map(name => ({
                    value: `branch-${name}`,
                    label: `Farmacia ${name}`,
                    shortcut: "Sucursal",
                    path: `/reports?branch=${encodeURIComponent(name)}`,
                    keywords: ["sucursal", "farmacia"],
                }))
            : [];

        const userItems: CommandItem[] = searchQuery.trim()
            ? profiles
                .filter(u =>
                    contains(u.full_name || "", searchQuery) ||
                    contains(u.username || "", searchQuery)
                )
                .slice(0, 6)
                .map(u => ({
                    value: `user-${u.username}`,
                    label: u.full_name || u.username,
                    shortcut: `@${u.username}${u.role === "mod" ? " · Admin" : ""}`,
                    path: `/admin/users?search=${encodeURIComponent(u.username)}`,
                    keywords: ["usuario", "user"],
                }))
            : [];

        const systemItems: CommandItem[] = !searchQuery.trim() ? [
            {
                value: "sync",
                label: "Sincronizar base de datos",
                shortcut: "↻ Actualizar",
                action: () => window.location.reload(),
            },
        ] : [];

        const groups: CommandGroup[] = [];

        if (filteredPages.length > 0) {
            groups.push({ value: "Navegación", items: filteredPages });
        }
        if (branchItems.length > 0) {
            groups.push({ value: "Sucursales", items: branchItems });
        }
        if (userItems.length > 0) {
            groups.push({ value: "Usuarios", items: userItems });
        }
        if (systemItems.length > 0) {
            groups.push({ value: "Sistema", items: systemItems });
        }

        return groups;
    }, [searchQuery, allBranches, profiles]);

    const hasResults = commandGroups.some(g => g.items.length > 0);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleItemSelect = useCallback((item: CommandItem) => {
        onOpenChange(false);
        if (item.action) {
            item.action();
        } else if (item.path) {
            navigate(item.path);
        }
    }, [navigate, onOpenChange]);

    const resetAIState = useCallback(() => {
        abortControllerRef.current?.abort();
        setAIState(initialAIState);
    }, []);

    const handleBackToSearch = useCallback(() => {
        resetAIState();
        setSearchQuery("");
        commandResetKeyRef.current += 1;
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, [resetAIState]);

    const handleOpenChange = useCallback((newOpen: boolean) => {
        onOpenChange(newOpen);
        if (!newOpen) {
            setSearchQuery("");
            resetAIState();
        }
    }, [onOpenChange, resetAIState]);

    const handleGenerateAI = useCallback(async (queryOverride?: string) => {
        const query = queryOverride ?? aiState.query;
        if (!query.trim()) return;

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setAIState(prev => ({
            ...prev,
            error: null,
            isGenerating: true,
            query: "",
            referenceLinks: [],
            response: "",
            submittedQuery: query,
        }));

        let accumulated = "";

        await aiChatService.streamChat({
            messages: [{ role: "user", content: query }],
            branchName: null,
            signal: controller.signal,
            onChunk: (chunk) => {
                accumulated += chunk;
                // Show progressive text — strip action markers during streaming
                setAIState(prev => ({
                    ...prev,
                    response: accumulated.replace(/ACTIONS:\s*(\[[\s\S]*?\])/i, "").trim(),
                }));
            },
            onComplete: (_finalText, actions) => {
                const { cleanText } = parseActions(accumulated);
                setAIState(prev => ({
                    ...prev,
                    isGenerating: false,
                    response: cleanText,
                    referenceLinks: actions,
                }));
            },
            onError: (error) => {
                if (controller.signal.aborted) return;
                setAIState(prev => ({
                    ...prev,
                    isGenerating: false,
                    error: error.message || "Error al generar respuesta. Intentá de nuevo.",
                }));
            },
        });
    }, [aiState.query]);

    const handleAskAI = useCallback(() => {
        const currentQuery = searchQuery;
        setSearchQuery("");
        if (currentQuery.trim()) {
            setAIState(prev => ({ ...prev, mode: true }));
            handleGenerateAI(currentQuery);
        } else {
            setAIState(prev => ({ ...prev, mode: true, query: "" }));
        }
    }, [searchQuery, handleGenerateAI]);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <CommandDialog onOpenChange={handleOpenChange} open={open}>
            <CommandDialogPopup>
                {!aiState.mode ? (
                    /* ── Search Mode ─────────────────────────────────── */
                    <Command key={commandResetKeyRef.current}>
                        <div className="relative flex items-center *:first:flex-1">
                            <CommandInput
                                placeholder="Buscar páginas, sucursales, productos..."
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                ref={searchInputRef}
                                onKeyDown={(e) => {
                                    if (e.key === "Tab") {
                                        e.preventDefault();
                                        handleAskAI();
                                    }
                                    if (e.key === "Enter" && !hasResults && searchQuery.trim()) {
                                        e.preventDefault();
                                        handleAskAI();
                                    }
                                }}
                            />
                            <Button
                                className="me-2.5 rounded-md not-hover:text-muted-foreground text-sm sm:text-xs"
                                onClick={handleAskAI}
                                size="sm"
                                variant="ghost"
                            >
                                <SparklesIcon className="size-4 sm:size-3.5" />
                                Ask AI
                                <Kbd className="ms-0.5 -me-1.5">Tab</Kbd>
                            </Button>
                        </div>

                        <CommandPanel>
                            <CommandList>
                                <CommandEmpty>
                                    {searchQuery.trim() && (
                                        <div className="flex flex-col flex-wrap items-center gap-2 break-words">
                                            <EmptyMedia variant="icon">
                                                <SearchIcon />
                                            </EmptyMedia>
                                            <p className="text-sm text-muted-foreground">Sin resultados.</p>
                                            <p className="text-sm text-muted-foreground text-center">
                                                Presioná <Kbd>Enter</Kbd> para consultar a la IA:{" "}
                                                <strong className="font-medium text-foreground">
                                                    {searchQuery}
                                                </strong>
                                            </p>
                                        </div>
                                    )}
                                </CommandEmpty>

                                {commandGroups.map((group, i) => (
                                    <Fragment key={group.value}>
                                        <CommandGroup>
                                            <CommandGroupLabel>{group.value}</CommandGroupLabel>
                                            {group.items.map((item) => (
                                                <CommandItem
                                                    key={item.value}
                                                    value={item.value}
                                                    onSelect={() => handleItemSelect(item)}
                                                >
                                                    <span className="flex-1">{item.label}</span>
                                                    {item.shortcut && (
                                                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                                                    )}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        {i < commandGroups.length - 1 && <CommandSeparator />}
                                    </Fragment>
                                ))}
                            </CommandList>
                        </CommandPanel>

                        <CommandFooter>
                            {hasResults ? (
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <KbdGroup>
                                                <Kbd><ArrowUpIcon className="size-3" /></Kbd>
                                                <Kbd><ArrowDownIcon className="size-3" /></Kbd>
                                            </KbdGroup>
                                            <span>Navegar</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Kbd><CornerDownLeftIcon className="size-3" /></Kbd>
                                            <span>Abrir</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Kbd>Esc</Kbd>
                                        <span>Cerrar</span>
                                    </div>
                                </>
                            ) : (
                                <div className="ms-auto flex items-center gap-2">
                                    <Kbd>Esc</Kbd>
                                    <span>Cerrar</span>
                                </div>
                            )}
                        </CommandFooter>
                    </Command>
                ) : (
                    /* ── AI Mode ─────────────────────────────────────── */
                    <Command>
                        <div className="flex items-center *:first:flex-1">
                            <div className="px-2.5 py-1.5">
                                <div className="relative w-full">
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-3 opacity-80 [&_svg]:size-4"
                                    >
                                        <SparklesIcon />
                                    </div>
                                    <Input
                                        aria-label="Consulta a la IA"
                                        className="border-transparent! bg-transparent! shadow-none before:hidden focus-visible:ring-0 ps-9"
                                        disabled={aiState.isGenerating}
                                        onChange={(e) =>
                                            setAIState(prev => ({ ...prev, query: e.target.value }))
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !aiState.isGenerating) {
                                                handleGenerateAI();
                                            }
                                            if (e.key === "Escape") {
                                                e.preventDefault();
                                                handleBackToSearch();
                                            }
                                        }}
                                        placeholder="Preguntale a la IA sobre el sistema..."
                                        ref={aiInputRef}
                                        value={aiState.query}
                                    />
                                </div>
                            </div>
                            <Button
                                className="me-2.5 rounded-md not-hover:text-muted-foreground text-sm sm:text-xs"
                                onClick={handleBackToSearch}
                                size="sm"
                                variant="ghost"
                            >
                                <ArrowLeftIcon className="size-4 sm:size-3.5" />
                                Volver
                                <Kbd className="ms-0.5 -me-1.5">Esc</Kbd>
                            </Button>
                        </div>

                        <CommandPanel>
                            <ScrollArea className="max-h-[380px]">
                                <ScrollAreaViewport>
                                    <div className="p-5">
                                        {/* Idle state */}
                                        {!aiState.isGenerating && !aiState.response && !aiState.error && (
                                            <div className="flex items-center justify-center py-12">
                                                <p className="text-muted-foreground text-sm text-center">
                                                    Escribí tu pregunta y presioná{" "}
                                                    <Kbd>Enter</Kbd> para comenzar.
                                                </p>
                                            </div>
                                        )}

                                        {/* Error state */}
                                        {aiState.error && (
                                            <div
                                                aria-live="polite"
                                                className="text-destructive text-sm"
                                                role="alert"
                                            >
                                                {aiState.error}
                                            </div>
                                        )}

                                        {/* Loading skeleton */}
                                        {aiState.isGenerating && !aiState.response && (
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col gap-2">
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-1/2" />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-3/4" />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-3/5" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Streaming / completed response */}
                                        {aiState.response && (
                                            <>
                                                <div
                                                    aria-live="polite"
                                                    className="text-muted-foreground text-sm **:[p]:not-first:mt-3 **:[p]:leading-relaxed **:[strong,a]:font-medium **:[strong,a]:text-foreground **:[code]:rounded-md **:[code]:bg-muted **:[code]:px-[0.3rem] **:[code]:py-[0.2rem] **:[code]:font-mono **:[a]:underline **:[a]:underline-offset-4"
                                                    dangerouslySetInnerHTML={{
                                                        __html: markdownToSafeHTML(aiState.response),
                                                    }}
                                                />

                                                {/* Action buttons (navigate, teams, etc.) */}
                                                {!aiState.isGenerating && aiState.referenceLinks.length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {aiState.referenceLinks.map((action, index) => (
                                                            <Button
                                                                key={`${action.route ?? action.target}-${index}`}
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    onOpenChange(false);
                                                                    if (action.type === "navigate" && action.route) {
                                                                        navigate(action.route);
                                                                    }
                                                                }}
                                                            >
                                                                {action.label}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </ScrollAreaViewport>
                                <ScrollAreaScrollbar />
                            </ScrollArea>
                        </CommandPanel>

                        <CommandFooter>
                            {aiState.isGenerating ? (
                                <div aria-live="polite" className="flex items-center gap-2">
                                    <div className="flex h-5 items-center justify-center">
                                        <Spinner className="size-3" />
                                    </div>
                                    <span className="animate-pulse">Generando respuesta…</span>
                                </div>
                            ) : aiState.response ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                    <SparklesIcon className="size-3 shrink-0" />
                                    <span className="truncate">
                                        Consultaste: &ldquo;{aiState.submittedQuery}&rdquo;
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Kbd><CornerDownLeftIcon className="size-3" /></Kbd>
                                    <span>Preguntar a la IA</span>
                                </div>
                            )}
                        </CommandFooter>
                    </Command>
                )}
            </CommandDialogPopup>
        </CommandDialog>
    );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInput,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupActions,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuActions,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownSearch,
  DropdownEmpty,
  MenuItem,
} from "@/components/ui/dropdown";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { InputMessage, type QueuedMessage } from "@/components/ui/input-message";
import { ChatMessage } from "@/components/ui/chat-message";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import { FileThumbnail } from "@/components/ui/file-thumbnail";
import { spring, exitFallbackMs } from "@/lib/springs";
import { useShape } from "@/lib/shape-context";
import { SizeProvider } from "@/lib/size-context";
import { Elevated } from "@/lib/elevated";
import { popupMotionClass } from "@/lib/popup";
import { useFluidHover } from "@/hooks/use-fluid-hover";
import { FluidHoverHighlight } from "@/components/ui/fluid-hover-highlight";
import { HugeiconsIcon } from "@hugeicons/react";
import SmileIcon from "@hugeicons/core-free-icons/SmileIcon";
import Pin02Icon from "@hugeicons/core-free-icons/Pin02Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import HugeCheckIcon from "@hugeicons/core-free-icons/CheckIcon";
import HugeCheckCheckIcon from "@hugeicons/core-free-icons/CheckCheckIcon";
import CheckUnread01Icon from "@hugeicons/core-free-icons/CheckUnread01Icon";
import { useIcons, type IconComponent } from "@/lib/icon-context";
import { fontWeights } from "@/lib/font-weight";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import {
  agregarMiembrosGrupo,
  alternarFijadoHilo,
  asegurarIdentidad,
  crearGrupoMensajeria,
  crearOAbrirConversacion,
  descargarAdjuntoSellado,
  descifrarFilaMensaje,
  editarMensaje,
  editarMensajeGrupo,
  eliminarConversacion,
  eliminarMensajePropio,
  enviarMensaje,
  enviarMensajeGrupo,
  listarContactosYConversaciones,
  marcarEstadoMensajes,
  marcarLeidoGrupo,
  notificarCambioNoLeidos,
  salirDeGrupo,
  suscribirMensajeriaRealtime,
  vaciarGrupoParaOperador,
  type AdjuntoSellado,
  type ControladorSuscripcionMensajeria,
  type MiembroGrupoInfo,
  type ReplyToPayload,
} from "@/services/mensajeriaService";

export interface MessageThreadItem {
  id: string;
  tipo?: "directo" | "grupo";
  contactId?: string;
  label: string;
  sector: string;
  badge: number;
  unread?: boolean;
  avatarUrl?: string;
  online?: boolean;
  fijado?: boolean;
  extremoParPublico?: number[];
  miembros?: MiembroGrupoInfo[];
  esAdminGrupo?: boolean;
  vistoPor?: {
    leidos: number;
    total: number;
    nombres: string[];
  };
}

const PinIconCompat: IconComponent = ({ size = 16, strokeWidth = 1.6, className }) => (
  <HugeiconsIcon icon={Pin02Icon} size={size} strokeWidth={strokeWidth} className={className} />
);

function getContactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderTextoConMenciones(
  texto: string,
  miembros?: MiembroGrupoInfo[],
  yo?: { name?: string | null; username?: string | null; branchName?: string | null } | null
) {
  if (!texto || !texto.includes("@")) return texto;

  const nombres = Array.from(
    new Set(
      [
        "todos",
        ...(miembros ?? []).flatMap((m) => [m.nombre, m.sector]),
        yo?.name ?? "",
        yo?.username ?? "",
        yo?.branchName ?? "",
      ]
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
    )
  ).sort((a, b) => b.length - a.length);

  const patronNombres =
    nombres.length > 0
      ? `@(?:${nombres.map(escapeRegExp).join("|")})|@[A-Za-zÀ-ÿ0-9._-]+`
      : `@[A-Za-zÀ-ÿ0-9._-]+`;
  const regex = new RegExp(`(^|\\s)(${patronNombres})(?=$|[\\s.,!?;:])`, "gi");

  const partes: React.ReactNode[] = [];
  let ultimoIndice = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(texto)) !== null) {
    const inicio = match.index + match[1].length;
    if (inicio > ultimoIndice) {
      partes.push(texto.slice(ultimoIndice, inicio));
    }
    const mencion = match[2];
    const token = mencion.slice(1).trim().toLowerCase();
    const esParaMi =
      token === "todos" ||
      (yo?.name && token === yo.name.trim().toLowerCase()) ||
      (yo?.username && token === yo.username.trim().toLowerCase()) ||
      (yo?.branchName && token === yo.branchName.trim().toLowerCase());

    partes.push(
      <span
        key={`m-${keyIdx++}`}
        className={cn(
          "inline-block rounded px-1 py-px font-medium",
          esParaMi
            ? "bg-primary/20 text-primary"
            : "bg-foreground/10 text-foreground"
        )}
      >
        {mencion}
      </span>
    );
    ultimoIndice = inicio + mencion.length;
  }

  if (partes.length === 0) return texto;
  if (ultimoIndice < texto.length) {
    partes.push(texto.slice(ultimoIndice));
  }
  return partes;
}

const INITIAL_THREADS: MessageThreadItem[] = [
  {
    id: "thread-1",
    label: "Mariana Gómez",
    sector: "Sucursal Central",
    badge: 0,
    unread: false,
    online: true,
  },
  {
    id: "thread-2",
    label: "Lucas Fernández",
    sector: "Sucursal Belgrano",
    badge: 4,
    unread: true,
    online: true,
  },
  {
    id: "thread-3",
    label: "Sofía Martínez",
    sector: "Sucursal Palermo",
    badge: 0,
    unread: false,
    online: false,
  },
  {
    id: "thread-4",
    label: "Martín López",
    sector: "Sucursal Caballito",
    badge: 0,
    unread: false,
    online: false,
  },
  {
    id: "thread-5",
    label: "Valentina Ruiz",
    sector: "Casa Central",
    badge: 2,
    unread: true,
    online: true,
  },
  {
    id: "thread-6",
    label: "Julián Pereyra",
    sector: "Sucursal Recoleta",
    badge: 0,
    unread: false,
    online: false,
  },
  {
    id: "thread-7",
    label: "Camila Torres",
    sector: "Sucursal Norte",
    badge: 0,
    unread: false,
    online: true,
  },
];

export type MessageStatus = "sent" | "delivered" | "read" | "error";

export interface ThreadMessage {
  id: string;
  remitenteId?: string;
  remitenteNombre?: string;
  remitenteSector?: string;
  from: "user" | "assistant";
  text: string;
  files: File[];
  attachments?: AdjuntoSellado[];
  time?: string;
  createdAt?: string;
  replyTo?: string;
  replyToPayload?: ReplyToPayload;
  edited?: boolean;
  status?: MessageStatus;
}

function formatTamanoCorto(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AdjuntoRemotoItem({
  adjunto,
  onOpenPreview,
}: {
  adjunto: AdjuntoSellado;
  onOpenPreview: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [expirado, setExpirado] = useState(false);
  const esImagen = adjunto.mime.startsWith("image/");

  useEffect(() => {
    if (!esImagen) return;
    let cancelado = false;
    setCargando(true);
    descargarAdjuntoSellado(adjunto)
      .then((f) => {
        if (!cancelado) setFile(f);
      })
      .catch(() => {
        if (!cancelado) setExpirado(true);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [adjunto, esImagen]);

  const handleClick = async () => {
    if (file) {
      onOpenPreview(file);
      return;
    }
    if (cargando || expirado) return;
    setCargando(true);
    try {
      const descargado = await descargarAdjuntoSellado(adjunto);
      setFile(descargado);
      onOpenPreview(descargado);
    } catch {
      setExpirado(true);
    } finally {
      setCargando(false);
    }
  };

  if (file) {
    return (
      <button
        type="button"
        onClick={() => onOpenPreview(file)}
        title={`Ver ${adjunto.nombre}`}
        aria-label={`Ver adjunto ${adjunto.nombre}`}
        className="cursor-pointer rounded-lg transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      >
        <FileThumbnail file={file} size={64} />
      </button>
    );
  }

  const ext = adjunto.nombre.split(".").pop()?.toUpperCase().slice(0, 4) || "ARCH";

  if (esImagen && !expirado) {
    return (
      <div
        className="flex size-16 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-[10px] text-muted-foreground"
        title={adjunto.nombre}
      >
        {cargando ? "..." : ext}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={expirado}
      title={expirado ? `${adjunto.nombre} (expirado)` : `${adjunto.nombre} · ${formatTamanoCorto(adjunto.tamano)}`}
      aria-label={`Abrir ${adjunto.nombre}`}
      className={cn(
        "flex h-12 max-w-[220px] items-center gap-2.5 rounded-lg border border-border/60 bg-muted/35 px-3 text-left transition-colors",
        expirado ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/60"
      )}
    >
      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
        {ext}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-foreground">
          {adjunto.nombre}
        </span>
        <span className="block text-[10px] text-muted-foreground">
          {expirado ? "Expirado" : cargando ? "Descifrando..." : formatTamanoCorto(adjunto.tamano)}
        </span>
      </span>
    </button>
  );
}

function getDateKey(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function formatDateSeparator(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  const day = format(date, "d", { locale: es });
  const monthRaw = format(date, "MMMM", { locale: es });
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  return `${day} de ${month}`;
}

function renderMessageStatus(status: MessageStatus = "sent") {
  switch (status) {
    case "delivered":
      return (
        <HugeiconsIcon
          icon={HugeCheckCheckIcon}
          size={13}
          strokeWidth={1.8}
          className="shrink-0 text-muted-foreground"
          aria-label="Recibido"
        />
      );
    case "read":
      return (
        <HugeiconsIcon
          icon={HugeCheckCheckIcon}
          size={13}
          strokeWidth={1.8}
          className="shrink-0 text-[oklch(0.55_0.16_225)] dark:text-[oklch(0.76_0.14_220)]"
          aria-label="Leído"
        />
      );
    case "error":
      return (
        <HugeiconsIcon
          icon={CheckUnread01Icon}
          size={13}
          strokeWidth={1.8}
          className="shrink-0 text-[oklch(0.54_0.20_25)] dark:text-[oklch(0.72_0.18_25)]"
          aria-label="Error al enviar"
        />
      );
    case "sent":
    default:
      return (
        <HugeiconsIcon
          icon={HugeCheckIcon}
          size={13}
          strokeWidth={1.8}
          className="shrink-0 text-muted-foreground"
          aria-label="Enviado"
        />
      );
  }
}

const CARD_H = 38;
const PEEK = 12;
const GAP = 8;
const MAX_PEEK = 2;

const QUICK_EMOJIS = [
  "👍", "👌", "👏", "🙏", "✅", "⚠️", "❗", "🔥",
  "😀", "😄", "😅", "😂", "😊", "😉", "🤔", "👀",
  "📦", "💊", "📋", "🚚", "📅", "⏰", "🔍", "💬",
];

const INITIAL_MESSAGES_BY_THREAD: Record<string, ThreadMessage[]> = {
  "thread-1": [
    {
      id: "m-1",
      from: "assistant",
      text: "Hola, revisé el recuento de Elea y quedaron 3 unidades de diferencia en Ibuprofeno 400mg.",
      files: [],
      time: "10:40",
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
    {
      id: "m-2",
      from: "user",
      text: "Dale, ahí lo verifico con el depósito y te confirmo.",
      files: [],
      time: "10:42",
      createdAt: new Date().toISOString(),
      status: "read",
    },
  ],
  "thread-2": [
    {
      id: "m-3",
      from: "assistant",
      text: "Tenemos 4 lotes próximos a vencer en Abril en Sucursal Belgrano.",
      files: [],
      time: "09:15",
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
  ],
};

export interface DirectoryContact {
  id: string;
  name: string;
  branch: string;
  avatarUrl?: string | null;
  extremoPublico?: number[];
  online?: boolean;
}

const DIRECTORY_CONTACTS: DirectoryContact[] = [
  { id: "c-1", name: "Mariana Gómez", branch: "Sucursal Central" },
  { id: "c-2", name: "Lucas Fernández", branch: "Sucursal Belgrano" },
  { id: "c-3", name: "Sofía Martínez", branch: "Sucursal Palermo" },
  { id: "c-4", name: "Martín López", branch: "Sucursal Caballito" },
  { id: "c-5", name: "Valentina Ruiz", branch: "Casa Central" },
  { id: "c-6", name: "Julián Pereyra", branch: "Sucursal Recoleta" },
  { id: "c-7", name: "Camila Torres", branch: "Sucursal Norte" },
  { id: "c-8", name: "Agustín Herrera", branch: "Sucursal Flores" },
  { id: "c-9", name: "Lucía Méndez", branch: "Sucursal Devoto" },
  { id: "c-10", name: "Tomás Benítez", branch: "Depósito Central" },
];

interface QuotedMessageItem extends QueuedMessage {
  messageId?: string;
  author?: string;
}

export interface MessagesDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MessagesDialog({
  open,
  defaultOpen,
  onOpenChange,
}: MessagesDialogProps) {
  const { user } = useUser();
  const icons = useIcons();
  const shape = useShape();
  const SearchIcon = icons.search;
  const UserIcon = icons.user;
  const PlusIcon = icons.plus;
  const SlidersIcon = icons["sliders-horizontal"];
  const MoreIcon = icons["more-vertical"];
  const PencilIcon = icons.pencil;
  const CopyIcon = icons.copy;
  const CheckIcon = icons.check;
  const CornerDownRightIcon = icons["corner-down-right"];
  const XIcon = icons.x;

  const isRealtimeActive = Boolean(user?.id);

  const [threads, setThreads] = useState<MessageThreadItem[]>(
    isRealtimeActive ? [] : INITIAL_THREADS
  );
  const [contacts, setContacts] = useState<DirectoryContact[]>(
    isRealtimeActive ? [] : DIRECTORY_CONTACTS
  );
  const [activeId, setActiveId] = useState<string>(
    isRealtimeActive ? "" : INITIAL_THREADS[0].id
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const [value, setValue] = useState("");
  const [pendingContext, setPendingContext] = useState<{
    id: number;
    text: string;
    targetBranch: string | null;
  } | null>(null);
  const pendingDraftTextRef = useRef<string | null>(null);

  useEffect(() => {
    const handleChatContext = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; targetBranch?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      pendingDraftTextRef.current = text;
      setValue((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      setPendingContext({
        id: Date.now(),
        text,
        targetBranch: detail?.targetBranch?.trim() || null,
      });
    };
    window.addEventListener("miplus:open-chat-context", handleChatContext);
    return () => window.removeEventListener("miplus:open-chat-context", handleChatContext);
  }, []);
  const [files, setFiles] = useState<File[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [quotedQueue, setQuotedQueue] = useState<QuotedMessageItem[]>([]);
  const [hovered, setHovered] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiActionsRef = useRef<{ unmount: () => void; close: () => void } | null>(null);
  const emojiGridRef = useRef<HTMLDivElement>(null);
  const emojiHover = useFluidHover(emojiGridRef);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const mentionHover = useFluidHover(mentionListRef);

  useEffect(() => {
    if (emojiOpen) return;
    const id = setTimeout(
      () => emojiActionsRef.current?.unmount(),
      exitFallbackMs(spring.fast)
    );
    return () => clearTimeout(id);
  }, [emojiOpen]);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupMemberQuery, setGroupMemberQuery] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const [typingByThread, setTypingByThread] = useState<Record<string, boolean>>(
    isRealtimeActive ? {} : { "thread-2": true }
  );
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ThreadMessage[]>>(
    isRealtimeActive ? {} : INITIAL_MESSAGES_BY_THREAD
  );

  const threadsRef = useRef<MessageThreadItem[]>(threads);
  threadsRef.current = threads;
  const activeIdRef = useRef<string>(activeId);
  activeIdRef.current = activeId;
  const openRef = useRef<boolean>(Boolean(open ?? defaultOpen));
  openRef.current = Boolean(open ?? defaultOpen);

  const realtimeRef = useRef<ControladorSuscripcionMensajeria | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);

  // Sincroniza el conteo global de no leídos cada vez que cambian los badges
  useEffect(() => {
    if (!user?.id) return;
    const total = threads.reduce((acc, t) => acc + (t.badge || 0), 0);
    notificarCambioNoLeidos(total);
  }, [threads, user?.id]);

  const cargarDatosMensajeria = useCallback(async () => {
    if (!user?.id) return;
    try {
      await asegurarIdentidad(user.id, user.username || user.id);
      const res = await listarContactosYConversaciones(user.id, user.username || user.id);

      setContacts(
        res.contactos.map((c) => ({
          id: c.id,
          name: c.name,
          branch: c.branch,
          avatarUrl: c.avatarUrl,
          extremoPublico: c.extremoPublico,
          online: c.tieneExtremoRegistrado,
        }))
      );

      const mappedThreads: MessageThreadItem[] = res.hilos.map((h) => ({
        id: h.id,
        tipo: h.tipo,
        contactId: h.contactId,
        label: h.label,
        sector: h.sector,
        badge: h.badge,
        unread: h.unread,
        avatarUrl: h.avatarUrl,
        online: h.online,
        fijado: h.fijado,
        extremoParPublico: h.extremoParPublico,
        miembros: h.miembros,
        esAdminGrupo: h.esAdminGrupo,
        vistoPor: h.vistoPor,
      }));

      const borradorActivo =
        activeIdRef.current &&
        !mappedThreads.some((t) => t.id === activeIdRef.current)
          ? threadsRef.current.find((t) => t.id === activeIdRef.current)
          : undefined;

      const threadsFinales = borradorActivo
        ? [borradorActivo, ...mappedThreads]
        : mappedThreads;

      setThreads(threadsFinales);

      setMessagesByThread((prev) => {
        const next: Record<string, ThreadMessage[]> = {};
        if (borradorActivo) {
          next[borradorActivo.id] = prev[borradorActivo.id] ?? [];
        }
        for (const [convId, list] of Object.entries(res.mensajesPorHilo)) {
          const prevById = new Map(
            (prev[convId] ?? []).map((m) => [m.id, m] as const)
          );
          next[convId] = list.map((m) => {
            const previo = prevById.get(m.id);
            return {
              id: m.id,
              remitenteId: m.remitenteId,
              remitenteNombre: m.remitenteNombre,
              remitenteSector: m.remitenteSector,
              from: m.from,
              text: m.text,
              files: previo?.files ?? [],
              attachments: m.attachments,
              time: m.time,
              createdAt: m.createdAt,
              replyTo: m.replyTo,
              replyToPayload: m.replyToPayload,
              edited: m.edited,
              status: m.status,
            };
          });
        }
        return next;
      });

      setActiveId((prevActive) => {
        if (prevActive && threadsFinales.some((t) => t.id === prevActive)) {
          return prevActive;
        }
        return threadsFinales[0]?.id ?? "";
      });

      const targetActiveId =
        activeIdRef.current && mappedThreads.some((t) => t.id === activeIdRef.current)
          ? activeIdRef.current
          : mappedThreads[0]?.id ?? "";

      // Marcar como leidos (3) en el hilo activo si el dialogo esta abierto,
      // o como recibidos (2) en los demas hilos con mensajes en estado 1.
      for (const h of res.hilos) {
        const msgs = res.mensajesPorHilo[h.id] ?? [];
        const esActivoAbierto = openRef.current && h.id === targetActiveId;
        if (h.tipo === "grupo") {
          if (esActivoAbierto && h.badge > 0) {
            void marcarLeidoGrupo(h.id, user.id).then((ok) => {
              if (ok) void realtimeRef.current?.enviarSync(h.id);
            });
          }
          continue;
        }
        if (esActivoAbierto && msgs.some((m) => m.from === "assistant" && m.estadoNumerico < 3)) {
          void marcarEstadoMensajes(h.id, user.id, 3).then((ok) => {
            if (ok) void realtimeRef.current?.enviarSync(h.id);
          });
        } else if (msgs.some((m) => m.from === "assistant" && m.estadoNumerico < 2)) {
          void marcarEstadoMensajes(h.id, user.id, 2).then((ok) => {
            if (ok) void realtimeRef.current?.enviarSync(h.id);
          });
        }
      }
    } catch (err) {
      console.warn("[MessagesDialog] Error cargando mensajeria:", err);
    }
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (!user?.id) return;
    void cargarDatosMensajeria();
  }, [open, user?.id, cargarDatosMensajeria]);

  // Respaldo de sincronizacion cada 5s mientras el dialogo esta abierto
  useEffect(() => {
    if (!open || !user?.id) return;
    const id = setInterval(() => {
      void cargarDatosMensajeria();
    }, 5000);
    return () => clearInterval(id);
  }, [open, user?.id, cargarDatosMensajeria]);

  // Al abrir el diálogo o cambiar de conversación activa, marcar como leídos (estado = 3)
  useEffect(() => {
    if (!open || !user?.id || !activeId) return;
    const thread = threads.find((t) => t.id === activeId);
    if (!thread) return;

    if (thread.badge > 0 || thread.unread) {
      setThreads((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, badge: 0, unread: false } : t))
      );
      if (thread.tipo === "grupo") {
        void marcarLeidoGrupo(activeId, user.id).then((ok) => {
          if (ok) void realtimeRef.current?.enviarSync(activeId);
        });
      } else {
        void marcarEstadoMensajes(activeId, user.id, 3);
      }
    }
  }, [open, activeId, threads, user?.id]);

  // Suscripción Realtime a mensajes, conversaciones y evento typing
  useEffect(() => {
    if (!user?.id) return;

    const sub = suscribirMensajeriaRealtime({
      userId: user.id,
      onMensajeInsertado: async (fila) => {
        const hiloConocido = threadsRef.current.find((t) => t.id === fila.conversacion_id);
        if (!hiloConocido) {
          await cargarDatosMensajeria();
          return;
        }

        const descifrado = await descifrarFilaMensaje({
          fila,
          userId: user.id,
          username: user.username || user.id,
          extremoParPublico: hiloConocido.extremoParPublico ?? [],
        });

        if (!descifrado) {
          await cargarDatosMensajeria();
          return;
        }

        setMessagesByThread((prev) => {
          const lista = prev[fila.conversacion_id] ?? [];
          const idx = lista.findIndex((m) => m.id === fila.id);
          const previo = idx >= 0 ? lista[idx] : undefined;
          const item: ThreadMessage = {
            id: descifrado.id,
            from: descifrado.from,
            text: descifrado.text,
            files: previo ? previo.files : [],
            attachments: descifrado.attachments,
            time: descifrado.time,
            createdAt: descifrado.createdAt,
            replyTo: descifrado.replyTo,
            replyToPayload: descifrado.replyToPayload,
            edited: descifrado.edited,
            status: descifrado.status,
          };
          const nuevaLista =
            idx >= 0
              ? lista.map((m, i) => (i === idx ? item : m))
              : [...lista, item];
          return {
            ...prev,
            [fila.conversacion_id]: nuevaLista,
          };
        });

        if (fila.remitente_id !== user.id) {
          setTypingByThread((prev) => ({ ...prev, [fila.conversacion_id]: false }));
          const esActivoYAbierto =
            openRef.current && activeIdRef.current === fila.conversacion_id;
          if (esActivoYAbierto) {
            void marcarEstadoMensajes(fila.conversacion_id, user.id, 3);
            setThreads((prev) =>
              prev.map((t) =>
                t.id === fila.conversacion_id ? { ...t, badge: 0, unread: false } : t
              )
            );
          } else {
            void marcarEstadoMensajes(fila.conversacion_id, user.id, 2);
            setThreads((prev) =>
              prev.map((t) =>
                t.id === fila.conversacion_id
                  ? { ...t, badge: (t.badge || 0) + 1, unread: true }
                  : t
              )
            );
          }
        }
      },
      onMensajeActualizado: async (fila) => {
        const hiloConocido = threadsRef.current.find((t) => t.id === fila.conversacion_id);
        if (!hiloConocido) return;

        const descifrado = await descifrarFilaMensaje({
          fila,
          userId: user.id,
          username: user.username || user.id,
          extremoParPublico: hiloConocido.extremoParPublico ?? [],
        });

        if (!descifrado) return;

        setMessagesByThread((prev) => {
          const lista = prev[fila.conversacion_id] ?? [];
          if (!lista.some((m) => m.id === fila.id)) return prev;
          return {
            ...prev,
            [fila.conversacion_id]: lista.map((m) => {
              if (m.id !== fila.id) return m;
              return {
                ...m,
                text: descifrado.text,
                replyTo: descifrado.replyTo,
                replyToPayload: descifrado.replyToPayload,
                attachments: descifrado.attachments ?? m.attachments,
                edited: descifrado.edited,
                status: descifrado.status,
              };
            }),
          };
        });
      },
      onMensajeEliminado: (id) => {
        setMessagesByThread((prev) => {
          const next: Record<string, ThreadMessage[]> = {};
          for (const [convId, list] of Object.entries(prev)) {
            next[convId] = list.filter((m) => m.id !== id);
          }
          return next;
        });
      },
      onConversacionCambiada: (tipo, fila) => {
        if (tipo === "DELETE") {
          setThreads((prev) => {
            const next = prev.filter((t) => t.id !== fila.id);
            if (activeIdRef.current === fila.id) {
              setActiveId(next[0]?.id ?? "");
            }
            return next;
          });
          setMessagesByThread((prev) => {
            const copia = { ...prev };
            delete copia[fila.id];
            return copia;
          });
        } else if (tipo === "INSERT") {
          void cargarDatosMensajeria();
        }
      },
      onTyping: (evento) => {
        setTypingByThread((prev) => ({
          ...prev,
          [evento.conversacionId]: evento.typing,
        }));
        const timers = typingTimeoutsRef.current;
        if (timers[evento.conversacionId]) {
          clearTimeout(timers[evento.conversacionId]);
        }
        if (evento.typing) {
          timers[evento.conversacionId] = setTimeout(() => {
            setTypingByThread((prev) => ({
              ...prev,
              [evento.conversacionId]: false,
            }));
          }, 3500);
        }
      },
      onSync: (evento) => {
        setTypingByThread((prev) => ({
          ...prev,
          [evento.conversacionId]: false,
        }));
        void cargarDatosMensajeria();
      },
    });

    realtimeRef.current = sub;
    const timersRef = typingTimeoutsRef.current;
    return () => {
      sub.cerrar();
      realtimeRef.current = null;
      for (const t of Object.values(timersRef)) {
        clearTimeout(t);
      }
    };
  }, [user?.id, user?.username, cargarDatosMensajeria]);

  // Float the composer over the transcript: measure it to reserve scroll
  // padding, and keep the transcript pinned to the latest message.
  const [inputEl, setInputEl] = useState<HTMLDivElement | null>(null);
  const [inputH, setInputH] = useState(56);
  useEffect(() => {
    if (!inputEl) return;
    const ro = new ResizeObserver(() => setInputH(inputEl.offsetHeight));
    ro.observe(inputEl);
    setInputH(inputEl.offsetHeight);
    return () => ro.disconnect();
  }, [inputEl]);

  const currentMessages = useMemo(
    () => (activeId ? messagesByThread[activeId] ?? [] : []),
    [messagesByThread, activeId]
  );
  const visibleMessages = useMemo(() => {
    const q = chatSearchOpen ? chatSearchQuery.trim().toLowerCase() : "";
    if (!q) return currentMessages;
    return currentMessages.filter(
      (m) =>
        m.text.toLowerCase().includes(q) ||
        m.attachments?.some((a) => a.nombre.toLowerCase().includes(q)) ||
        m.files.some((f) => f.name.toLowerCase().includes(q))
    );
  }, [currentMessages, chatSearchOpen, chatSearchQuery]);
  const isCurrentTyping = Boolean(activeId && typingByThread[activeId]);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const lastMsgId = currentMessages[currentMessages.length - 1]?.id ?? "";
  useEffect(() => {
    if (!scrollEl || open === false) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    const raf = requestAnimationFrame(() => {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollEl, open, activeId, currentMessages.length, lastMsgId, isCurrentTyping, inputH, quotedQueue.length]);

  // Derived stack heights: the collapsed pile and the fanned-out column.
  const collapsedStackH =
    CARD_H + Math.min(Math.max(quotedQueue.length - 1, 0), MAX_PEEK) * PEEK;
  const expandedStackH =
    quotedQueue.length * CARD_H + Math.max(quotedQueue.length - 1, 0) * GAP;
  const hiddenCount = Math.max(0, quotedQueue.length - (MAX_PEEK + 1));

  // Enqueue recoil: once the collapsed pile hits its peek cap a new quote
  // lands out of sight — recoil the whole stack on growth so it's still felt.
  const stackBump = useAnimationControls();
  const prevQuoteCount = useRef(quotedQueue.length);
  useEffect(() => {
    const prev = prevQuoteCount.current;
    prevQuoteCount.current = quotedQueue.length;
    if (quotedQueue.length > prev && prev > 0 && !hovered) {
      stackBump.set({ y: -7 });
      stackBump.start({
        y: 0,
        transition: { type: "spring", duration: 0.42, bounce: 0.5 },
      });
    }
  }, [quotedQueue.length, hovered, stackBump]);

  const quoteMessage = (
    text: string,
    attachedFiles: File[] = [],
    messageId?: string,
    author?: string
  ) => {
    const quoteText = text.trim() || attachedFiles.map((f) => f.name).join(", ");
    if (!quoteText) return;
    setQuotedQueue([
      {
        id: `quote-${Date.now()}`,
        messageId,
        author,
        text: quoteText,
        files: attachedFiles,
      },
    ]);
  };

  const removeQueued = (item: QueuedMessage) =>
    setQuotedQueue((q) => q.filter((x) => x.id !== item.id));

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((t) => {
      if (onlyUnread && !(t.badge > 0 || t.unread) && t.id !== activeId) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.sector.toLowerCase().includes(q)
      );
    });
  }, [threads, searchQuery, onlyUnread, activeId]);

  const currentThread =
    threads.find((t) => t.id === activeId) ?? filteredThreads[0] ?? null;

  const mentionMatch = useMemo(() => {
    if (currentThread?.tipo !== "grupo") return null;
    const m = /(?:^|\s)@([^\s@]*)$/.exec(value);
    if (!m) return null;
    const q = m[1].toLowerCase();
    const opciones: Array<{ id: string; label: string; sub: string }> = [];
    if ("todos".startsWith(q)) {
      opciones.push({ id: "todos", label: "todos", sub: "Todo el grupo" });
    }
    for (const mb of currentThread.miembros ?? []) {
      if (mb.operadorId === user?.id) continue;
      if (
        !q ||
        mb.nombre.toLowerCase().includes(q) ||
        mb.sector.toLowerCase().includes(q)
      ) {
        opciones.push({ id: mb.operadorId, label: mb.nombre, sub: mb.sector });
      }
    }
    if (opciones.length === 0) return null;
    return { query: m[1], opciones: opciones.slice(0, 6) };
  }, [currentThread, value, user?.id]);

  const handlePickMention = (label: string) => {
    setValue((prev) => prev.replace(/@([^\s@]*)$/, `@${label} `));
  };

  const handleSelectThread = (id: string, preserveDraft = false) => {
    setActiveId(id);
    setEditingMessageId(null);
    setQuotedQueue([]);
    if (!preserveDraft) {
      setValue("");
    }
    setChatSearchOpen(false);
    setChatSearchQuery("");
    const target = threads.find((t) => t.id === id);
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, unread: false, badge: 0 } : t))
    );
    if (user?.id) {
      if (target?.tipo === "grupo") {
        void marcarLeidoGrupo(id, user.id).then((ok) => {
          if (ok) void realtimeRef.current?.enviarSync(id);
        });
      } else {
        void marcarEstadoMensajes(id, user.id, 3).then(() =>
          realtimeRef.current?.enviarSync(id)
        );
      }
    }
  };

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.branch.toLowerCase().includes(q)
    );
  }, [contacts, contactQuery]);

  const handleStartChatWith = async (contact: DirectoryContact, preserveDraft = false) => {
    setNewChatOpen(false);
    setContactQuery("");

    const existing = threads.find(
      (t) =>
        (t.contactId && t.contactId === contact.id) ||
        t.label.toLowerCase() === contact.name.toLowerCase()
    );
    if (existing) {
      handleSelectThread(existing.id, preserveDraft);
      return;
    }

    if (user?.id) {
      try {
        const conv = await crearOAbrirConversacion(user.id, contact.id);
        const newThread: MessageThreadItem = {
          id: conv.id,
          contactId: contact.id,
          label: contact.name,
          sector: contact.branch,
          badge: 0,
          unread: false,
          avatarUrl: contact.avatarUrl ?? undefined,
          online: contact.online,
          extremoParPublico: contact.extremoPublico ?? [],
        };
        setThreads((prev) => {
          if (prev.some((t) => t.id === conv.id)) return prev;
          return [newThread, ...prev];
        });
        setMessagesByThread((prev) => ({
          ...prev,
          [conv.id]: prev[conv.id] ?? [],
        }));
        handleSelectThread(conv.id, preserveDraft);
      } catch (err) {
        console.warn("[MessagesDialog] No se pudo abrir conversacion:", err);
      }
      return;
    }

    const fallbackThread: MessageThreadItem = {
      id: `thread-${Date.now()}`,
      contactId: contact.id,
      label: contact.name,
      sector: contact.branch,
      badge: 0,
      unread: false,
    };
    setThreads((prev) => [fallbackThread, ...prev]);
    handleSelectThread(fallbackThread.id, preserveDraft);
  };

  // Si se abrió el chat desde otra pantalla apuntando a una sucursal, abre/selecciona esa conversación automáticamente sin borrar el borrador
  useEffect(() => {
    if (!open || !pendingContext) return;
    const { text, targetBranch } = pendingContext;
    const focusComposer = () => {
      requestAnimationFrame(() => {
        const ta = inputEl?.querySelector("textarea");
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      });
    };

    if (!targetBranch) {
      setValue((prev) => (prev.trim() ? prev : text));
      setPendingContext(null);
      focusComposer();
      return;
    }

    // Esperar a que carguen hilos/contactos en modo realtime antes de resolver
    if (isRealtimeActive && threads.length === 0 && contacts.length === 0) return;

    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/^(farmaplus|farmacia|sucursal|suc\.?|fp)\s+/i, "")
        .trim();
    const compact = (s: string) => norm(s).replace(/[^a-z0-9]/g, "");
    const targetNorm = norm(targetBranch);
    const targetCompact = compact(targetBranch);

    const matches = (candidate: string) => {
      if (!candidate) return false;
      const cn = norm(candidate);
      const cc = compact(candidate);
      return cn === targetNorm || cn.includes(targetNorm) || (targetCompact.length >= 4 && cc.includes(targetCompact));
    };

    const directThreads = threads.filter((t) => t.tipo !== "grupo");
    const matchedThread =
      directThreads.find((t) => norm(t.label) === targetNorm || norm(t.sector) === targetNorm) ??
      directThreads.find((t) => matches(t.label) || matches(t.sector));
    if (matchedThread) {
      setPendingContext(null);
      handleSelectThread(matchedThread.id, true);
      setValue((prev) => (prev.trim() ? prev : text));
      focusComposer();
      return;
    }

    const matchedContact =
      contacts.find((c) => norm(c.name) === targetNorm || norm(c.branch) === targetNorm) ??
      contacts.find((c) => matches(c.name) || matches(c.branch));
    if (matchedContact) {
      setPendingContext(null);
      void handleStartChatWith(matchedContact, true).then(() => {
        setValue((prev) => (prev.trim() ? prev : text));
        focusComposer();
      });
      return;
    }

    // Si la sucursal no está en el directorio todavía, deja el mensaje cargado en el chat activo
    setPendingContext(null);
    setValue((prev) => (prev.trim() ? prev : text));
    focusComposer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingContext, threads, contacts, isRealtimeActive]);

  const handleDeleteThread = async (thread: MessageThreadItem) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== thread.id);
      if (activeId === thread.id) {
        setActiveId(next[0]?.id ?? "");
      }
      return next;
    });
    setMessagesByThread((prev) => {
      const copia = { ...prev };
      delete copia[thread.id];
      return copia;
    });
    if (user?.id) {
      try {
        if (thread.tipo === "grupo") {
          await vaciarGrupoParaOperador(thread.id, user.id);
        } else {
          await eliminarConversacion(thread.id, user.id);
        }
      } catch (err) {
        console.warn("[MessagesDialog] Error vaciando conversacion:", err);
      }
    }
  };

  const handleLeaveGroup = async (thread: MessageThreadItem) => {
    if (!user?.id || thread.tipo !== "grupo") return;
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== thread.id);
      if (activeId === thread.id) {
        setActiveId(next[0]?.id ?? "");
      }
      return next;
    });
    setMessagesByThread((prev) => {
      const copia = { ...prev };
      delete copia[thread.id];
      return copia;
    });
    try {
      await salirDeGrupo(thread.id, user.id);
      void realtimeRef.current?.enviarSync(thread.id);
    } catch (err) {
      console.warn("[MessagesDialog] Error saliendo del grupo:", err);
    }
  };

  const handleCreateGroup = async () => {
    if (!user?.id || creatingGroup) return;
    if (groupName.trim().length < 2) return;
    setCreatingGroup(true);
    try {
      const grupo = await crearGrupoMensajeria({
        userId: user.id,
        nombre: groupName,
        miembroIds: groupMemberIds,
      });
      setNewGroupOpen(false);
      setGroupName("");
      setGroupMemberIds([]);
      setGroupMemberQuery("");
      await cargarDatosMensajeria();
      setActiveId(grupo.id);
      void realtimeRef.current?.enviarSync(grupo.id);
    } catch (err) {
      console.warn("[MessagesDialog] Error creando grupo:", err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleTogglePin = async (thread: MessageThreadItem) => {
    const nuevoFijado = !Boolean(thread.fijado);
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, fijado: nuevoFijado } : t))
    );
    if (!user?.id) return;
    try {
      await alternarFijadoHilo({
        id: thread.id,
        tipo: thread.tipo === "grupo" ? "grupo" : "directo",
        userId: user.id,
        fijado: nuevoFijado,
      });
    } catch (err) {
      console.warn("[MessagesDialog] Error fijando chat:", err);
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, fijado: !nuevoFijado } : t))
      );
    }
  };

  const groupThreads = useMemo(
    () =>
      filteredThreads
        .filter((t) => t.tipo === "grupo")
        .sort((a, b) => Number(Boolean(b.fijado)) - Number(Boolean(a.fijado))),
    [filteredThreads]
  );
  const directThreads = useMemo(
    () =>
      filteredThreads
        .filter((t) => t.tipo !== "grupo")
        .sort((a, b) => Number(Boolean(b.fijado)) - Number(Boolean(a.fijado))),
    [filteredThreads]
  );

  const handleComposerValueChange = (nextVal: string) => {
    setValue(nextVal);
    if (!user?.id || !currentThread) return;

    const now = Date.now();
    const isTypingNow = nextVal.trim().length > 0;

    if (isTypingNow && now - lastTypingSentAtRef.current > 1400) {
      lastTypingSentAtRef.current = now;
      void realtimeRef.current?.enviarTyping(currentThread.id, true);
    }

    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
    }

    if (isTypingNow) {
      const targetConvId = currentThread.id;
      stopTypingTimerRef.current = setTimeout(() => {
        void realtimeRef.current?.enviarTyping(targetConvId, false);
      }, 2200);
    } else {
      void realtimeRef.current?.enviarTyping(currentThread.id, false);
    }
  };

  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        showCloseButton={false}
        className="flex h-[min(640px,calc(100dvh-4rem))] overflow-hidden p-0"
      >
        <TooltipProvider>
          <SidebarProvider
            persist={false}
            shortcut={null}
            width="16rem"
            className="h-full min-h-0"
          >
            <Sidebar
              collapsible="none"
              className="hidden h-full sm:flex bg-[rgb(var(--overlay)/0.03)]"
            >
              <SidebarHeader className="gap-2.5 border-b border-border/60 px-3 pt-4 pb-2.5">
                <div className="px-1">
                  <DialogTitle style={{ fontVariationSettings: fontWeights.normal }}>
                    Mensajes
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Conversaciones y mensajes del espacio de trabajo.
                  </DialogDescription>
                </div>

                <div className="relative">
                  <SearchIcon
                    size={16}
                    strokeWidth={1.5}
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <SidebarInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar..."
                    aria-label="Buscar conversaciones"
                    className="pl-8"
                  />
                </div>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup collapsible>
                  <SidebarGroupLabel>Grupos</SidebarGroupLabel>
                  <SidebarGroupActions>
                    <Tooltip content="Nuevo grupo" side="top">
                      <SidebarGroupAction
                        aria-label="Nuevo grupo"
                        onClick={() => setNewGroupOpen(true)}
                      >
                        <PlusIcon />
                      </SidebarGroupAction>
                    </Tooltip>
                  </SidebarGroupActions>

                  <SidebarMenu focusRing={false}>
                    {groupThreads.map((thread) => {
                      const hasUnread = thread.badge > 0 || Boolean(thread.unread);
                      const status: "active" | "unread" | "idle" =
                        thread.id === activeId
                          ? "active"
                          : hasUnread
                            ? "unread"
                            : "idle";

                      return (
                        <SidebarMenuItem key={thread.id}>
                          <SidebarMenuButton
                            status={status}
                            onClick={() => handleSelectThread(thread.id)}
                          >
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              <span className="truncate">{thread.label}</span>
                              {thread.fijado && (
                                <HugeiconsIcon
                                  icon={Pin02Icon}
                                  size={12}
                                  strokeWidth={1.7}
                                  className="shrink-0 text-muted-foreground"
                                />
                              )}
                            </span>
                          </SidebarMenuButton>
                          {thread.badge > 0 && (
                            <SidebarMenuBadge>{thread.badge}</SidebarMenuBadge>
                          )}
                          <SidebarMenuActions showOnHover>
                            <DropdownMenu>
                              <DropdownTrigger
                                render={
                                  <SidebarMenuAction aria-label="Opciones de grupo">
                                    <MoreIcon />
                                  </SidebarMenuAction>
                                }
                              />
                              <DropdownContent
                                className="min-w-[200px] w-[200px]"
                                align="start"
                                sideOffset={4}
                              >
                                <MenuItem
                                  index={0}
                                  icon={PinIconCompat}
                                  label={thread.fijado ? "Desfijar chat" : "Fijar chat"}
                                  onSelect={() => {
                                    void handleTogglePin(thread);
                                  }}
                                />
                                <MenuItem
                                  index={1}
                                  icon={UserIcon}
                                  label="Miembros"
                                  onSelect={() => {
                                    handleSelectThread(thread.id);
                                    setMembersModalOpen(true);
                                  }}
                                />
                                <MenuItem
                                  index={2}
                                  icon={XIcon}
                                  label="Vaciar chat"
                                  onSelect={() => {
                                    void handleDeleteThread(thread);
                                  }}
                                />
                                <MenuItem
                                  index={3}
                                  icon={XIcon}
                                  label="Salir del grupo"
                                  onSelect={() => {
                                    void handleLeaveGroup(thread);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                />
                              </DropdownContent>
                            </DropdownMenu>
                          </SidebarMenuActions>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>

                {/* The section label carries actions of its own */}
                <SidebarGroup collapsible>
                  <SidebarGroupLabel>Conversaciones</SidebarGroupLabel>
                  <SidebarGroupActions>
                    <DropdownMenu
                      open={newChatOpen}
                      onOpenChange={(next) => {
                        setNewChatOpen(next);
                        if (!next) setContactQuery("");
                      }}
                    >
                      <DropdownTrigger
                        render={
                          <SidebarGroupAction aria-label="Nueva conversación">
                            <PlusIcon />
                          </SidebarGroupAction>
                        }
                      />
                      <DropdownContent
                        className="min-w-[240px] w-[240px]"
                        align="start"
                        sideOffset={4}
                      >
                        <DropdownSearch
                          value={contactQuery}
                          onValueChange={setContactQuery}
                          placeholder="Buscar contacto..."
                        />
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact, idx) => (
                            <MenuItem
                              key={contact.id}
                              index={idx}
                              icon={UserIcon}
                              label={contact.name}
                              onSelect={() => {
                                void handleStartChatWith(contact);
                              }}
                            />
                          ))
                        ) : (
                          <DropdownEmpty>Sin contactos</DropdownEmpty>
                        )}
                      </DropdownContent>
                    </DropdownMenu>
                    <Tooltip
                      content={onlyUnread ? "Mostrar todas" : "Filtrar no leídas"}
                      side="top"
                    >
                      <SidebarGroupAction
                        aria-label="Filtrar"
                        aria-pressed={onlyUnread}
                        onClick={() => setOnlyUnread((v) => !v)}
                        className={cn(onlyUnread && "bg-hover text-foreground")}
                      >
                        <SlidersIcon />
                      </SidebarGroupAction>
                    </Tooltip>
                  </SidebarGroupActions>

                  <SidebarMenu focusRing={false}>
                    {/* Status leads instead of an icon: active/unread fill the dot, idle
                        rings it, and "unread" is announced to screen readers. The badge
                        keeps the rightmost slot; the cluster reveals to its left and owns
                        the row's gutter */}
                    {directThreads.map((thread) => {
                      const hasUnread = thread.badge > 0 || Boolean(thread.unread);
                      const status: "active" | "unread" | "idle" =
                        thread.id === activeId
                          ? "active"
                          : hasUnread
                            ? "unread"
                            : "idle";

                      return (
                        <SidebarMenuItem key={thread.id}>
                          <SidebarMenuButton
                            status={status}
                            onClick={() => handleSelectThread(thread.id)}
                          >
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              <span className="truncate">{thread.label}</span>
                              {thread.fijado && (
                                <HugeiconsIcon
                                  icon={Pin02Icon}
                                  size={12}
                                  strokeWidth={1.7}
                                  className="shrink-0 text-muted-foreground"
                                />
                              )}
                            </span>
                          </SidebarMenuButton>
                          {thread.badge > 0 && (
                            <SidebarMenuBadge>{thread.badge}</SidebarMenuBadge>
                          )}
                          <SidebarMenuActions showOnHover>
                            <DropdownMenu>
                              <DropdownTrigger
                                render={
                                  <SidebarMenuAction aria-label="Más opciones">
                                    <MoreIcon />
                                  </SidebarMenuAction>
                                }
                              />
                              <DropdownContent
                                className="min-w-[240px] w-[240px]"
                                align="start"
                                sideOffset={4}
                              >
                                <MenuItem
                                  index={0}
                                  icon={PinIconCompat}
                                  label={thread.fijado ? "Desfijar chat" : "Fijar chat"}
                                  onSelect={() => {
                                    void handleTogglePin(thread);
                                  }}
                                />
                                <MenuItem
                                  index={1}
                                  icon={XIcon}
                                  label="Eliminar"
                                  onSelect={() => {
                                    void handleDeleteThread(thread);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                />
                              </DropdownContent>
                            </DropdownMenu>
                          </SidebarMenuActions>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Cabecera alineada por ejes compartidos (better-layout): identidad a la izquierda, acciones + cierre a la derecha. */}
              <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="sm:hidden">
                    <h2
                      className="text-[16px] leading-tight text-foreground"
                      style={{ fontVariationSettings: fontWeights.normal }}
                    >
                      {currentThread ? currentThread.label : "Mensajes"}
                    </h2>
                  </div>
                  {currentThread && (
                    <div className="hidden items-center gap-3 sm:flex">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/20 text-[11px] font-bold text-primary select-none">
                        {currentThread.avatarUrl ? (
                          <img
                            src={currentThread.avatarUrl}
                            alt={currentThread.label}
                            className="size-full object-cover"
                          />
                        ) : (
                          getContactInitials(currentThread.label)
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h3
                          className="truncate text-[16px] leading-tight text-foreground"
                          style={{ fontVariationSettings: fontWeights.normal }}
                        >
                          {currentThread.label}
                        </h3>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {currentThread.sector}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {currentThread && (
                    <>
                      <Tooltip
                        content={chatSearchOpen ? "Cerrar búsqueda" : "Buscar en el chat"}
                        side="bottom"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Buscar en el chat"
                          aria-pressed={chatSearchOpen}
                          onClick={() => {
                            setChatSearchOpen((prev) => {
                              if (prev) setChatSearchQuery("");
                              return !prev;
                            });
                          }}
                          className={cn(chatSearchOpen && "bg-hover text-foreground")}
                        >
                          <SearchIcon size={16} strokeWidth={1.6} />
                        </Button>
                      </Tooltip>

                      <DropdownMenu>
                        <DropdownTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Opciones del chat"
                            >
                              <MoreIcon size={16} strokeWidth={1.6} />
                            </Button>
                          }
                        />
                        <DropdownContent
                          className="min-w-[200px] w-[200px]"
                          align="end"
                          sideOffset={4}
                        >
                          <MenuItem
                            index={0}
                            icon={SearchIcon}
                            label="Buscar mensajes"
                            onSelect={() => setChatSearchOpen(true)}
                          />
                          <MenuItem
                            index={1}
                            icon={PinIconCompat}
                            label={currentThread.fijado ? "Desfijar chat" : "Fijar chat"}
                            onSelect={() => {
                              void handleTogglePin(currentThread);
                            }}
                          />
                          {currentThread.tipo === "grupo" ? (
                            <>
                              <MenuItem
                                index={2}
                                icon={UserIcon}
                                label="Miembros del grupo"
                                onSelect={() => setMembersModalOpen(true)}
                              />
                              <MenuItem
                                index={3}
                                icon={XIcon}
                                label="Vaciar chat"
                                onSelect={() => {
                                  void handleDeleteThread(currentThread);
                                }}
                              />
                              <MenuItem
                                index={4}
                                icon={XIcon}
                                label="Salir del grupo"
                                onSelect={() => {
                                  void handleLeaveGroup(currentThread);
                                }}
                                className="text-destructive focus:text-destructive"
                              />
                            </>
                          ) : (
                            <MenuItem
                              index={2}
                              icon={XIcon}
                              label="Vaciar chat"
                              onSelect={() => {
                                void handleDeleteThread(currentThread);
                              }}
                              className="text-destructive focus:text-destructive"
                            />
                          )}
                        </DropdownContent>
                      </DropdownMenu>
                    </>
                  )}

                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Cerrar"
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon size={16} strokeWidth={1.6} />
                      </Button>
                    }
                  />
                </div>
              </div>

              {chatSearchOpen && currentThread && (
                <div className="shrink-0 px-6 pb-3">
                  <div className="relative flex items-center">
                    <SearchIcon
                      size={15}
                      strokeWidth={1.5}
                      className="pointer-events-none absolute left-2.5 text-muted-foreground"
                    />
                    <SidebarInput
                      autoFocus
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setChatSearchOpen(false);
                          setChatSearchQuery("");
                        }
                      }}
                      placeholder="Buscar en esta conversación..."
                      aria-label="Buscar en esta conversación"
                      className="w-full pl-8 pr-8"
                    />
                    {chatSearchQuery && (
                      <button
                        type="button"
                        aria-label="Limpiar búsqueda"
                        onClick={() => setChatSearchQuery("")}
                        className="absolute right-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon size={14} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <SizeProvider size="compact">
                <div className="relative min-h-0 flex-1 w-full">
                <div
                  ref={setScrollEl}
                  className="scroll-fade absolute inset-x-0 top-0 overflow-y-auto scrollbar-hide px-6 pt-0"
                  style={
                    {
                      bottom: inputH + 24,
                      "--scroll-fade-size": "32px",
                    } as CSSProperties
                  }
                >
                  <div
                    className="flex min-h-full flex-col justify-start gap-1"
                    style={{
                      paddingBottom: quotedQueue.length > 0 ? collapsedStackH + 36 : 36,
                    }}
                  >
                    {/* initial={false}: messages already sent skip the entrance. */}
                    <AnimatePresence initial={false}>
                      {visibleMessages.length === 0 && chatSearchOpen && chatSearchQuery.trim() && (
                        <div className="py-10 text-center text-[13px] text-muted-foreground">
                          Sin mensajes que coincidan con “{chatSearchQuery.trim()}”.
                        </div>
                      )}
                      {visibleMessages.map((m, idx) => {
                        const dateKey = getDateKey(m.createdAt);
                        const prevDateKey = idx > 0 ? getDateKey(visibleMessages[idx - 1].createdAt) : "";
                        const dateLabel =
                          dateKey && dateKey !== prevDateKey
                            ? formatDateSeparator(m.createdAt)
                            : "";
                        const isCopied = copiedId === m.id;
                        const hasText = Boolean(m.text && m.text.trim().length > 0);
                        const hasBubbleContent = hasText || Boolean(m.replyTo) || Boolean(m.edited);
                        const messageActions = (
                          <>
                            {m.from === "assistant" && m.time && (
                              <span className="mr-1 tabular-nums">{m.time}</span>
                            )}
                            <button
                              type="button"
                              aria-label="Copiar"
                              onClick={async () => {
                                if (hasText) {
                                  await navigator.clipboard?.writeText(m.text);
                                } else if (m.files.length > 0) {
                                  const firstImg = m.files.find((f) => f.type.startsWith("image/"));
                                  if (firstImg && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
                                    try {
                                      await navigator.clipboard.write([
                                        new ClipboardItem({ [firstImg.type]: firstImg }),
                                      ]);
                                    } catch {
                                      await navigator.clipboard?.writeText(m.files.map((f) => f.name).join(", "));
                                    }
                                  } else {
                                    await navigator.clipboard?.writeText(m.files.map((f) => f.name).join(", "));
                                  }
                                } else {
                                  return;
                                }
                                setCopiedId(m.id);
                                setTimeout(() => {
                                  setCopiedId((prev) => (prev === m.id ? null : prev));
                                }, 1500);
                              }}
                              className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                            >
                              {isCopied ? (
                                <CheckIcon size={13} strokeWidth={1.5} />
                              ) : (
                                <CopyIcon size={13} strokeWidth={1.5} />
                              )}
                            </button>
                            {m.from === "user" ? (
                              <>
                                {hasText && (
                                  <button
                                    type="button"
                                    aria-label="Editar"
                                    onClick={() => {
                                      setEditingMessageId(m.id);
                                      setValue(m.text);
                                    }}
                                    className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                                  >
                                    <PencilIcon size={13} strokeWidth={1.5} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label="Eliminar mensaje"
                                  title="Eliminar mensaje"
                                  onClick={async () => {
                                    if (!currentThread) return;
                                    const convId = currentThread.id;
                                    const tipo = currentThread.tipo === "grupo" ? "grupo" : "directo";
                                    if (editingMessageId === m.id) {
                                      setEditingMessageId(null);
                                      setValue("");
                                    }
                                    setMessagesByThread((prev) => ({
                                      ...prev,
                                      [convId]: (prev[convId] ?? []).filter((x) => x.id !== m.id),
                                    }));
                                    if (user?.id) {
                                      try {
                                        await eliminarMensajePropio({
                                          mensajeId: m.id,
                                          tipo,
                                          userId: user.id,
                                          attachments: m.attachments,
                                        });
                                        void realtimeRef.current?.enviarSync(convId);
                                      } catch (err) {
                                        console.warn("[MessagesDialog] Error eliminando mensaje:", err);
                                        void cargarDatosMensajeria();
                                      }
                                    }
                                  }}
                                  className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-destructive"
                                >
                                  <HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={1.5} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                aria-label="Citar mensaje"
                                onClick={() =>
                                  quoteMessage(
                                    m.text,
                                    m.files,
                                    m.id,
                                    m.remitenteNombre || currentThread?.label
                                  )
                                }
                                className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                              >
                                <CornerDownRightIcon size={13} strokeWidth={1.5} />
                              </button>
                            )}
                          </>
                        );

                        const nextMsg = visibleMessages[idx + 1];
                        const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
                        const curMs = m.createdAt ? Date.parse(m.createdAt) : 0;
                        const nextMs = nextMsg?.createdAt ? Date.parse(nextMsg.createdAt) : 0;
                        const prevMs = prevMsg?.createdAt ? Date.parse(prevMsg.createdAt) : 0;
                        const mismoAutorSiguiente = Boolean(
                          nextMsg &&
                            nextMsg.from === m.from &&
                            (!m.remitenteId ||
                              !nextMsg.remitenteId ||
                              nextMsg.remitenteId === m.remitenteId)
                        );
                        const mismoAutorAnterior = Boolean(
                          prevMsg &&
                            prevMsg.from === m.from &&
                            (!m.remitenteId ||
                              !prevMsg.remitenteId ||
                              prevMsg.remitenteId === m.remitenteId)
                        );
                        const isGroupedNext = Boolean(
                          mismoAutorSiguiente &&
                            getDateKey(nextMsg.createdAt) === dateKey &&
                            (nextMs - curMs <= 5 * 60 * 1000 || nextMsg.time === m.time)
                        );
                        const isSamePrev = Boolean(
                          mismoAutorAnterior &&
                            getDateKey(prevMsg!.createdAt) === dateKey &&
                            (curMs - prevMs <= 5 * 60 * 1000 || prevMsg!.time === m.time)
                        );
                        const mostrarAutorGrupo =
                          currentThread?.tipo === "grupo" &&
                          m.from === "assistant" &&
                          Boolean(m.remitenteNombre) &&
                          (Boolean(dateLabel) || !isSamePrev);
                        const esUltimoMioGrupo =
                          currentThread?.tipo === "grupo" &&
                          m.from === "user" &&
                          Boolean(currentThread.vistoPor) &&
                          !visibleMessages.slice(idx + 1).some((x) => x.from === "user");

                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "flex w-full flex-col gap-1",
                              idx > 0 && !dateLabel && !isSamePrev && "mt-1.5"
                            )}
                          >
                            {dateLabel && (
                              <div
                                className={cn(
                                  "flex items-center gap-3 select-none",
                                  idx === 0 ? "mt-[7px] mb-1.5" : "my-1"
                                )}
                              >
                                <div className="h-px flex-1 bg-border/60" />
                                <span className="text-[11px] font-normal leading-none text-muted-foreground">
                                  {dateLabel}
                                </span>
                                <div className="h-px flex-1 bg-border/60" />
                              </div>
                            )}
                            {mostrarAutorGrupo && (
                              <div className="px-1 text-[11px] font-medium text-muted-foreground select-none">
                                {m.remitenteNombre}
                                {m.remitenteSector ? ` · ${m.remitenteSector}` : ""}
                              </div>
                            )}
                            {(m.files.length > 0 || (m.attachments && m.attachments.length > 0)) && (
                              <div
                                className={cn(
                                  "flex flex-wrap gap-1.5",
                                  m.from === "user" ? "justify-end" : "justify-start"
                                )}
                              >
                                {m.files.length > 0
                                  ? m.files.map((file, fi) => (
                                      <button
                                        key={`${file.name}-${file.size}-${file.lastModified}-${fi}`}
                                        type="button"
                                        onClick={() => setPreviewFile(file)}
                                        title={`Ver ${file.name}`}
                                        aria-label={`Ver adjunto ${file.name}`}
                                        className="cursor-pointer rounded-lg transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                                      >
                                        <FileThumbnail file={file} size={64} />
                                      </button>
                                    ))
                                  : m.attachments!.map((adj) => (
                                      <AdjuntoRemotoItem
                                        key={adj.ruta}
                                        adjunto={adj}
                                        onOpenPreview={setPreviewFile}
                                      />
                                    ))}
                              </div>
                            )}
                            <ChatMessage
                              from={m.from}
                              grouped={isGroupedNext}
                              time={
                                m.time ? (
                                  <span className="inline-flex items-center gap-1 tabular-nums">
                                    <span>{m.time}</span>
                                    {m.from === "user" && renderMessageStatus(m.status)}
                                  </span>
                                ) : undefined
                              }
                              actions={messageActions}
                            >
                              {hasBubbleContent ? (
                                <>
                                  {m.replyTo && (
                                    <span className="mb-1 flex items-center gap-1.5 border-l-2 border-foreground/30 pl-2 text-[12px] text-muted-foreground">
                                      <CornerDownRightIcon size={12} strokeWidth={1.8} className="shrink-0" />
                                      <span className="line-clamp-1">{m.replyTo}</span>
                                    </span>
                                  )}
                                  {renderTextoConMenciones(
                                    m.text,
                                    currentThread?.miembros,
                                    user
                                  )}
                                  {m.edited && (
                                    <span className="mt-1 block text-right text-[10px] leading-none text-muted-foreground/80 select-none">
                                      Editado
                                    </span>
                                  )}
                                </>
                              ) : null}
                            </ChatMessage>
                            {esUltimoMioGrupo && currentThread?.vistoPor && (
                              <Tooltip
                                content={
                                  currentThread.vistoPor.nombres.length > 0
                                    ? `Visto por: ${currentThread.vistoPor.nombres.join(", ")}`
                                    : "Aún sin lecturas"
                                }
                                side="left"
                              >
                                <span className="self-end px-1 text-[10px] text-muted-foreground tabular-nums select-none">
                                  Visto por {currentThread.vistoPor.leidos} de {currentThread.vistoPor.total}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                      {isCurrentTyping && (
                        <ChatMessage key="typing-indicator" from="assistant">
                          <ThinkingIndicator
                            showIcon={false}
                            label="Escribiendo..."
                            className="px-0 py-0"
                          />
                        </ChatMessage>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Queued-style stack overlaying just above the composer to cite & reply */}
                <AnimatePresence>
                  {quotedQueue.length > 0 && (
                    <motion.div
                      className="absolute inset-x-6 z-10"
                      style={{ bottom: inputH + 28 }}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        height: hovered ? expandedStackH : collapsedStackH,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ ...spring.moderate, bounce: 0 }}
                      onMouseEnter={() => setHovered(true)}
                      onMouseLeave={() => setHovered(false)}
                    >
                      <motion.div animate={stackBump} className="absolute inset-0">
                        <div
                          className="absolute bottom-0 left-0 flex items-center justify-end gap-1 pr-1 text-muted-foreground"
                          style={{ height: CARD_H, width: 40 }}
                        >
                          <AnimatePresence>
                            {hiddenCount > 0 && (
                              <motion.span
                                key="count"
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={spring.fast}
                                className="pointer-events-none text-[10px] leading-none tabular-nums text-muted-foreground"
                                style={{ fontVariationSettings: fontWeights.semibold }}
                              >
                                {quotedQueue.length}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <CornerDownRightIcon size={16} strokeWidth={2} />
                        </div>
                        <AnimatePresence initial={false}>
                          {quotedQueue.map((item, i) => {
                            const peek = Math.min(i, MAX_PEEK);
                            const target = hovered
                              ? { y: -i * (CARD_H + GAP), scale: 1, opacity: 1 }
                              : {
                                  y: -peek * PEEK,
                                  scale: 1 - peek * 0.05,
                                  opacity: i <= MAX_PEEK ? 1 : 0,
                                };
                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                                animate={target}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                                transition={spring.moderate}
                                style={{
                                  height: CARD_H,
                                  transformOrigin: "bottom center",
                                  zIndex: 100 - i,
                                }}
                                className={cn(
                                  "group/qm absolute bottom-0 left-10 right-10 flex select-none items-center gap-1.5 pr-1 text-[13px] text-muted-foreground shadow-surface-3 bg-[color-mix(in_oklab,var(--accent),var(--background)_68%)]",
                                  item.files.length > 0 ? "pl-1.5" : "pl-3",
                                  shape.bg
                                )}
                              >
                                {item.files.length > 0 && (
                                  <div className="pointer-events-none flex shrink-0 items-center gap-1">
                                    {item.files.slice(0, 3).map((f, fi) => (
                                      <FileThumbnail key={fi} file={f} size={24} radius={8} />
                                    ))}
                                    {item.files.length > 3 && (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-background/40 text-[11px] leading-3.5 tabular-nums text-foreground">
                                        +{item.files.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <span className="pointer-events-none min-w-0 flex-1 truncate">
                                  {item.text}
                                </span>
                                <div className="hidden shrink-0 items-center group-hover/qm:flex">
                                  <button
                                    type="button"
                                    onClick={() => removeQueued(item)}
                                    aria-label={`Quitar cita: ${item.text}`}
                                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                                  >
                                    <XIcon size={13} strokeWidth={2.5} />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {mentionMatch && (
                    <motion.div
                      className="absolute inset-x-6 z-20"
                      style={{ bottom: inputH + 28 }}
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={spring.fast}
                    >
                      <Elevated
                        offset={2}
                        shadowLevel={3}
                        className={cn(
                          "w-full max-w-xs border border-border/70 p-1.5 backdrop-blur-md",
                          shape.container
                        )}
                      >
                        <div
                          ref={mentionListRef}
                          onMouseEnter={mentionHover.handlers.onMouseEnter}
                          onMouseMove={mentionHover.handlers.onMouseMove}
                          onMouseLeave={mentionHover.handlers.onMouseLeave}
                          className="relative flex flex-col"
                        >
                          <FluidHoverHighlight
                            hover={mentionHover}
                            className={shape.item}
                          />
                          {mentionMatch.opciones.map((op, idx) => (
                            <button
                              key={op.id}
                              ref={(el) => mentionHover.registerItem(idx, el)}
                              type="button"
                              onClick={() => handlePickMention(op.label)}
                              className={cn(
                                "relative z-10 flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[13px] outline-none",
                                shape.item
                              )}
                            >
                              <span className="truncate font-medium text-foreground">
                                @{op.label}
                              </span>
                              <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                                {op.sub}
                              </span>
                            </button>
                          ))}
                        </div>
                      </Elevated>
                    </motion.div>
                  )}
                </AnimatePresence>

                {currentThread && (
                  <InputMessage
                    ref={setInputEl}
                    className="absolute inset-x-6 bottom-5"
                    value={value}
                    onValueChange={handleComposerValueChange}
                    onSend={async (text, sent) => {
                      if (!text && !sent.length) return;
                      if (stopTypingTimerRef.current) {
                        clearTimeout(stopTypingTimerRef.current);
                      }
                      void realtimeRef.current?.enviarTyping(currentThread.id, false);

                      if (editingMessageId) {
                        const targetId = editingMessageId;
                        const targetConvId = currentThread.id;
                        const originalMsg = (messagesByThread[targetConvId] ?? []).find(
                          (m) => m.id === targetId
                        );

                        setMessagesByThread((prev) => ({
                          ...prev,
                          [targetConvId]: (prev[targetConvId] ?? []).map((msg) =>
                            msg.id === targetId
                              ? { ...msg, text, edited: true }
                              : msg
                          ),
                        }));
                        setEditingMessageId(null);
                        setValue("");
                        setFiles([]);

                        if (user?.id) {
                          try {
                            if (currentThread.tipo === "grupo") {
                              await editarMensajeGrupo({
                                mensajeId: targetId,
                                grupoId: targetConvId,
                                userId: user.id,
                                username: user.username || user.id,
                                text,
                                replyTo: originalMsg?.replyToPayload,
                                attachments: originalMsg?.attachments,
                              });
                            } else {
                              await editarMensaje({
                                mensajeId: targetId,
                                conversacionId: targetConvId,
                                userId: user.id,
                                username: user.username || user.id,
                                extremoParPublico: currentThread.extremoParPublico ?? [],
                                text,
                                replyTo: originalMsg?.replyToPayload,
                                attachments: originalMsg?.attachments,
                              });
                            }
                            void realtimeRef.current?.enviarSync(targetConvId);
                          } catch {
                            setMessagesByThread((prev) => ({
                              ...prev,
                              [targetConvId]: (prev[targetConvId] ?? []).map((msg) =>
                                msg.id === targetId ? { ...msg, status: "error" } : msg
                              ),
                            }));
                          }
                        }
                        return;
                      }

                      const firstQuote = quotedQueue[0];
                      const replyToPayload: ReplyToPayload | undefined =
                        quotedQueue.length > 0
                          ? {
                              id: firstQuote.messageId || firstQuote.id,
                              author: firstQuote.author || currentThread.label,
                              text: quotedQueue.map((q) => q.text).join(" • "),
                            }
                          : undefined;
                      const replyToText = replyToPayload
                        ? replyToPayload.author
                          ? `${replyToPayload.author}: ${replyToPayload.text}`
                          : replyToPayload.text
                        : undefined;

                      const msgId = crypto.randomUUID();
                      const targetThreadId = currentThread.id;
                      const effectiveText = text.trim().length > 0 ? text : "";

                      const nextMsg: ThreadMessage = {
                        id: msgId,
                        remitenteId: user?.id,
                        from: "user",
                        text: effectiveText,
                        files: sent,
                        time: format(new Date(), "HH:mm"),
                        createdAt: new Date().toISOString(),
                        replyTo: replyToText,
                        replyToPayload,
                        status: "sent",
                      };

                      setMessagesByThread((prev) => ({
                        ...prev,
                        [targetThreadId]: [...(prev[targetThreadId] ?? []), nextMsg],
                      }));
                      setValue("");
                      setFiles([]);
                      setQuotedQueue([]);

                      if (user?.id) {
                        try {
                          if (currentThread.tipo === "grupo") {
                            await enviarMensajeGrupo({
                              grupoId: targetThreadId,
                              userId: user.id,
                              username: user.username || user.id,
                              text: effectiveText,
                              replyTo: replyToPayload,
                              files: sent,
                              mensajeId: msgId,
                            });
                          } else {
                            await enviarMensaje({
                              conversacionId: targetThreadId,
                              userId: user.id,
                              username: user.username || user.id,
                              extremoParPublico: currentThread.extremoParPublico ?? [],
                              text: effectiveText,
                              replyTo: replyToPayload,
                              files: sent,
                              mensajeId: msgId,
                            });
                          }
                          void realtimeRef.current?.enviarSync(targetThreadId);
                        } catch {
                          setMessagesByThread((prev) => ({
                            ...prev,
                            [targetThreadId]: (prev[targetThreadId] ?? []).map((msg) =>
                              msg.id === msgId ? { ...msg, status: "error" } : msg
                            ),
                          }));
                        }
                      } else {
                        setTimeout(() => {
                          setMessagesByThread((prev) => ({
                            ...prev,
                            [targetThreadId]: (prev[targetThreadId] ?? []).map((msg) =>
                              msg.id === msgId ? { ...msg, status: "delivered" } : msg
                            ),
                          }));
                        }, 700);
                        setTimeout(() => {
                          setMessagesByThread((prev) => ({
                            ...prev,
                            [targetThreadId]: (prev[targetThreadId] ?? []).map((msg) =>
                              msg.id === msgId ? { ...msg, status: "read" } : msg
                            ),
                          }));
                        }, 1600);
                      }
                    }}
                    rightSlot={
                      editingMessageId ? (
                        <Tooltip content="Cancelar edición" side="top">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Cancelar edición"
                            onClick={() => {
                              setEditingMessageId(null);
                              setValue("");
                            }}
                          >
                            <XIcon />
                          </Button>
                        </Tooltip>
                      ) : undefined
                    }
                    placeholder={`Escribile a ${currentThread.label}...`}
                    sendLabel="Enviar mensaje"
                    // ArrowUp recalls sent messages, ArrowDown walks back to the draft.
                    history={currentMessages
                      .filter((m) => m.from === "user")
                      .map((m) => m.text)
                      .filter(Boolean)}
                    files={files}
                    onFilesChange={setFiles}
                    leftSlot={({ openFilePicker }) => (
                      <>
                        <Tooltip content="Adjuntar" side="top">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Adjuntar archivos"
                            onClick={() => openFilePicker()}
                          >
                            <PlusIcon />
                          </Button>
                        </Tooltip>
                        <PopoverPrimitive.Root
                          open={emojiOpen}
                          actionsRef={emojiActionsRef}
                          modal={false}
                          onOpenChange={(next, details) => {
                            if (!next) details.preventUnmountOnClose();
                            setEmojiOpen(next);
                          }}
                        >
                          <PopoverPrimitive.Trigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Emojis"
                                title="Emojis"
                              >
                                <HugeiconsIcon icon={SmileIcon} size={16} strokeWidth={1.8} />
                              </Button>
                            }
                          />
                          <PopoverPrimitive.Portal>
                            <PopoverPrimitive.Positioner
                              side="top"
                              align="start"
                              sideOffset={8}
                              className="z-[70] outline-none"
                            >
                              <PopoverPrimitive.Popup className="outline-none">
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.96, y: 4 }}
                                  animate={
                                    emojiOpen
                                      ? { opacity: 1, scale: 1, y: 0 }
                                      : { opacity: 0, scale: 0.96, y: 4 }
                                  }
                                  transition={emojiOpen ? spring.fast : spring.fast.exit}
                                  onAnimationComplete={() => {
                                    if (!emojiOpen) emojiActionsRef.current?.unmount();
                                  }}
                                  className={cn("origin-bottom-left outline-none", popupMotionClass)}
                                >
                                  <Elevated
                                    offset={2}
                                    shadowLevel={3}
                                    className={cn("border border-border/80 p-1.5", shape.container)}
                                  >
                                    <div
                                      ref={emojiGridRef}
                                      onMouseEnter={emojiHover.handlers.onMouseEnter}
                                      onMouseMove={emojiHover.handlers.onMouseMove}
                                      onMouseLeave={emojiHover.handlers.onMouseLeave}
                                      className="relative grid grid-cols-8 gap-1"
                                    >
                                      <FluidHoverHighlight
                                        hover={emojiHover}
                                        className={shape.item}
                                      />
                                      {QUICK_EMOJIS.map((emoji, idx) => (
                                        <button
                                          key={emoji}
                                          ref={(el) => emojiHover.registerItem(idx, el)}
                                          type="button"
                                          onClick={() => {
                                            setValue((prev) => `${prev}${emoji}`);
                                            setEmojiOpen(false);
                                          }}
                                          className={cn(
                                            "relative z-10 flex h-7 w-7 cursor-pointer items-center justify-center text-[15px] leading-none outline-none active:scale-95 transition-transform duration-80",
                                            shape.item
                                          )}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </Elevated>
                                </motion.div>
                              </PopoverPrimitive.Popup>
                            </PopoverPrimitive.Positioner>
                          </PopoverPrimitive.Portal>
                        </PopoverPrimitive.Root>
                      </>
                    )}
                  />
                )}
                </div>
              </SizeProvider>
            </div>
          </SidebarProvider>
        </TooltipProvider>
      </DialogContent>

      <Dialog
        open={previewFile !== null}
        onOpenChange={(next) => {
          if (!next) setPreviewFile(null);
        }}
      >
        <DialogContent size="lg" className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate text-[14px]">
                {previewFile?.name || "Archivo adjunto"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                {previewFile ? `${(previewFile.size / 1024).toFixed(1)} KB` : ""}
              </DialogDescription>
            </div>
            {previewFile && previewUrl && (
              <a
                href={previewUrl}
                download={previewFile.name}
                className={cn(
                  "shrink-0 border border-border px-3 py-1.5 text-[12px] text-foreground transition-colors hover:bg-hover",
                  shape.button
                )}
              >
                Descargar
              </a>
            )}
          </div>
          {previewFile && previewUrl && (
            <div className="flex max-h-[70dvh] items-center justify-center overflow-hidden rounded-lg bg-muted/30">
              {previewFile.type.startsWith("image/") ? (
                <img
                  src={previewUrl}
                  alt={previewFile.name}
                  className="max-h-[70dvh] w-auto object-contain"
                />
              ) : previewFile.type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  title={previewFile.name}
                  className="h-[70dvh] w-full border-0"
                />
              ) : (
                <div className="py-12 text-center text-[13px] text-muted-foreground">
                  Vista previa no disponible para este tipo de archivo. Podés descargarlo arriba.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={newGroupOpen}
        onOpenChange={(next) => {
          setNewGroupOpen(next);
          if (!next) {
            setGroupName("");
            setGroupMemberIds([]);
            setGroupMemberQuery("");
          }
        }}
      >
        <DialogContent size="sm" className="flex flex-col gap-3 p-5">
          <div>
            <DialogTitle className="text-[15px]">Nuevo grupo</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              Creá un grupo cifrado con encargados o sucursales.
            </DialogDescription>
          </div>
          <SidebarInput
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nombre del grupo (ej. Zona Norte)"
            aria-label="Nombre del grupo"
          />
          <SidebarInput
            value={groupMemberQuery}
            onChange={(e) => setGroupMemberQuery(e.target.value)}
            placeholder="Filtrar integrantes..."
            aria-label="Filtrar integrantes"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {contacts
              .filter((c) => {
                const q = groupMemberQuery.trim().toLowerCase();
                if (!q) return true;
                return (
                  c.name.toLowerCase().includes(q) ||
                  c.branch.toLowerCase().includes(q)
                );
              })
              .map((c) => {
                const checked = groupMemberIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setGroupMemberIds((prev) =>
                        prev.includes(c.id)
                          ? prev.filter((x) => x !== c.id)
                          : [...prev, c.id]
                      )
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      checked ? "bg-accent text-accent-foreground" : "hover:bg-hover"
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {c.branch}
                      </span>
                    </span>
                    <span className="ml-2 shrink-0 text-[11px]">
                      {checked ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNewGroupOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creatingGroup || groupName.trim().length < 2}
              onClick={() => void handleCreateGroup()}
            >
              {creatingGroup ? "Creando..." : `Crear (${groupMemberIds.length + 1})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={membersModalOpen} onOpenChange={setMembersModalOpen}>
        <DialogContent size="sm" className="flex flex-col gap-3 p-5">
          <div>
            <DialogTitle className="text-[15px]">
              {currentThread?.label || "Miembros"}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              {currentThread?.miembros?.length ?? 0} integrantes en este grupo.
            </DialogDescription>
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
            {(currentThread?.miembros ?? []).map((m) => (
              <div
                key={m.operadorId}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.nombre}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.sector}
                  </div>
                </div>
                <span className="ml-2 shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {m.rol === "administrador" ? "Admin" : "Miembro"}
                </span>
              </div>
            ))}
          </div>
          {currentThread?.esAdminGrupo && currentThread.id && (
            <div className="border-t border-border/60 pt-2">
              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                Agregar integrante
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {contacts
                  .filter(
                    (c) =>
                      !(currentThread.miembros ?? []).some(
                        (m) => m.operadorId === c.id
                      )
                  )
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={async () => {
                        await agregarMiembrosGrupo(currentThread.id, [c.id]);
                        await cargarDatosMensajeria();
                        void realtimeRef.current?.enviarSync(currentThread.id);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[12px] hover:bg-hover"
                    >
                      <span className="truncate">
                        {c.name} · <span className="text-muted-foreground">{c.branch}</span>
                      </span>
                      <span className="text-[11px] text-primary">+ Agregar</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

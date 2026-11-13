import { useState, useEffect, useMemo, useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { motion } from "motion/react";
import { Bell01 as Bell, Settings01 as Settings, Moon01 as Moon, Sun, Trash01 as Trash2, CheckCircle as Check, MessageSquare01 as MessageSquare, XClose as XIcon, InfoCircle, AlertTriangle as ErrorIcon, AlertCircle as WarningIcon } from '@untitledui/icons';
import { Dialog, DialogHeader, DialogTitle, DialogPopup, DialogPanel } from "@/components/ui/dialog";
import { TabsSubtle, TabsSubtleItem, TabsSubtlePanel } from "@/components/ui/tabs-subtle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import { useNotifications } from "@/contexts/NotificationContext";
import { DEMO_NOTIFICATIONS, SECTOR_BY_CATEGORY, type NotificationSegment } from "@/constants/notificationTemplates";
import { surfaceClasses } from "@/lib/surface-classes";
import { Elevated } from "@/lib/elevated";
import { spring, exitFallbackMs } from "@/lib/springs";
import { popupMotionClass } from "@/lib/popup";
import { useShape } from "@/lib/shape-context";
import { useIcon } from "@/lib/icon-context";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";
import { fontWeights } from "@/lib/font-weight";

// --- Tab types for the notification panel ---
type NotifTab = 'mensajes' | 'mencionado' | 'todas';

// Categories corresponding to "Mensajes" (system announcements, alerts, calendar, inventory)
const MESSAGE_CATEGORIES = ['SYSTEM', 'ALERTA', 'INVENTARIO', 'VENCIMIENTO', 'CALENDARIO'];
// "Mencionado" = announcements sent specifically or user mentions
const MENTIONED_CATEGORIES = ['ANUNCIO', 'ENVIADO'];

// Icon for notification type
function NotifTypeIcon({ type, className }: { type: string; className?: string }) {
  const baseClass = cn("size-4 shrink-0", className);
  switch (type) {
    case 'error':
      return <ErrorIcon className={cn(baseClass, "text-red-500")} />;
    case 'warning':
      return <WarningIcon className={cn(baseClass, "text-amber-500")} />;
    case 'success':
      return <Check className={cn(baseClass, "text-emerald-500")} />;
    default:
      return <InfoCircle className={cn(baseClass, "text-blue-500")} />;
  }
}

// Avatar / Recuadro de emisor (36x36 px circular)
function NotificationAvatar({
  sender,
  type,
  category,
}: {
  sender?: { name?: string; initials?: string; avatarUrl?: string };
  type: string;
  category?: string;
}) {
  // Color de acento suave según tipo/categoría
  const isError = type === 'error' || category === 'VENCIMIENTO';
  const isWarning = type === 'warning' || category === 'INVENTARIO';
  const isSuccess = type === 'success';

  return (
    <div
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full border select-none transition-colors",
        isError
          ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
          : isWarning
          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : isSuccess
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border/60 bg-muted/40 text-muted-foreground"
      )}
    >
      {sender?.avatarUrl ? (
        <img
          src={sender.avatarUrl}
          alt={sender.name || "Avatar"}
          className="size-full rounded-full object-cover"
        />
      ) : sender?.initials ? (
        <span
          className="text-[12px] font-semibold tracking-tight"
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          {sender.initials}
        </span>
      ) : (
        <NotifTypeIcon type={type} className="size-4" />
      )}
    </div>
  );
}

// Relative time helper
function timeAgo(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: es });
  } catch {
    return '';
  }
}

export function MessagesMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-block relative">
        <button onClick={() => setOpen(true)} aria-label="Mensajes" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <DialogPopup className="w-[420px] p-0">
        <DialogHeader>
          <DialogTitle>Mensajes</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted/20 mb-4" />
          <p className="text-muted-foreground">No tienes mensajes nuevos en este momento.</p>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<{ unmount: () => void; close: () => void } | null>(null);
  const shape = useShape();
  const CloseIcon = useIcon("x");
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<NotifTab>('mensajes');
  const tabKeys: NotifTab[] = ['mensajes', 'mencionado', 'todas'];
  const selectedIndex = tabKeys.indexOf(activeTab);
  const handleSelectTab = (index: number) => {
    setActiveTab(tabKeys[index]);
  };

  useEffect(() => {
    if (open) return;
    const id = setTimeout(
      () => actionsRef.current?.unmount(),
      exitFallbackMs(spring.fast)
    );
    return () => clearTimeout(id);
  }, [open]);

  // Active notifications combining real Supabase data + Demo Templates for preview
  const displayNotifications = useMemo(() => {
    // Si ya hay notificaciones en Supabase, las mostramos primero y sumamos las de demo si hay pocas
    const existingIds = new Set(notifications.map(n => n.id));
    const demoFiltered = DEMO_NOTIFICATIONS.filter(d => !existingIds.has(d.id));
    return [...notifications, ...demoFiltered];
  }, [notifications]);

  // Counts for tabs
  const counts = useMemo(() => ({
    mensajes: displayNotifications.filter(n => MESSAGE_CATEGORIES.includes((n.category || '').toUpperCase())).length,
    mencionado: displayNotifications.filter(n => MENTIONED_CATEGORIES.includes((n.category || '').toUpperCase())).length,
    todas: displayNotifications.length,
  }), [displayNotifications]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    notify.success("Listo", "Todas las notificaciones marcadas como leídas");
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      actionsRef={actionsRef}
      modal={false}
      onOpenChange={(next, details) => {
        if (!next) details.preventUnmountOnClose();
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            className={cn("h-[34px] w-[34px] rounded-lg shrink-0 cursor-pointer relative", surfaceClasses(3))}
          >
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-accent' : 'text-current'}`} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background shadow-sm"
                role="status"
                aria-label={`${unreadCount} notificaciones nuevas`}
              >
                {unreadCount}
              </span>
            )}
          </Button>
        }
      />

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-[var(--z-popover,60)] outline-none [--popup-available-height:var(--available-height)]"
        >
          <PopoverPrimitive.Popup className="outline-none">
            <motion.div
              className={cn("outline-none", popupMotionClass)}
              initial={{ opacity: 0, y: "var(--popup-enter-y)", scaleY: 0.96 }}
              animate={
                open
                  ? { opacity: 1, y: 0, scaleY: 1 }
                  : { opacity: 0, y: "var(--popup-enter-y)", scaleY: 0.96 }
              }
              transition={open ? spring.fast : spring.fast.exit}
              onAnimationComplete={() => {
                if (!open) actionsRef.current?.unmount();
              }}
            >
              <Elevated
                offset={2}
                shadowLevel={3}
                data-slot="notifications-popup"
                className={cn(
                  "relative w-[420px] sm:w-[460px] max-w-[calc(100vw-1rem)] h-[520px] max-h-[min(560px,var(--popup-available-height,560px))] flex flex-col overflow-hidden text-foreground outline-none",
                  shape.container
                )}
              >
                {/* ── Header + Tabs ── */}
                <div className="flex shrink-0 flex-col gap-2.5 border-b border-border/60 px-6 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <h2
                      className="m-0 text-[16px] leading-tight text-foreground"
                      style={{ fontVariationSettings: fontWeights.normal }}
                    >
                      Notificaciones
                    </h2>
                    <PopoverPrimitive.Close
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-3 top-3"
                        >
                          <CloseIcon />
                          <span className="sr-only">Cerrar</span>
                        </Button>
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <TabsSubtle
                      idPrefix="notif"
                      size="compact"
                      selectedIndex={selectedIndex}
                      onSelect={handleSelectTab}
                    >
                      <TabsSubtleItem index={0} label={counts.mensajes > 0 ? `Mensajes (${counts.mensajes})` : "Mensajes"} />
                      <TabsSubtleItem index={1} label={counts.mencionado > 0 ? `Mencionado (${counts.mencionado})` : "Mencionado"} />
                      <TabsSubtleItem index={2} label={counts.todas > 0 ? `Todas (${counts.todas})` : "Todas"} />
                    </TabsSubtle>

                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      disabled={unreadCount === 0}
                      onClick={handleMarkAllRead}
                      className="shrink-0 text-muted-foreground hover:text-foreground text-[12px] h-7 px-2 font-normal"
                      style={{ fontVariationSettings: fontWeights.normal }}
                    >
                      Marcar leídas
                    </Button>
                  </div>
                </div>

                {/* ── Content (Notification List) ── */}
                <div className="flex min-h-0 flex-1 flex-col">
                  {tabKeys.map((key, i) => {
                    const isSelected = selectedIndex === i;
                    const list = key === 'todas'
                      ? displayNotifications
                      : key === 'mencionado'
                      ? displayNotifications.filter(n => MENTIONED_CATEGORIES.includes((n.category || '').toUpperCase()))
                      : displayNotifications.filter(n => MESSAGE_CATEGORIES.includes((n.category || '').toUpperCase()));

                    return (
                      <TabsSubtlePanel
                        key={key}
                        index={i}
                        selectedIndex={selectedIndex}
                        idPrefix="notif"
                        className={cn("outline-none", isSelected && "flex min-h-0 flex-1 flex-col")}
                      >
                        {list.length > 0 ? (
                          <ScrollArea className="min-h-0 flex-1">
                            <div className="flex flex-col px-6">
                              {list.map((n) => {
                                const sender = (n as any).sender;
                                const segments: NotificationSegment[] | undefined =
                                  (n as any).segments || n.metadata?.segments;
                                const sector: string | undefined =
                                  (n as any).sector ||
                                  n.metadata?.sector ||
                                  SECTOR_BY_CATEGORY[(n.category || '').toUpperCase()];
                                const timeLabel = timeAgo(n.created_at);

                                return (
                                  <div
                                    key={n.id}
                                    className="group flex cursor-pointer items-start gap-3 border-b border-border/60 py-4 transition-colors last:border-b-0"
                                    onClick={() => {
                                      if (!n.is_read) markAsRead(n.id);
                                    }}
                                  >
                                    {/* Static unread dot + Circular Avatar (36x36) */}
                                    <div className="relative shrink-0">
                                      {!n.is_read && (
                                        <span
                                          aria-label="No leída"
                                          className="absolute -left-3.5 top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-[var(--notification-unread)]"
                                        />
                                      )}
                                      <NotificationAvatar
                                        sender={sender}
                                        type={n.type || 'info'}
                                        category={n.category}
                                      />
                                    </div>

                                    {/* Content: una sola oración inline + línea Fecha • Sector */}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="min-w-0 flex-1 text-[13px] leading-[19px]">
                                          {Array.isArray(segments) && segments.length > 0 ? (
                                            segments.map((seg, idx) => (
                                              <span
                                                key={idx}
                                                className={seg.highlight ? "text-foreground" : "text-muted-foreground"}
                                                style={{
                                                  fontVariationSettings: seg.highlight
                                                    ? fontWeights.semibold
                                                    : fontWeights.normal,
                                                }}
                                              >
                                                {seg.text}
                                              </span>
                                            ))
                                          ) : (
                                            <>
                                              <span
                                                className="text-foreground"
                                                style={{ fontVariationSettings: fontWeights.semibold }}
                                              >
                                                {n.title}
                                              </span>
                                              {n.message && (
                                                <span
                                                  className="text-muted-foreground"
                                                  style={{ fontVariationSettings: fontWeights.normal }}
                                                >
                                                  {` ${n.message}`}
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </p>

                                        {/* Action buttons */}
                                        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); if (!n.is_read) markAsRead(n.id); }}
                                            className="inline-flex size-6 items-center justify-center rounded-[5px] text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground active:bg-active"
                                            title="Marcar como leída"
                                          >
                                            <XIcon className="size-3.5" />
                                          </button>
                                          {MENTIONED_CATEGORIES.includes((n.category || '').toUpperCase()) && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm("¿Estás seguro de que deseas eliminar esta notificación?")) {
                                                  deleteNotification(n.id);
                                                }
                                              }}
                                              className="ml-0.5 inline-flex size-6 items-center justify-center rounded-[5px] text-muted-foreground transition-colors duration-80 hover:bg-destructive/10 hover:text-destructive"
                                              title="Eliminar notificación"
                                            >
                                              <Trash2 className="size-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Fecha • Sector */}
                                      <p
                                        className="text-[12px] leading-[16px] text-muted-foreground"
                                        style={{ fontVariationSettings: fontWeights.normal }}
                                      >
                                        {timeLabel && sector
                                          ? `${timeLabel} • ${sector}`
                                          : timeLabel || sector || ""}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-6 text-center">
                            <p
                              className="text-[13px] text-foreground"
                              style={{ fontVariationSettings: fontWeights.normal }}
                            >
                              No hay notificaciones
                            </p>
                            <p
                              className="text-[12px] text-muted-foreground"
                              style={{ fontVariationSettings: fontWeights.normal }}
                            >
                              Las nuevas aparecerán aquí automáticamente
                            </p>
                          </div>
                        )}
                      </TabsSubtlePanel>
                    );
                  })}
                </div>
              </Elevated>
            </motion.div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark" || document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);
  }, []);

  const handleToggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-block">
        <button
          onClick={() => setOpen(true)}
          aria-label="Configuración"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 border border-border/40 hover:bg-muted/80 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <DialogPopup className="w-[420px] p-0">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <ul className="divide-y divide-border/10">
            <li className="py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Tema</div>
                <div className="text-xs text-muted-foreground">{isDarkMode ? "Oscuro" : "Claro"}</div>
              </div>
              <button
                onClick={handleToggleDarkMode}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-muted hover:bg-accent/30 transition-colors"
                aria-label="Cambiar tema"
              >
                {isDarkMode ? (
                  <Moon className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Sun className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </li>
          </ul>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useUser();

  const getInitials = () => {
    if (!user) return "??";

    // Si es una sucursal, usar F + Inicial de la sucursal
    if (user.role === 'branch' && user.branchName) {
      const branchName = user.branchName.replace(/^farmacia\s+/i, '');
      return `F${branchName.charAt(0).toUpperCase()}`;
    }

    // Si es un admin/mod, usar iniciales del nombre
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return user.name.charAt(0).toUpperCase();
  };

  const initials = getInitials();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-block">
        <button
          onClick={() => setOpen(true)}
          aria-label="Usuario"
          className="group flex items-center justify-center h-10 w-10 rounded-xl overflow-hidden hover:ring-2 hover:ring-foreground/10 transition-all bg-muted/50 border border-border/40"
        >
          <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-foreground transition-colors group-hover:bg-foreground group-hover:text-background border-none">
            {initials}
          </div>
        </button>
      </div>
      <DialogPopup className="w-[360px] p-0">
        <DialogHeader>
          <DialogTitle>Cuenta</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center font-black text-primary border border-primary/20">
              {initials}
            </div>
            <div>
              <div className="font-bold">{user?.name}</div>
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{user?.username || user?.role}</div>
            </div>
          </div>
          <div className="divide-y divide-border/10">
            <div className="py-2.5">
              <button
                onClick={() => setOpen(false)}
                className="w-full text-left hover:text-primary transition-all font-bold text-sm"
              >
                Ver perfil
              </button>
            </div>
            <div className="py-2.5">
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="w-full text-left hover:text-destructive transition-all font-bold text-sm"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}


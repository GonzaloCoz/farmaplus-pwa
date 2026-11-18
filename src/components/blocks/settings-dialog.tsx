"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { useIcons, type IconName } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { fontWeights } from "@/lib/font-weight";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { FluidCheckbox } from "@/components/ui/fluid-checkbox";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useTint, type AppTint } from "@/hooks/useTint";
import { useAvatarMode, getUserInitials } from "@/hooks/useAvatarMode";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { useNotificationPreferences, type NotificationPosition } from "@/contexts/NotificationPreferencesContext";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  MenuItem,
} from "@/components/ui/dropdown";
import { SIDEBAR_MENU_POPUP } from "@/lib/sidebar-menu-grid";
import {
  ChevronsUpDown,
  LogOut as LogOutIcon,
  Webhook as WebhookIcon,
  QrCode as QrCodeIcon,
} from "lucide-react";
import { InventoryQrLocationsPanel } from "@/components/settings/InventoryQrLocationsPanel";
import { HugeiconsIcon } from "@hugeicons/react";
import CheckIcon from "@hugeicons/core-free-icons/CheckIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import {
  useSystemModules,
  CONSTRUCTION_PAGES_LIST,
  DEFAULT_CONSTRUCTION_PAGES,
  type ConstructionPageKey,
} from "@/hooks/useSystemModules";

interface SettingsSection {
  id: string;
  label: string;
  icon?: IconName;
  iconComponent?: React.ComponentType<{ className?: string }>;
  description: string;
}

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "Cuenta", icon: "user", description: "Nombre de tu cuenta, idioma y región." },
  { id: "notifications", label: "Notificaciones", icon: "bell", description: "Qué notificaciones recibes y cuándo." },
  { id: "appearance", label: "Apariencia", icon: "palette", description: "Perfil, tinte de color y tema para este dispositivo." },
  { id: "security", label: "Seguridad", icon: "shield", description: "Protección de inicio de sesión y sesiones activas." },
  { id: "inventory-qr", label: "Ubicaciones QR", iconComponent: QrCodeIcon, description: "Generar etiquetas QR en A4 (2×4) y padrón de ubicaciones vigentes." },
  { id: "modules", label: "Módulos", iconComponent: WebhookIcon, description: "Control en tiempo real de servicios e integraciones con servidores." },
  { id: "members", label: "Miembros", icon: "users", description: "Quiénes pueden acceder a este espacio de trabajo." },
];

export interface SettingsDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The section shown first. @default "general" */
  defaultSection?: string;
}

export function SettingsDialog({
  open,
  defaultOpen,
  onOpenChange,
  defaultSection = "general",
}: SettingsDialogProps) {
  const navigate = useNavigate();
  const icons = useIcons();
  const { user, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { avatarMode, avatarImage } = useAvatarMode();
  const isBranchUser = user?.role === 'branch';
  const isAdmin = user?.role === 'admin' || user?.username?.toLowerCase() === 'gcoz';
  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === 'inventory-qr') return false; // Desactivado temporalmente
    if (s.id === 'modules' && !isAdmin) return false;
    if (isBranchUser && (s.id === 'members' || s.id === 'security')) return false;
    return true;
  });
  const [section, setSection] = useState(() => (defaultSection === 'inventory-qr' || (isBranchUser && (defaultSection === 'members' || defaultSection === 'security' || defaultSection === 'modules')) ? 'general' : defaultSection));
  const current = visibleSections.find((s) => s.id === section) ?? visibleSections[0];

  useEffect(() => {
    if (isBranchUser && (section === 'members' || section === 'security' || section === 'modules')) {
      setSection('general');
    }
  }, [isBranchUser, section]);

  const handleLogout = () => {
    onOpenChange?.(false);
    logout();
    navigate("/login");
  };

  const initials = getUserInitials(user);

  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="flex h-[min(640px,calc(100dvh-4rem))] overflow-hidden p-0"
      >
        <SidebarProvider
          persist={false}
          shortcut={null}
          width="13rem"
          className="h-full min-h-0"
        >
          <Sidebar
            collapsible="none"
            className="hidden h-full sm:flex bg-[rgb(var(--overlay)/0.03)]"
          >
            <SidebarHeader className="px-4 pt-5 pb-2">
              <DialogTitle style={{ fontVariationSettings: fontWeights.normal }}>
                Configuración
              </DialogTitle>
              <DialogDescription className="sr-only">
                Configuración de la cuenta y el espacio de trabajo.
              </DialogDescription>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Espacio de trabajo</SidebarGroupLabel>
                <SidebarMenu focusRing={false}>
                  {visibleSections.map((s) => (
                    <SidebarMenuItem key={s.id}>
                      <SidebarMenuButton
                        icon={s.iconComponent ?? (s.icon ? icons[s.icon] : undefined)}
                        isActive={s.id === section}
                        onClick={() => setSection(s.id)}
                      >
                        {s.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
              <SidebarMenu aria-label="User">
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownTrigger render={
                      <SidebarMenuButton aria-label="Open user menu">
                        <div className="-ml-0.5 -mr-0.5 size-5 shrink-0 rounded-full overflow-hidden flex items-center justify-center">
                          {avatarMode === "photo" && avatarImage ? (
                            <img
                              src={avatarImage}
                              alt={user?.name || "Usuario"}
                              className="size-full object-cover select-none"
                            />
                          ) : avatarMode === "photo" ? (
                            <div className="size-full bg-primary/20 text-primary flex items-center justify-center select-none">
                              <icons.user size={12} strokeWidth={2} />
                            </div>
                          ) : (
                            <div className="size-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold select-none">
                              {initials}
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 truncate text-[13px] text-foreground">
                          {user?.name || "Usuario"}
                        </span>
                        <span className="ml-auto -mr-0.5 flex size-6 shrink-0 items-center justify-center">
                          <ChevronsUpDown size={16} strokeWidth={1.5} className="text-muted-foreground" />
                        </span>
                      </SidebarMenuButton>
                    } />
                    <DropdownContent className={SIDEBAR_MENU_POPUP} side="top" align="start" sideOffset={6}>
                      <MenuItem index={0} icon={LogOutIcon} label="Cerrar sesión" onSelect={handleLogout} className="text-destructive focus:text-destructive" />
                    </DropdownContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Panel header — pr-12 keeps clear of the dialog's ✕. */}
            <div className="flex shrink-0 flex-col gap-1 px-6 pt-5 pb-4 pr-12">
              <div className="sm:hidden">
                <h2
                  className="mb-3 text-[16px] leading-tight text-foreground"
                  style={{ fontVariationSettings: fontWeights.normal }}
                >
                  Configuración
                </h2>
                <Select value={section} onValueChange={setSection}>
                  <SelectTrigger placeholder="Sección" />
                  <SelectContent>
                    {visibleSections.map((s, i) => (
                      <SelectItem key={s.id} index={i} value={s.id} icon={icons[s.icon]}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <h3
                className="hidden text-[16px] leading-tight text-foreground sm:block"
                style={{ fontVariationSettings: fontWeights.normal }}
              >
                {current.label}
              </h3>
              <p className="hidden text-[13px] text-muted-foreground sm:block">
                {current.description}
              </p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 px-6 pb-6">
                <SectionPanel id={current.id} onLogout={handleLogout} />
              </div>
            </ScrollArea>
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

const SWITCH_LABEL_HIDDEN = "[&>span:last-child]:sr-only";

function SettingRow({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-b-0",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-foreground">{label}</span>
        {description && (
          <span className="text-[12px] text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionPanel({ id, onLogout }: { id: string; onLogout?: () => void }) {
  switch (id) {
    case "notifications":
      return <NotificationsPanel />;
    case "appearance":
      return <AppearancePanel />;
    case "security":
      return <SecurityPanel onLogout={onLogout} />;
    case "modules":
      return <ModulesPanel />;
    case "inventory-qr":
      return <InventoryQrLocationsPanel />;
    case "members":
      return <MembersPanel />;
    default:
      return <GeneralPanel />;
  }
}

function GeneralPanel() {
  const icons = useIcons();
  const { user, updateUser } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { avatarImage, uploadAvatar, removeAvatar, isUploading } = useAvatarMode();
  const displayUserName = user?.name || user?.username || "Usuario";
  const canEditName = user?.role === "admin" || user?.role === "mod";
  const [name, setName] = useState(displayUserName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [language, setLanguage] = useState("es");
  const [timezone, setTimezone] = useState("utc-3");

  useEffect(() => {
    setName(displayUserName);
  }, [displayUserName]);

  const trimmedName = name.trim();
  const isNameModified = canEditName && name !== displayUserName;

  const handleConfirmName = async () => {
    if (!canEditName || !user?.id || !trimmedName || isSavingName) return;
    if (trimmedName === displayUserName) {
      setName(displayUserName);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ full_name: trimmedName })
        .eq("id", user.id);

      if (error) {
        notify.error("Error", "No se pudo actualizar el nombre.");
        return;
      }

      updateUser({ name: trimmedName });
      setName(trimmedName);
      notify.success("Nombre actualizado", "Tu nombre se ha guardado correctamente.");
    } catch {
      notify.error("Error", "Ocurrió un problema al guardar el nombre.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelName = () => {
    setName(displayUserName);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify.error("Formato no válido", "Por favor selecciona un archivo de imagen (PNG, JPG o WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.error("Archivo muy pesado", "La imagen no debe superar los 5 MB.");
      return;
    }

    const { ok } = await uploadAvatar(file);
    if (ok) {
      notify.success("Foto de perfil actualizada", "Se ha guardado tu nueva foto de perfil.");
    } else {
      notify.error("Error", "No se pudo actualizar la foto de perfil.");
    }
  };

  const handleRemovePhoto = async () => {
    await removeAvatar();
    notify.info("Foto de perfil eliminada", "Se ha restablecido la foto de perfil.");
  };

  const UserIcon = icons.user;

  return (
    <div className="flex flex-col">
      <SettingRow
        label="Foto de perfil"
        description="Sube una foto cuadrada en formato PNG, JPG o WEBP (máx. 5 MB)."
      >
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="size-10 shrink-0 rounded-full overflow-hidden bg-surface-3 border border-border/80 flex items-center justify-center">
            {avatarImage ? (
              <img
                src={avatarImage}
                alt="Foto de perfil"
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full bg-muted/60 flex items-center justify-center text-muted-foreground/70">
                <UserIcon size={18} strokeWidth={1.75} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="tertiary"
              size="compact"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? "Subiendo..." : "Cargar foto"}
            </Button>
            {avatarImage && (
              <Button
                type="button"
                variant="ghost"
                size="compact"
                disabled={isUploading}
                onClick={handleRemovePhoto}
                className="text-muted-foreground hover:text-destructive"
              >
                Quitar
              </Button>
            )}
          </div>
        </div>
      </SettingRow>

      <div className="flex flex-col gap-2.5 border-b border-border/60 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-foreground">Nombre</span>
          <span className="text-[12px] text-muted-foreground">
            Visible para vos y tu equipo.
          </span>
        </div>
        <InputGroup className="w-full">
          <InputField
            index={0}
            aria-label="Nombre"
            value={name}
            onChange={setName}
            placeholder="Tu nombre"
            disabled={!canEditName || isSavingName}
            onKeyDown={(e) => {
              if (!isNameModified) return;
              if (e.key === "Enter" && trimmedName.length > 0) {
                e.preventDefault();
                handleConfirmName();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancelName();
              }
            }}
            endAdornment={
              isNameModified ? (
                <div className="-mr-2 flex items-center">
                  <button
                    type="button"
                    aria-label="Confirmar cambio de nombre"
                    disabled={trimmedName.length === 0 || isSavingName}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleConfirmName}
                    className="inline-flex size-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground active:bg-active disabled:pointer-events-none disabled:opacity-40"
                  >
                    <HugeiconsIcon icon={CheckIcon} size={15} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar cambio de nombre"
                    disabled={isSavingName}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleCancelName}
                    className="inline-flex size-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground active:bg-active disabled:pointer-events-none disabled:opacity-40"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.8} />
                  </button>
                </div>
              ) : undefined
            }
          />
        </InputGroup>
      </div>

      <SettingRow label="Idioma" description="Utilizado para la interfaz y correos.">
        <Select value={language} onValueChange={setLanguage} disabled>
          <SelectTrigger placeholder="Idioma" />
          <SelectContent>
            <SelectItem index={0} value="es">Español</SelectItem>
            <SelectItem index={1} value="en">English</SelectItem>
            <SelectItem index={2} value="pt">Português</SelectItem>
            <SelectItem index={3} value="fr">Français</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label="Zona horaria" description="Las fechas y recordatorios la siguen.">
        <Select value={timezone} onValueChange={setTimezone} disabled>
          <SelectTrigger placeholder="Zona horaria" />
          <SelectContent>
            <SelectItem index={0} value="utc-3">(UTC−3) Buenos Aires</SelectItem>
            <SelectItem index={1} value="utc-5">(UTC−5) Bogotá / Lima</SelectItem>
            <SelectItem index={2} value="utc+0">(UTC+0) Londres</SelectItem>
            <SelectItem index={3} value="utc+1">(UTC+1) Madrid / París</SelectItem>
            <SelectItem index={4} value="utc+9">(UTC+9) Tokio</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  );
}

const POSITION_LABELS: Record<NotificationPosition, string> = {
  "bottom-right": "Abajo derecha",
  "bottom-center": "Abajo centro",
  "bottom-left": "Abajo izquierda",
  "top-right": "Arriba derecha",
  "top-center": "Arriba centro",
  "top-left": "Arriba izquierda",
};

function NotificationsPanel() {
  const [digest, setDigest] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [updates, setUpdates] = useState(false);
  const { preferences, setPosition } = useNotificationPreferences();

  const handlePositionChange = (pos: NotificationPosition) => {
    setPosition(pos);
    notify.dismiss();
    setTimeout(() => {
      notify.info("Posición actualizada", `Avisos configurados en: ${POSITION_LABELS[pos]}`, { position: pos });
    }, 60);
  };

  return (
    <div className="flex flex-col">
      <SettingRow label="Resumen diario" description="Un correo cada mañana con las novedades.">
        <Switch className={SWITCH_LABEL_HIDDEN} label="Resumen diario" checked={digest} onToggle={() => setDigest((v) => !v)} />
      </SettingRow>
      <SettingRow label="Menciones" description="Cuando alguien te menciona con @.">
        <Switch className={SWITCH_LABEL_HIDDEN} label="Menciones" checked={mentions} onToggle={() => setMentions((v) => !v)} />
      </SettingRow>
      <SettingRow label="Novedades del producto" description="Nuevas funcionalidades, una vez al mes como máximo.">
        <Switch className={SWITCH_LABEL_HIDDEN} label="Novedades del producto" checked={updates} onToggle={() => setUpdates((v) => !v)} />
      </SettingRow>
      <SettingRow label="Posición de notificaciones" description="Ubicación de los avisos y alertas emergentes.">
        <Select value={preferences.position} onValueChange={(v) => handlePositionChange(v as NotificationPosition)}>
          <SelectTrigger placeholder="Posición" />
          <SelectContent>
            <SelectItem index={0} value="bottom-right">Abajo derecha</SelectItem>
            <SelectItem index={1} value="bottom-center">Abajo centro</SelectItem>
            <SelectItem index={2} value="bottom-left">Abajo izquierda</SelectItem>
            <SelectItem index={3} value="top-right">Arriba derecha</SelectItem>
            <SelectItem index={4} value="top-center">Arriba centro</SelectItem>
            <SelectItem index={5} value="top-left">Arriba izquierda</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  );
}

const TINT_SWATCH_STYLES: Record<
  AppTint,
  { fill: string; border: string; ring: string }
> = {
  neutral: {
    fill: "oklch(0.845 0.014 257.4)",
    border: "oklch(0.735 0.026 257.4)",
    ring: "oklch(0.66 0.04 257.4)",
  },
  blue: {
    fill: "oklch(0.805 0.08 250)",
    border: "oklch(0.7 0.134 250)",
    ring: "oklch(0.63 0.157 250)",
  },
  indigo: {
    fill: "oklch(0.805 0.077 277.1)",
    border: "oklch(0.7 0.13 277.1)",
    ring: "oklch(0.63 0.177 277.1)",
  },
  emerald: {
    fill: "oklch(0.805 0.137 162.5)",
    border: "oklch(0.7 0.125 162.5)",
    ring: "oklch(0.63 0.121 162.5)",
  },
  violet: {
    fill: "oklch(0.805 0.086 295)",
    border: "oklch(0.7 0.145 295)",
    ring: "oklch(0.63 0.197 295)",
  },
  warm: {
    fill: "oklch(0.805 0.123 70.1)",
    border: "oklch(0.7 0.124 70.1)",
    ring: "oklch(0.63 0.12 70.1)",
  },
  rose: {
    fill: "oklch(0.805 0.087 16.4)",
    border: "oklch(0.7 0.158 16.4)",
    ring: "oklch(0.63 0.222 16.4)",
  },
};

function AppearancePanel() {
  const icons = useIcons();
  const { user } = useUser();
  const { themeMode, setThemeMode } = useTheme();
  const { tint, setTint, tints } = useTint();
  const { avatarMode, setAvatarMode, avatarImage } = useAvatarMode();
  const initials = getUserInitials(user);

  return (
    <div className="flex flex-col">
      <SettingRow
        label="Mostrar perfil"
        description="Elige si mostrarte con foto de perfil o con las iniciales de tu nombre."
      >
        <TooltipProvider>
          <div
            role="group"
            aria-label="Mostrar perfil"
            className="flex items-center gap-5"
          >
            <Tooltip content="Foto de perfil" contentClassName="z-[60]">
              <div
                onClick={() => setAvatarMode("photo")}
                className="group inline-flex items-center gap-2.5 cursor-pointer select-none"
              >
                <FluidCheckbox
                  checked={avatarMode === "photo"}
                  onToggle={() => setAvatarMode("photo")}
                  aria-label="Foto de perfil"
                  className={cn(
                    avatarMode !== "photo" &&
                      "group-hover:border-foreground/40 dark:group-hover:border-white/40"
                  )}
                />
                <div className="size-7 shrink-0 rounded-full overflow-hidden flex items-center justify-center">
                  {avatarImage ? (
                    <img
                      src={avatarImage}
                      alt="Foto de perfil"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full bg-primary/20 text-primary flex items-center justify-center select-none">
                      <icons.user size={14} strokeWidth={2} />
                    </div>
                  )}
                </div>
              </div>
            </Tooltip>

            <Tooltip content="Iniciales" contentClassName="z-[60]">
              <div
                onClick={() => setAvatarMode("initials")}
                className="group inline-flex items-center gap-2.5 cursor-pointer select-none"
              >
                <FluidCheckbox
                  checked={avatarMode === "initials"}
                  onToggle={() => setAvatarMode("initials")}
                  aria-label="Iniciales del nombre"
                  className={cn(
                    avatarMode !== "initials" &&
                      "group-hover:border-foreground/40 dark:group-hover:border-white/40"
                  )}
                />
                <div className="size-7 shrink-0 rounded-full overflow-hidden flex items-center justify-center">
                  <div className="size-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold select-none">
                    {initials}
                  </div>
                </div>
              </div>
            </Tooltip>
          </div>
        </TooltipProvider>
      </SettingRow>
      <SettingRow label="Tinte de color" description="Matiz de color sutil para toda la interfaz.">
        <TooltipProvider>
          <div
            role="radiogroup"
            aria-label="Tinte de color"
            className="flex flex-wrap items-center gap-2.5"
          >
            {tints.map((t) => {
              const isSelected = tint === t.id;
              const swatch = TINT_SWATCH_STYLES[t.id];
              return (
                <Tooltip
                  key={t.id}
                  content={t.label}
                  contentClassName="z-[60]"
                >
                  <Button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={t.label}
                    variant="ghost"
                    size="icon-compact"
                    onClick={() => setTint(t.id)}
                    className="border hover:brightness-[0.97] dark:hover:brightness-105"
                    style={{
                      backgroundColor: swatch.fill,
                      borderColor: swatch.border,
                    }}
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-[5px] rounded-[12px] border-2"
                        style={{ borderColor: swatch.ring }}
                      />
                    )}
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </SettingRow>
      <SettingRow label="Tema" description="Sigue al sistema a menos que elijas uno.">
        <Select value={themeMode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
          <SelectTrigger placeholder="Tema" />
          <SelectContent>
            <SelectItem index={0} value="system" icon={icons.monitor}>Sistema</SelectItem>
            <SelectItem index={1} value="light" icon={icons.sun}>Claro</SelectItem>
            <SelectItem index={2} value="dark" icon={icons.moon}>Oscuro</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  );
}

function SecurityPanel({ onLogout }: { onLogout?: () => void }) {
  const [twoFactor, setTwoFactor] = useState(true);
  const [alerts, setAlerts] = useState(true);
  return (
    <div className="flex flex-col">
      <SettingRow label="Autenticación en dos pasos" description="Un código de tu aplicación de autenticación al iniciar sesión.">
        <Switch className={SWITCH_LABEL_HIDDEN} label="Autenticación en dos pasos" checked={twoFactor} onToggle={() => setTwoFactor((v) => !v)} />
      </SettingRow>
      <SettingRow label="Alertas de nuevo inicio de sesión" description="Correo electrónico cuando un nuevo dispositivo inicia sesión.">
        <Switch className={SWITCH_LABEL_HIDDEN} label="Alertas de nuevo inicio de sesión" checked={alerts} onToggle={() => setAlerts((v) => !v)} />
      </SettingRow>
      <SettingRow label="Sesiones activas" description="3 dispositivos están conectados ahora.">
        <Button variant="secondary" size="sm">Cerrar todas las sesiones</Button>
      </SettingRow>
      {onLogout && (
        <SettingRow label="Cerrar sesión" description="Cerrar la sesión de tu cuenta en este equipo.">
          <Button variant="destructive" size="sm" onClick={onLogout}>Cerrar Sesión</Button>
        </SettingRow>
      )}
    </div>
  );
}

function ModulesPanel() {
  const { modules, toggleModule, toggleConstructionPage } = useSystemModules();
  const constructionPages = modules.constructionPages || DEFAULT_CONSTRUCTION_PAGES;

  const handleToggleConstruction = (pageKey: ConstructionPageKey, label: string) => {
    const nextState = !(constructionPages[pageKey] ?? DEFAULT_CONSTRUCTION_PAGES[pageKey]);
    toggleConstructionPage(pageKey);
    notify.info(
      nextState ? `${label} en construcción` : `${label} habilitado`,
      nextState
        ? `La pantalla de construcción de ${label} se activó en tiempo real para todos los usuarios.`
        : `La página de ${label} volvió a estar operativa en tiempo real.`
    );
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col">
        <SettingRow
          label="Sincronización de stock con servidor"
          description="Permite a las sucursales consultar y actualizar existencias en vivo desde Plex (MySQL)."
        >
          <Switch
            className={SWITCH_LABEL_HIDDEN}
            label="Sincronización de stock con servidor"
            checked={modules.stockSyncServer}
            onToggle={() => toggleModule('stockSyncServer')}
          />
        </SettingRow>

        <SettingRow
          label="Impacto directo de ajustes en Plex"
          description="Habilita la inserción de ajustes de stock directamente en la base de datos de Plex."
        >
          <Switch
            className={SWITCH_LABEL_HIDDEN}
            label="Impacto directo de ajustes en Plex"
            checked={modules.plexDirectAdjustments}
            onToggle={() => toggleModule('plexDirectAdjustments')}
          />
        </SettingRow>

        <SettingRow
          label="Detección de nuevos SKUs"
          description="Alerta y permite descargar automáticamente productos nuevos detectados en el servidor."
        >
          <Switch
            className={SWITCH_LABEL_HIDDEN}
            label="Detección de nuevos SKUs"
            checked={modules.autoDetectNewSkus}
            onToggle={() => toggleModule('autoDetectNewSkus')}
          />
        </SettingRow>

        <SettingRow
          label="Exportación de lotes de recuento"
          description="Permite generar y descargar archivos de diferencias y lotes a nivel local."
        >
          <Switch
            className={SWITCH_LABEL_HIDDEN}
            label="Exportación de lotes de recuento"
            checked={modules.exportBatches}
            onToggle={() => toggleModule('exportBatches')}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col gap-1 pb-2">
          <h4
            className="text-[16px] leading-tight text-foreground"
            style={{ fontVariationSettings: fontWeights.normal }}
          >
            Páginas en construcción
          </h4>
          <p className="text-[13px] text-muted-foreground">
            Control en tiempo real de las secciones visibles como en construcción para todos los usuarios.
          </p>
        </div>

        <div className="flex flex-col">
          {CONSTRUCTION_PAGES_LIST.map((item) => {
            const isChecked = constructionPages[item.key] ?? DEFAULT_CONSTRUCTION_PAGES[item.key];
            return (
              <SettingRow
                key={item.key}
                label={`${item.label} en construcción`}
                description={item.description}
              >
                <Switch
                  className={SWITCH_LABEL_HIDDEN}
                  label={`${item.label} en construcción`}
                  checked={isChecked}
                  onToggle={() => handleToggleConstruction(item.key, item.label)}
                />
              </SettingRow>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MemberUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
  branchName?: string;
}

function MembersPanel() {
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, role, active, branches (name)")
        .order("role", { ascending: true })
        .order("username", { ascending: true });

      if (error) throw error;

      const activeProfiles = (data || [])
        .filter((p: any) => p.active !== false)
        .map((p: any) => ({
          id: p.id,
          username: p.username,
          fullName: p.full_name || `@${p.username}`,
          role: p.role || "branch",
          active: p.active ?? true,
          branchName: p.branches?.name,
        }));

      setMembers(activeProfiles);
    } catch (err) {
      console.error("Error fetching members:", err);
      notify.error("Error", "No se pudieron cargar los miembros de Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    const previous = [...members];
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
    );

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      const roleLabels: Record<string, string> = {
        admin: "Administrador",
        mod: "Zonal",
        branch: "Sucursal",
      };
      notify.success("Rol Actualizado", `El rol cambió a ${roleLabels[newRole] || newRole}.`);
    } catch (err) {
      console.error("Error updating member role:", err);
      notify.error("Error", "No se pudo actualizar el rol en la base de datos.");
      setMembers(previous);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
        <span className="animate-pulse">Cargando miembros...</span>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
        <span>No se encontraron miembros activos en Supabase.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {members.map((m) => {
        const desc = m.branchName
          ? `@${m.username} · ${m.branchName}`
          : `@${m.username}`;

        return (
          <SettingRow
            key={m.id}
            label={m.fullName}
            description={desc}
          >
            <Select
              value={m.role}
              disabled={updatingId === m.id}
              onValueChange={(v) => handleRoleChange(m.id, v)}
            >
              <SelectTrigger placeholder="Rol" variant="borderless" />
              <SelectContent>
                <SelectItem index={0} value="admin">
                  Administrador
                </SelectItem>
                <SelectItem index={1} value="mod">
                  Zonal
                </SelectItem>
                <SelectItem index={2} value="branch">
                  Sucursal
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        );
      })}
    </div>
  );
}

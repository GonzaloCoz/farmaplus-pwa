"use client";

import { useState, useEffect, type ReactNode } from "react";
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
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useTint, type AppTint } from "@/hooks/useTint";
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
} from "lucide-react";

interface SettingsSection {
  id: string;
  label: string;
  icon: IconName;
  description: string;
}

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", icon: "settings", description: "Nombre del espacio de trabajo, idioma y región." },
  { id: "notifications", label: "Notificaciones", icon: "bell", description: "Qué notificaciones recibes y cuándo." },
  { id: "appearance", label: "Apariencia", icon: "palette", description: "Tema y posición de notificaciones para este dispositivo." },
  { id: "security", label: "Seguridad", icon: "shield", description: "Protección de inicio de sesión y sesiones activas." },
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
  const icons = useIcons();
  const { user, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const isBranchUser = user?.role === 'branch';
  const visibleSections = SECTIONS.filter((s) => !(isBranchUser && (s.id === 'members' || s.id === 'security')));
  const [section, setSection] = useState(() => (isBranchUser && (defaultSection === 'members' || defaultSection === 'security') ? 'general' : defaultSection));
  const current = visibleSections.find((s) => s.id === section) ?? visibleSections[0];

  useEffect(() => {
    if (isBranchUser && (section === 'members' || section === 'security')) {
      setSection('general');
    }
  }, [isBranchUser, section]);

  const handleLogout = () => {
    onOpenChange?.(false);
    logout();
    navigate("/login");
  };

  const getInitials = () => {
    if (!user) return "??";
    if (user.role === 'branch' && user.branchName) {
      const branchName = user.branchName.replace(/^farmacia\s+/i, '');
      return `F${branchName.charAt(0).toUpperCase()}`;
    }
    const names = (user.name || "").split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return (user.name || "U").charAt(0).toUpperCase();
  };

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
                        icon={icons[s.icon]}
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
                        <div className="-ml-0.5 -mr-0.5 size-5 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold select-none">
                          {getInitials()}
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
    case "members":
      return <MembersPanel />;
    default:
      return <GeneralPanel />;
  }
}

function GeneralPanel() {
  const [name, setName] = useState("Farmaplus");
  const [language, setLanguage] = useState("es");
  const [timezone, setTimezone] = useState("utc-3");
  return (
    <>
      <InputGroup className="w-full">
        <InputField
          index={0}
          label="Nombre del espacio de trabajo"
          value={name}
          onChange={setName}
          placeholder="Farmaplus"
        />
      </InputGroup>
      <div className="flex flex-col">
        <SettingRow label="Idioma" description="Utilizado para la interfaz y correos.">
          <Select value={language} onValueChange={setLanguage}>
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
          <Select value={timezone} onValueChange={setTimezone}>
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
    </>
  );
}

function NotificationsPanel() {
  const [digest, setDigest] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [updates, setUpdates] = useState(false);
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

function AppearancePanel() {
  const icons = useIcons();
  const { themeMode, setThemeMode } = useTheme();
  const { preferences, setPosition } = useNotificationPreferences();
  const { tint, setTint, tints } = useTint();

  const handlePositionChange = (pos: NotificationPosition) => {
    setPosition(pos);
    notify.dismiss();
    setTimeout(() => {
      notify.info("Posición actualizada", `Avisos configurados en: ${POSITION_LABELS[pos]}`, { position: pos });
    }, 60);
  };

  return (
    <div className="flex flex-col">
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
      <SettingRow label="Tinte de color" description="Matiz de color sutil para toda la interfaz.">
        <Select value={tint} onValueChange={(v) => setTint(v as AppTint)}>
          <SelectTrigger placeholder="Tinte" />
          <SelectContent>
            {tints.map((t, idx) => (
              <SelectItem key={t.id} index={idx} value={t.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-xs"
                    style={{ backgroundColor: t.color }}
                  />
                  <span>{t.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

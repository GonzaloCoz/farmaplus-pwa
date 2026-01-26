
import { useState, useEffect } from "react";
import { Bell, Settings, User, ChevronRight, Moon, Sun, Trash2, BellRing, Check, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import { notificationService as pushNotificationService } from "@/services/PushNotificationService";
import { useNotifications } from "@/contexts/NotificationContext";

const DUMMY_SETTINGS: Array<{ id: string; title: string; value: string }> = [];

const DUMMY_USER = {
  name: "Gonzalo Coz",
  email: "ghcoz@farmaplus.com.ar",
  role: "Administrador",
};

export function MessagesMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-block relative">
        <button onClick={() => setOpen(true)} aria-label="Mensajes" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <DialogContent className="w-[420px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Mensajes</DialogTitle>
        </DialogHeader>
        <div className="p-8 text-center">
          <MessageSquare className="w-12 h-12 text-muted/20 mx-auto mb-4" />
          <p className="text-muted-foreground">No tienes mensajes nuevos en este momento.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (pushNotificationService.isSupported()) {
      setNotificationPermission(pushNotificationService.getPermissionStatus());
    }
  }, []);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    notify.success("Listo", "Todas las notificaciones marcadas como leídas");
  };

  const handleEnableNotifications = async () => {
    const permission = await pushNotificationService.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      notify.success("Notificaciones habilitadas", "Ahora recibirás alertas de eventos próximos");
      await pushNotificationService.showNotification({
        title: "¡Notificaciones activadas!",
        body: "Ahora recibirás alertas de eventos próximos",
      });
    } else {
      notify.error("Permiso denegado", "No se pudo habilitar las notificaciones");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-block relative">
        <button
          onClick={() => setOpen(true)}
          aria-label="Notificaciones"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 border border-border/40 hover:bg-muted/80 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-accent' : 'text-muted-foreground'}`} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background shadow-sm"
              role="status"
              aria-label={`${unreadCount} notificaciones nuevas`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>
      <DialogContent className="w-[420px] p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle>Notificaciones</DialogTitle>
            {notifications.length > 0 && unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <Check className="w-4 h-4 mr-2" />
                Marcar leídas
              </Button>
            )}
          </div>
        </DialogHeader>
        {notificationPermission !== 'granted' && pushNotificationService.isSupported() && (
          <div className="p-4 border-b bg-muted/30">
            <Button
              onClick={handleEnableNotifications}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <BellRing className="w-4 h-4 mr-2" />
              Habilitar notificaciones push
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Recibe alertas de eventos próximos incluso cerrado
            </p>
          </div>
        )}
        {notifications.length > 0 ? (
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <ul className="divide-y">
              {notifications.map(n => (
                <li key={n.id} className={`py-3 ${!n.is_read ? 'bg-accent/5 -mx-4 px-4' : ''}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">{n.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div className="h-2 w-2 rounded-full bg-accent mt-1 flex-shrink-0" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">No tienes notificaciones nuevas.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
      <DialogContent className="w-[420px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Configuración</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <ul className="divide-y">
            <li className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">Tema</div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="inline-block">
        <button
          onClick={() => setOpen(true)}
          aria-label="Usuario"
          className="group flex items-center justify-center h-10 w-10 rounded-xl overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all bg-muted/50 border border-border/40"
        >
          <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
            GC
          </div>
        </button>
      </div>
      <DialogContent className="w-[360px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Cuenta</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center font-bold">GC</div>
            <div>
              <div className="font-medium">{DUMMY_USER.name}</div>
              <div className="text-xs text-muted-foreground">{DUMMY_USER.email}</div>
            </div>
          </div>
          <div className="mt-4 divide-y">
            <div className="py-3">
              <button className="w-full text-left hover:text-primary transition-colors font-medium">Ver perfil</button>
            </div>
            <div className="py-3">
              <button className="w-full text-left hover:text-destructive transition-colors font-medium">Cerrar sesión</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

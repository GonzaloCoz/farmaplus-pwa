import { useState, useEffect } from "react";
import { Bell, Settings, User, ChevronRight, Moon, Sun, Trash2, BellRing } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseISO, differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import { notificationService } from "@/services/NotificationService";

const DUMMY_NOTIFICATIONS: Array<{ id: string; text: string; date: string }> = [];

const DUMMY_SETTINGS: Array<{ id: string; title: string; value: string }> = [];

const DUMMY_USER = {
  name: "Gonzalo Coz",
  email: "ghcoz@farmaplus.com.ar",
  role: "Administrador",
};

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Array<{ id: string; text: string; date: string }>>([]);
  const [nearCount, setNearCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check notification permission status
    if (notificationService.isSupported()) {
      setNotificationPermission(notificationService.getPermissionStatus());
    }

    // build notifications from localStorage events, excluding events that are within 2-5 days
    const stored = localStorage.getItem("inventory-events");
    const evs = stored ? JSON.parse(stored) : [];
    const today = new Date();
    const generated: Array<{ id: string; text: string; date: string }> = [];
    let near = 0;
    evs.forEach((e: any) => {
      try {
        const ed = parseISO(e.date);
        const diff = differenceInCalendarDays(ed, today);
        if (diff >= 2 && diff <= 5) {
          // count as near but DO NOT include in notifications list per request
          near += 1;
        } else {
          generated.push({ id: e.id || e.date, text: e.title, date: format(ed, 'd/M/yyyy') });
        }
      } catch (err) {
        // ignore parse errors
      }
    });

    // merge static notifications with generated ones (static keep shown)
    const merged = [
      ...DUMMY_NOTIFICATIONS.map(d => {
        try {
          const pd = parseISO(d.date);
          return { id: d.id, text: d.text, date: format(pd, 'd/M/yyyy') };
        } catch {
          return { id: d.id, text: d.text, date: d.date };
        }
      }),
      ...generated,
    ];
    setNotifs(merged);
    setNearCount(near);
  }, []);

  const handleClearNotifications = () => {
    setNotifs([]);
    setNearCount(0);
    setOpen(false);
    notify.success("Notificaciones limpiadas", "Todas las notificaciones fueron eliminadas");
  };

  const handleEnableNotifications = async () => {
    const permission = await notificationService.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      notify.success("Notificaciones habilitadas", "Ahora recibirás alertas de eventos próximos");
      // Mostrar notificación de prueba
      await notificationService.showNotification({
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
        <button onClick={() => setOpen(true)} aria-label="Notificaciones" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
          <Bell className={`w-4 h-4 ${nearCount > 0 ? 'text-accent' : 'text-muted-foreground'}`} />
          {nearCount > 0 && (
            <span
              className="absolute top-0 right-0 -mt-1 -mr-1 min-w-[18px] h-4 px-1.5 rounded-full bg-accent text-white text-xs font-medium flex items-center justify-center ring-1 ring-accent/60"
              role="status"
              aria-label={`${nearCount} eventos próximos`}
            >
              {nearCount}
            </span>
          )}
        </button>
      </div>
      <DialogContent className="w-[420px] p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle>Notificaciones</DialogTitle>
            {notifs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearNotifications}>
                <Trash2 className="w-4 h-4 mr-2" />
                Limpiar todo
              </Button>
            )}
          </div>
        </DialogHeader>
        {notificationPermission !== 'granted' && notificationService.isSupported() && (
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
              Recibe alertas de eventos próximos
            </p>
          </div>
        )}
        {notifs.length > 0 ? (
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <ul className="divide-y">
              {notifs.map(n => (
                <li key={n.id} className="py-3">
                  <div className="text-sm font-medium">{n.text}</div>
                  <div className="text-xs text-muted-foreground">{n.date}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">No tienes notificaciones nuevas.</p>
            {notificationPermission !== 'granted' && notificationService.isSupported() && (
              <Button onClick={handleEnableNotifications} variant="outline" size="sm">
                <BellRing className="w-4 h-4 mr-2" />
                Habilitar notificaciones push
              </Button>
            )}
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
        <button onClick={() => setOpen(true)} aria-label="Configuración" className="inline-flex h-12 w-12 items-center justify-center rounded-full">
          <Settings className="w-5 h-5 text-muted-foreground" />
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
            {DUMMY_SETTINGS.map(s => (
              <li key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.value}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </li>
            ))}
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
        <button onClick={() => setOpen(true)} aria-label="Usuario" className="inline-flex h-12 w-12 items-center justify-center rounded-full">
          <User className="w-6 h-6 text-muted-foreground" />
        </button>
      </div>
      <DialogContent className="w-[360px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Cuenta</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">ML</div>
            <div>
              <div className="font-medium">{DUMMY_USER.name}</div>
              <div className="text-xs text-muted-foreground">{DUMMY_USER.email}</div>
            </div>
          </div>
          <div className="mt-4 divide-y">
            <div className="py-3">
              <button className="w-full text-left">Ver perfil</button>
            </div>
            <div className="py-3">
              <button className="w-full text-left">Cerrar sesión</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

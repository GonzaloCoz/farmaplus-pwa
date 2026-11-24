import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TimeRange } from "@/components/ui/fluid-date-picker";

export type EventAudienceKey = "admin" | "zonal" | "branch";

export interface EventAudienceTargets {
  calendar: boolean;
  notify: boolean;
}

export type EventTargetsMap = Record<EventAudienceKey, EventAudienceTargets>;

export interface CalendarEventItem {
  id: string;
  title: string;
  /** Fecha local canónica en formato YYYY-MM-DD (libre de desfase UTC) */
  eventDate: string;
  timeRange: TimeRange | null;
  targets: EventTargetsMap;
  createdBy?: string | null;
  createdAt?: string;
}

export interface UpsertCalendarEventInput {
  title: string;
  eventDate: string;
  timeRange: TimeRange | null;
  targets: EventTargetsMap;
}

const FALLBACK_APP_VERSION_KEY = "__CALENDAR_EVENTS_V1__";
const LOCAL_CACHE_KEY = "farmaplus-calendar-events-cache";
const REALTIME_CHANNEL_NAME = "calendar_events_realtime_sync";

export function createDefaultTargets(): EventTargetsMap {
  return {
    admin: { calendar: true, notify: true },
    zonal: { calendar: true, notify: true },
    branch: { calendar: true, notify: true },
  };
}

export function normalizeTargets(raw: unknown): EventTargetsMap {
  const defaults = createDefaultTargets();
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Partial<Record<EventAudienceKey, Partial<EventAudienceTargets>>>;
  return {
    admin: {
      calendar: obj.admin?.calendar ?? defaults.admin.calendar,
      notify: obj.admin?.notify ?? defaults.admin.notify,
    },
    zonal: {
      calendar: obj.zonal?.calendar ?? defaults.zonal.calendar,
      notify: obj.zonal?.notify ?? defaults.zonal.notify,
    },
    branch: {
      calendar: obj.branch?.calendar ?? defaults.branch.calendar,
      notify: obj.branch?.notify ?? defaults.branch.notify,
    },
  };
}

/** Convierte un `Date` local a clave `YYYY-MM-DD` sin corrimiento de huso horario. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Convierte un `Date` local a clave mensual `YYYY-MM`. */
export function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Parsea una clave `YYYY-MM-DD` a `Date` en medianoche local. */
export function parseLocalDateKey(dateKey: string): Date {
  const clean = dateKey.slice(0, 10);
  const [y, m, d] = clean.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function formatEventSubtitle(
  eventDateKey: string,
  timeRange: TimeRange | null
): string {
  const parts: string[] = [];
  if (eventDateKey) {
    const parsed = parseLocalDateKey(eventDateKey);
    parts.push(
      new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
      }).format(parsed)
    );
  }
  if (timeRange?.start && timeRange?.end) {
    parts.push(`${timeRange.start} – ${timeRange.end}`);
  } else if (timeRange?.start) {
    parts.push(timeRange.start);
  }
  return parts.join(" · ");
}

/** Ordena eventos cronológicamente por fecha (`YYYY-MM-DD`), hora inicio, hora fin y título. */
export function sortCalendarEvents(list: CalendarEventItem[]): CalendarEventItem[] {
  return [...list].sort((a, b) => {
    const byDate = a.eventDate.localeCompare(b.eventDate);
    if (byDate !== 0) return byDate;
    const aStart = a.timeRange?.start ?? "99:99";
    const bStart = b.timeRange?.start ?? "99:99";
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    const aEnd = a.timeRange?.end ?? "99:99";
    const bEnd = b.timeRange?.end ?? "99:99";
    if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
    return a.title.localeCompare(b.title, "es");
  });
}

export function isEventVisibleToRole(
  event: CalendarEventItem,
  role?: "admin" | "mod" | "branch" | null,
  currentUserId?: string | null
): boolean {
  if (!role || role === "admin") return true;
  if (currentUserId && event.createdBy && event.createdBy === currentUserId) {
    return true;
  }
  if (role === "mod") return event.targets.zonal.calendar;
  if (role === "branch") return event.targets.branch.calendar;
  return true;
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || "";
  const msg = (error.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("calendar_events") && (msg.includes("not find") || msg.includes("does not exist"))
  );
}

function mapDbRow(row: {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  targets: Json;
  created_by: string | null;
  created_at: string;
}): CalendarEventItem {
  return {
    id: row.id,
    title: row.title,
    eventDate: row.event_date.slice(0, 10),
    timeRange:
      row.start_time && row.end_time
        ? { start: row.start_time, end: row.end_time }
        : null,
    targets: normalizeTargets(row.targets),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function readLocalCache(): CalendarEventItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortCalendarEvents(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalCache(events: CalendarEventItem[]): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(sortCalendarEvents(events)));
  } catch {
    // ignore storage quota errors
  }
}

async function readFallbackRemoteEvents(): Promise<CalendarEventItem[]> {
  try {
    const { data, error } = await supabase
      .from("app_versions")
      .select("release_notes")
      .eq("version", FALLBACK_APP_VERSION_KEY)
      .maybeSingle();
    if (!error && data?.release_notes) {
      const parsed = JSON.parse(data.release_notes);
      if (Array.isArray(parsed)) {
        const clean = sortCalendarEvents(
          parsed.map((item: CalendarEventItem) => ({
            ...item,
            targets: normalizeTargets(item.targets),
          }))
        );
        writeLocalCache(clean);
        return clean;
      }
    }
  } catch {
    // fallback to localStorage below
  }
  return readLocalCache();
}

async function writeFallbackRemoteEvents(events: CalendarEventItem[]): Promise<void> {
  const sorted = sortCalendarEvents(events);
  writeLocalCache(sorted);
  try {
    const serialized = JSON.stringify(sorted);
    const { data: existing } = await supabase
      .from("app_versions")
      .select("id")
      .eq("version", FALLBACK_APP_VERSION_KEY)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("app_versions")
        .update({
          release_notes: serialized,
          is_active: false,
          published_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("app_versions").insert({
        version: FALLBACK_APP_VERSION_KEY,
        release_notes: serialized,
        is_active: false,
        published_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("[calendarEventsService] Fallback persistence warning:", err);
  }
}

let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
const listeners = new Set<() => void>();

function ensureRealtimeChannel() {
  if (sharedChannel) return sharedChannel;
  sharedChannel = supabase
    .channel(REALTIME_CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "calendar_events_changed" }, () => {
      listeners.forEach((fn) => fn());
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "calendar_events" },
      () => {
        listeners.forEach((fn) => fn());
      }
    )
    .subscribe();
  return sharedChannel;
}

function notifyLocalListeners() {
  listeners.forEach((fn) => fn());
}

async function broadcastChange() {
  notifyLocalListeners();
  try {
    const ch = ensureRealtimeChannel();
    await ch.send({
      type: "broadcast",
      event: "calendar_events_changed",
      payload: { at: Date.now() },
    });
  } catch {
    // ignore broadcast transient issues
  }
}

async function cleanupEventNotifications(eventId: string): Promise<void> {
  try {
    const { error: rpcError } = await supabase.rpc(
      "delete_calendar_event_notifications",
      { p_event_id: eventId }
    );
    if (!rpcError) return;
  } catch {
    // fallback below if RPC is not deployed yet
  }

  try {
    const { data: matching } = await supabase
      .from("notifications")
      .select("id, metadata")
      .eq("category", "CALENDARIO")
      .contains("metadata", { event_id: eventId });

    if (matching && matching.length > 0) {
      const ids = matching.map((row) => row.id);
      await supabase.from("notifications").delete().in("id", ids);
      // Fallback por si la política DELETE aún no fue ejecutada en Supabase Studio
      await Promise.all(
        matching.map((row) => {
          const prevMeta =
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : {};
          return supabase
            .from("notifications")
            .update({
              is_read: true,
              metadata: { ...prevMeta, event_deleted: true } as Json,
            })
            .eq("id", row.id);
        })
      );
    }
  } catch (err) {
    console.warn("[calendarEventsService] Cleanup notifications warning:", err);
  }
}

async function dispatchEventNotifications(
  event: CalendarEventItem,
  notifyMask: { admin: boolean; zonal: boolean; branch: boolean }
): Promise<void> {
  if (!notifyMask.admin && !notifyMask.zonal && !notifyMask.branch) return;

  const subtitle = formatEventSubtitle(event.eventDate, event.timeRange);
  const notifTitle = `📅 Evento programado: ${event.title}`;
  const notifMessage = subtitle
    ? `${event.title} · ${subtitle}`
    : event.title;

  const { error: rpcError } = await supabase.rpc("notify_calendar_event", {
    p_event_id: event.id,
    p_title: notifTitle,
    p_message: notifMessage,
    p_notify_admin: notifyMask.admin,
    p_notify_zonal: notifyMask.zonal,
    p_notify_branch: notifyMask.branch,
  });

  if (!rpcError) return;

  // Fallback directo a `profiles` -> `notifications` si aún no se ejecutó la RPC nueva
  try {
    const targetRoles: string[] = [];
    if (notifyMask.admin) targetRoles.push("admin");
    if (notifyMask.zonal) targetRoles.push("mod");
    if (notifyMask.branch) targetRoles.push("branch");

    const { data: recipients } = await supabase
      .from("profiles")
      .select("id")
      .in("role", targetRoles)
      .neq("active", false);

    if (recipients && recipients.length > 0) {
      await supabase.from("notifications").insert(
        recipients.map((r) => ({
          user_id: r.id,
          type: "info",
          category: "CALENDARIO",
          title: notifTitle,
          message: notifMessage,
          is_read: false,
          metadata: { event_id: event.id, source: "calendar_events" } as Json,
        }))
      );
    }
  } catch (err) {
    console.warn("[calendarEventsService] Notification dispatch warning:", err);
  }
}

export const calendarEventsService = {
  getCached(): CalendarEventItem[] {
    return readLocalCache();
  },

  async list(): Promise<CalendarEventItem[]> {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        return readFallbackRemoteEvents();
      }
      throw error;
    }

    const mapped = sortCalendarEvents((data ?? []).map(mapDbRow));
    writeLocalCache(mapped);
    return mapped;
  },

  async create(
    input: UpsertCalendarEventInput,
    userId?: string | null
  ): Promise<CalendarEventItem> {
    const payload = {
      title: input.title.trim(),
      event_date: input.eventDate,
      start_time: input.timeRange?.start ?? null,
      end_time: input.timeRange?.end ?? null,
      targets: input.targets as unknown as Json,
      created_by: userId ?? null,
    };

    const { data, error } = await supabase
      .from("calendar_events")
      .insert(payload)
      .select("*")
      .single();

    let created: CalendarEventItem;
    if (error) {
      if (!isMissingTableError(error)) throw error;
      created = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now()),
        title: payload.title,
        eventDate: input.eventDate,
        timeRange: input.timeRange,
        targets: input.targets,
        createdBy: userId ?? null,
        createdAt: new Date().toISOString(),
      };
      const existing = await readFallbackRemoteEvents();
      await writeFallbackRemoteEvents([...existing, created]);
    } else {
      created = mapDbRow(data);
      const cached = readLocalCache().filter((e) => e.id !== created.id);
      writeLocalCache([...cached, created]);
    }

    await Promise.all([
      broadcastChange(),
      dispatchEventNotifications(created, {
        admin: input.targets.admin.notify,
        zonal: input.targets.zonal.notify,
        branch: input.targets.branch.notify,
      }),
    ]);

    return created;
  },

  async update(
    id: string,
    input: UpsertCalendarEventInput,
    previousTargets?: EventTargetsMap
  ): Promise<CalendarEventItem> {
    const payload = {
      title: input.title.trim(),
      event_date: input.eventDate,
      start_time: input.timeRange?.start ?? null,
      end_time: input.timeRange?.end ?? null,
      targets: input.targets as unknown as Json,
    };

    const { data, error } = await supabase
      .from("calendar_events")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    let updated: CalendarEventItem;
    if (error) {
      if (!isMissingTableError(error)) throw error;
      const existing = await readFallbackRemoteEvents();
      const prevItem = existing.find((e) => e.id === id);
      updated = {
        id,
        title: payload.title,
        eventDate: input.eventDate,
        timeRange: input.timeRange,
        targets: input.targets,
        createdBy: prevItem?.createdBy ?? null,
        createdAt: prevItem?.createdAt ?? new Date().toISOString(),
      };
      await writeFallbackRemoteEvents(
        existing.map((e) => (e.id === id ? updated : e))
      );
    } else {
      updated = mapDbRow(data);
      const cached = readLocalCache().map((e) => (e.id === id ? updated : e));
      writeLocalCache(cached);
    }

    // Notificar solo si se activó algún grupo nuevo que antes estaba apagado
    const newlyNotified = {
      admin:
        input.targets.admin.notify && !(previousTargets?.admin.notify ?? true),
      zonal:
        input.targets.zonal.notify && !(previousTargets?.zonal.notify ?? true),
      branch:
        input.targets.branch.notify && !(previousTargets?.branch.notify ?? true),
    };

    await Promise.all([
      broadcastChange(),
      dispatchEventNotifications(updated, newlyNotified),
    ]);

    return updated;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);

    if (error) {
      if (!isMissingTableError(error)) throw error;
      const existing = await readFallbackRemoteEvents();
      await writeFallbackRemoteEvents(existing.filter((e) => e.id !== id));
    } else {
      writeLocalCache(readLocalCache().filter((e) => e.id !== id));
    }

    await Promise.all([cleanupEventNotifications(id), broadcastChange()]);
  },

  subscribe(onChange: () => void): () => void {
    ensureRealtimeChannel();
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0 && sharedChannel) {
        supabase.removeChannel(sharedChannel);
        sharedChannel = null;
      }
    };
  },
};


import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/fluid-calendar";
import {
  DatePicker,
  parseTime,
  type TimeRange,
} from "@/components/ui/fluid-date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/fluid-field";
import { Input } from "@/components/ui/fluid-input";
import { FluidCheckbox } from "@/components/ui/fluid-checkbox";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { FluidHoverHighlight } from "@/components/ui/fluid-hover-highlight";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@/hooks/use-fluid-hover";
import {
  Card,
  CardGroup,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/fluid-card";
import {
  CardHeader as WidgetHeader,
  CardTitle as WidgetTitle,
} from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";
import {
  calendarEventsService,
  createDefaultTargets,
  formatEventSubtitle,
  isEventVisibleToRole,
  parseLocalDateKey,
  sortCalendarEvents,
  toLocalDateKey,
  toMonthKey,
  type CalendarEventItem,
  type EventAudienceKey,
  type EventAudienceTargets,
  type EventTargetsMap,
} from "@/services/calendarEventsService";
import { useIcons } from "@/lib/icon-context";
import { fontWeights } from "@/lib/font-weight";
import { useShape } from "@/lib/shape-context";
import { useSize } from "@/lib/size-context";
import { cn } from "@/lib/utils";

export type {
  CalendarEventItem,
  EventAudienceKey,
  EventAudienceTargets,
};

const AUDIENCE_OPTIONS: Array<{ key: EventAudienceKey; label: string }> = [
  { key: "admin", label: "Usuarios administradores" },
  { key: "zonal", label: "Usuarios zonales" },
  { key: "branch", label: "Usuarios sucursales" },
];

const DEFAULT_TIME_RANGE: TimeRange = { start: "11:00", end: "12:45" };

interface AudienceRowProps {
  index: number;
  label: string;
  targets: EventAudienceTargets;
  registerItem: (index: number, element: HTMLElement | null) => void;
  isActive: boolean;
  onChangeCalendar: (checked: boolean) => void;
  onChangeNotify: (checked: boolean) => void;
  onToggleRow: () => void;
}

function AudienceRow({
  index,
  label,
  targets,
  registerItem,
  isActive,
  onChangeCalendar,
  onChangeNotify,
  onToggleRow,
}: AudienceRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const shape = useShape();
  const sizeClasses = useSize();

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  const anyChecked = targets.calendar || targets.notify;

  return (
    <div
      ref={rowRef}
      data-slot="field"
      className={cn(
        "group/field relative z-10 flex min-h-9 items-center justify-between gap-4 px-2 select-none",
        shape.item
      )}
    >
      <button
        type="button"
        onClick={onToggleRow}
        className={cn(
          "min-w-0 flex-1 cursor-pointer truncate text-left outline-none transition-colors duration-80",
          sizeClasses.type.body,
          anyChecked || isActive ? "text-foreground" : "text-muted-foreground"
        )}
        style={{ fontVariationSettings: fontWeights.normal }}
      >
        {label}
      </button>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex w-8 items-center justify-center">
          <FluidCheckbox
            checked={targets.calendar}
            onToggle={() => onChangeCalendar(!targets.calendar)}
            aria-label={`${label}: aparecer en calendario`}
          />
        </div>
        <div className="flex w-8 items-center justify-center">
          <FluidCheckbox
            checked={targets.notify}
            onToggle={() => onChangeNotify(!targets.notify)}
            aria-label={`${label}: enviar notificación`}
          />
        </div>
      </div>
    </div>
  );
}

export function UpcomingInventoriesWidget() {
  const { user } = useUser();
  const icons = useIcons();
  const PlusIcon = icons.plus;
  const CalendarIcon = icons.calendar;
  const BellIcon = icons.bell;
  const shape = useShape();

  const canManageEvents =
    !user || user.role === "admin" || user.role === "mod";

  // Sin día seleccionado por defecto: muestra todos los eventos del mes visible
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [events, setEvents] = useState<CalendarEventItem[]>(() =>
    calendarEventsService.getCached()
  );
  const [isSaving, setIsSaving] = useState(false);

  // Estado del Dialog "Nuevo evento" / "Editar evento"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(
    null
  );
  const [eventName, setEventName] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<TimeRange | null>(DEFAULT_TIME_RANGE);
  const [targets, setTargets] = useState<EventTargetsMap>(createDefaultTargets);
  const [nameError, setNameError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [audienceError, setAudienceError] = useState("");

  // Estado del Dialog "Eliminar evento" (size="sm")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEventItem | null>(
    null
  );

  const loadEvents = useCallback(async () => {
    try {
      const list = await calendarEventsService.list();
      setEvents(list);
    } catch (err) {
      console.error("[UpcomingInventoriesWidget] Error loading events:", err);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    const unsubscribe = calendarEventsService.subscribe(() => {
      void loadEvents();
    });
    return unsubscribe;
  }, [loadEvents]);

  // Eventos visibles según rol, siempre ordenados cronológicamente
  const visibleEvents = useMemo(
    () =>
      sortCalendarEvents(
        events.filter((ev) =>
          isEventVisibleToRole(ev, user?.role, user?.id)
        )
      ),
    [events, user?.role, user?.id]
  );

  // Días con eventos para marcar en el calendario (excluye hoy porque Fluid ya dibuja el punto de hoy)
  const eventDatesForIndicator = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const uniqueKeys = new Set<string>();
    for (const ev of visibleEvents) {
      if (ev.eventDate && ev.eventDate !== todayKey) {
        uniqueKeys.add(ev.eventDate);
      }
    }
    return Array.from(uniqueKeys, parseLocalDateKey);
  }, [visibleEvents]);

  // Lista filtrada por día seleccionado o por el mes visible en el calendario
  const displayedEvents = useMemo(() => {
    if (selectedDate) {
      const dayKey = toLocalDateKey(selectedDate);
      return visibleEvents.filter((ev) => ev.eventDate === dayKey);
    }
    const monthPrefix = toMonthKey(currentMonth);
    return visibleEvents.filter((ev) => ev.eventDate.startsWith(monthPrefix));
  }, [visibleEvents, selectedDate, currentMonth]);

  const isCurrentRealMonth = useMemo(
    () => toMonthKey(currentMonth) === toMonthKey(new Date()),
    [currentMonth]
  );

  const selectedDayLabel = useMemo(() => {
    if (!selectedDate) return "";
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
    }).format(selectedDate);
  }, [selectedDate]);

  const audienceContainerRef = useRef<HTMLDivElement>(null);
  const audienceHover = useFluidHover(audienceContainerRef);

  const hasAnyTargetSelected = useMemo(
    () =>
      AUDIENCE_OPTIONS.some(
        ({ key }) => targets[key].calendar || targets[key].notify
      ),
    [targets]
  );

  const resetForm = () => {
    setEditingEvent(null);
    setEventName("");
    setTime(DEFAULT_TIME_RANGE);
    setTargets(createDefaultTargets());
    setNameError("");
    setTimeError("");
    setAudienceError("");
  };

  const getDefaultPickerDate = () => {
    if (selectedDate) return selectedDate;
    const now = new Date();
    if (toMonthKey(currentMonth) === toMonthKey(now)) return now;
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !editingEvent) {
      setDate(getDefaultPickerDate());
      setNameError("");
      setTimeError("");
      setAudienceError("");
    }
    if (!nextOpen) {
      resetForm();
    }
    setDialogOpen(nextOpen);
  };

  const openEditDialog = (item: CalendarEventItem) => {
    if (!canManageEvents) return;
    setEditingEvent(item);
    setEventName(item.title);
    setDate(parseLocalDateKey(item.eventDate));
    setTime(item.timeRange ?? DEFAULT_TIME_RANGE);
    setTargets({
      admin: { ...item.targets.admin },
      zonal: { ...item.targets.zonal },
      branch: { ...item.targets.branch },
    });
    setNameError("");
    setTimeError("");
    setAudienceError("");
    setDialogOpen(true);
  };

  const openDeleteDialog = (item: CalendarEventItem) => {
    setEventToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    const target = eventToDelete;
    const previous = events;
    setEvents((prev) => prev.filter((ev) => ev.id !== target.id));
    setDeleteDialogOpen(false);
    setEventToDelete(null);

    try {
      await calendarEventsService.remove(target.id);
    } catch (err) {
      console.error("[UpcomingInventoriesWidget] Error deleting event:", err);
      setEvents(previous);
      notify.error("Error", "No se pudo eliminar el evento.");
    }
  };

  const handleConfirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmed = eventName.trim();
    if (!trimmed) {
      setNameError("Ingresa un nombre para el evento.");
      return;
    }

    if (time?.start && time?.end) {
      const startMins = parseTime(time.start);
      const endMins = parseTime(time.end);
      if (startMins !== null && endMins !== null && endMins <= startMins) {
        setTimeError("La hora de fin debe ser posterior a la de inicio.");
        return;
      }
    }

    if (!hasAnyTargetSelected) {
      setAudienceError("Selecciona al menos un grupo de usuarios.");
      return;
    }

    const chosenDate = date ?? getDefaultPickerDate();
    const eventDateKey = toLocalDateKey(chosenDate);

    setIsSaving(true);
    try {
      if (editingEvent) {
        const updated = await calendarEventsService.update(
          editingEvent.id,
          {
            title: trimmed,
            eventDate: eventDateKey,
            timeRange: time,
            targets,
          },
          editingEvent.targets
        );
        setEvents((prev) =>
          sortCalendarEvents(
            prev.map((ev) => (ev.id === updated.id ? updated : ev))
          )
        );
      } else {
        const created = await calendarEventsService.create(
          {
            title: trimmed,
            eventDate: eventDateKey,
            timeRange: time,
            targets,
          },
          user?.id
        );
        setEvents((prev) =>
          sortCalendarEvents([
            ...prev.filter((ev) => ev.id !== created.id),
            created,
          ])
        );
      }

      // Ubicar el calendario en el mes del evento sin bloquear la selección a un único día
      setCurrentMonth(
        new Date(chosenDate.getFullYear(), chosenDate.getMonth(), 1)
      );
      setSelectedDate(undefined);
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      console.error("[UpcomingInventoriesWidget] Error saving event:", err);
      notify.error("Error", "No se pudo guardar el evento en Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex items-stretch overflow-hidden">
      {/* Panel izquierdo: Calendario */}
      <div className="shrink-0 h-full flex flex-col border-e border-border/60">
        <WidgetHeader className="px-5 pt-5 pb-2 flex flex-row items-center justify-between space-y-0 text-foreground">
          <WidgetTitle className="text-lg font-medium tracking-tight leading-7">
            Calendario
          </WidgetTitle>

          <div className="flex items-center gap-1">
            {!isCurrentRealMonth && (
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(undefined);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Hoy
              </Button>
            )}

            {canManageEvents && (
              <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-compact"
                      aria-label="Agregar evento"
                      onClick={() => setEditingEvent(null)}
                    >
                      <PlusIcon
                        strokeWidth={1.75}
                        className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
                      />
                    </Button>
                  }
                />

                <DialogContent size="lg">
                  <form onSubmit={handleConfirm} className="flex flex-col">
                    <DialogHeader className="mb-0 pb-4 pr-8 border-b border-border/60">
                      <DialogTitle
                        style={{ fontVariationSettings: fontWeights.normal }}
                      >
                        {editingEvent ? "Editar evento" : "Nuevo evento"}
                      </DialogTitle>
                      <DialogDescription>
                        Programa un evento en el calendario y elige quiénes lo
                        verán y recibirán notificación.
                      </DialogDescription>
                    </DialogHeader>

                    {/* 1. Nombre del evento — Input With Field */}
                    <div className="py-4 border-b border-border/60">
                      <Field data-invalid={nameError ? true : undefined}>
                        <FieldLabel
                          htmlFor="calendar-event-name"
                          className="text-foreground"
                        >
                          Nombre del evento
                        </FieldLabel>
                        <Input
                          id="calendar-event-name"
                          value={eventName}
                          onChange={(e) => {
                            setEventName(e.target.value);
                            if (nameError) setNameError("");
                          }}
                          placeholder="Ej. Inventario general de sucursal"
                          aria-invalid={nameError ? true : undefined}
                        />
                        {nameError ? (
                          <FieldError>{nameError}</FieldError>
                        ) : (
                          <FieldDescription>
                            Visible en el calendario y en el aviso enviado a los
                            usuarios seleccionados.
                          </FieldDescription>
                        )}
                      </Field>
                    </div>

                    {/* 2. Fecha y horario — DatePicker (date + timeRange) */}
                    <div className="py-4 border-b border-border/60">
                      <Field data-invalid={timeError ? true : undefined}>
                        <FieldTitle>Fecha y horario</FieldTitle>
                        <div className="w-full">
                          <DatePicker
                            variant="ghost"
                            value={date}
                            onValueChange={setDate}
                            timeRange={time}
                            onTimeRangeChange={(nextRange) => {
                              setTime(nextRange);
                              if (timeError) setTimeError("");
                            }}
                            className="-ml-2"
                          />
                        </div>
                        {timeError ? (
                          <FieldError>{timeError}</FieldError>
                        ) : (
                          <FieldDescription>
                            Selecciona el día y el rango horario en el que se
                            llevará a cabo.
                          </FieldDescription>
                        )}
                      </Field>
                    </div>

                    {/* 3. Destinatarios — Checkboxes (Calendario + Envío) */}
                    <div className="py-4 border-b border-border/60">
                      <TooltipProvider>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <FieldTitle>Visibilidad y envío</FieldTitle>
                            <FieldDescription>
                              Define a quiénes les aparecerá en el calendario y
                              se enviará notificación.
                            </FieldDescription>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 pt-0.5 text-muted-foreground">
                            <Tooltip
                              content="Aparece en el calendario"
                              contentClassName="z-[60]"
                            >
                              <div
                                className="flex w-8 h-7 items-center justify-center"
                                aria-hidden="true"
                              >
                                <CalendarIcon size={15} strokeWidth={1.75} />
                              </div>
                            </Tooltip>
                            <Tooltip
                              content="Enviar notificación"
                              contentClassName="z-[60]"
                            >
                              <div
                                className="flex w-8 h-7 items-center justify-center"
                                aria-hidden="true"
                              >
                                <BellIcon size={15} strokeWidth={1.75} />
                              </div>
                            </Tooltip>
                          </div>
                        </div>

                        <div
                          ref={audienceContainerRef}
                          onMouseEnter={audienceHover.handlers.onMouseEnter}
                          onMouseMove={audienceHover.handlers.onMouseMove}
                          onMouseLeave={audienceHover.handlers.onMouseLeave}
                          role="group"
                          aria-label="Destinatarios del evento"
                          className="relative -mx-2 flex flex-col"
                        >
                          <FluidHoverHighlight
                            hover={audienceHover}
                            className={shape.bg}
                          />
                          {AUDIENCE_OPTIONS.map((option, idx) => {
                            const rowTargets = targets[option.key];
                            return (
                              <AudienceRow
                                key={option.key}
                                index={idx}
                                label={option.label}
                                targets={rowTargets}
                                registerItem={audienceHover.registerItem}
                                isActive={audienceHover.activeIndex === idx}
                                onChangeCalendar={(checked) => {
                                  setTargets((prev) => ({
                                    ...prev,
                                    [option.key]: {
                                      ...prev[option.key],
                                      calendar: checked,
                                    },
                                  }));
                                  if (audienceError) setAudienceError("");
                                }}
                                onChangeNotify={(checked) => {
                                  setTargets((prev) => ({
                                    ...prev,
                                    [option.key]: {
                                      ...prev[option.key],
                                      notify: checked,
                                    },
                                  }));
                                  if (audienceError) setAudienceError("");
                                }}
                                onToggleRow={() => {
                                  const bothOn =
                                    rowTargets.calendar && rowTargets.notify;
                                  const nextVal = !bothOn;
                                  setTargets((prev) => ({
                                    ...prev,
                                    [option.key]: {
                                      calendar: nextVal,
                                      notify: nextVal,
                                    },
                                  }));
                                  if (audienceError && nextVal) {
                                    setAudienceError("");
                                  }
                                }}
                              />
                            );
                          })}
                        </div>
                      </TooltipProvider>

                      {audienceError && (
                        <FieldError className="mt-2">{audienceError}</FieldError>
                      )}
                    </div>

                    {/* 4. Acciones inferiores — Cancelar y Confirmar/Guardar */}
                    <DialogFooter className="mt-0 pt-4">
                      <DialogClose
                        render={
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isSaving}
                          >
                            Cancelar
                          </Button>
                        }
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isSaving}
                      >
                        {editingEvent ? "Guardar" : "Confirmar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </WidgetHeader>

        <div className="flex-1 flex items-start px-3 pt-5 pb-3">
          <Calendar
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={(nextMonth) => {
              setCurrentMonth(nextMonth);
              setSelectedDate(undefined);
            }}
            modifiers={{ hasEvent: eventDatesForIndicator }}
            modifiersClassNames={{
              hasEvent:
                "after:pointer-events-none after:absolute after:bottom-[14%] after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-muted-foreground/75 data-[selected]:after:bg-background",
            }}
            className="p-0"
          />
        </div>
      </div>

      {/* Panel derecho: Lista de eventos del mes (o del día si se seleccionó uno) */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        <WidgetHeader className="px-5 pt-5 pb-2 flex flex-row items-center justify-between gap-2 space-y-0 text-foreground">
          <WidgetTitle className="text-lg font-medium tracking-tight leading-7 truncate">
            Eventos
          </WidgetTitle>

          {selectedDate && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => setSelectedDate(undefined)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {selectedDayLabel} · Ver mes
            </Button>
          )}
        </WidgetHeader>

        <div className="flex-1 min-w-0 px-2 pt-1 pb-4 overflow-y-auto no-scrollbar">
          {displayedEvents.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground px-3">
              <p className="text-sm">
                {selectedDate
                  ? "Sin eventos este día"
                  : "Sin eventos en este mes"}
              </p>
            </div>
          ) : (
            <CardGroup orientation="inline" className="w-full">
              {displayedEvents.map((item) => (
                <Card
                  key={item.id}
                  size="compact"
                  label={
                    canManageEvents ? `Editar evento ${item.title}` : undefined
                  }
                  onClick={
                    canManageEvents ? () => openEditDialog(item) : undefined
                  }
                >
                  <CardHeader>
                    <CardTitle className="truncate">{item.title}</CardTitle>
                    <CardDescription className="truncate">
                      {formatEventSubtitle(item.eventDate, item.timeRange)}
                    </CardDescription>
                  </CardHeader>
                  {canManageEvents && (
                    <CardFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-compact"
                        aria-label={`Eliminar evento ${item.title}`}
                        onClick={() => openDeleteDialog(item)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2
                          strokeWidth={1.75}
                          className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
                        />
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </CardGroup>
          )}
        </div>
      </div>

      {/* Confirmación de eliminación de evento — Dialog size="sm" */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader className="pr-8">
            <DialogTitle style={{ fontVariationSettings: fontWeights.normal }}>
              Eliminar evento
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar{" "}
              <span className="text-foreground">
                «{eventToDelete?.title ?? "este evento"}»
              </span>
              ? Esta acción quitará el evento del calendario.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React from "react";
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay, parseISO, differenceInCalendarDays } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

type EventItem = { id: string; title: string; branch: string; sector: string; date: string };

export default function CustomCalendar({
  events = [],
  selected,
  onSelect,
  className,
}: {
  events?: EventItem[];
  selected?: Date | undefined;
  onSelect?: (d: Date) => void;
  className?: string; // Add className
}) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(selected || new Date());

  React.useEffect(() => {
    if (selected) setCurrentMonth(selected);
  }, [selected]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: es, weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { locale: es, weekStartsOn: 1 });

  const rows: Date[][] = [];
  let day = startDate;
  while (day <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, EventItem[]>();
    events.forEach(e => {
      const key = e.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  const today = new Date();


  const handlePrev = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNext = () => setCurrentMonth(prev => addMonths(prev, 1));

  const dayButtonSize = "h-10 w-10"; // similar to sidebar icon sizes

  return (
    <div className={`w-full ${className || ''}`}>
      <div className="flex items-center justify-between px-2 pb-2">
        <button onClick={handlePrev} className="p-1 rounded hover:bg-muted/50">
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="text-sm font-semibold">{format(monthStart, "LLLL yyyy", { locale: es })}</div>
        <button onClick={handleNext} className="p-1 rounded hover:bg-muted/50">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 text-xs text-muted-foreground mb-1">
        {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map((lab, i) => (
          <div key={i} className="flex items-center justify-center">
            <div className="h-10 w-10 flex items-center justify-center font-medium uppercase">{lab}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {rows.map((week, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {week.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const isCurrent = isSameMonth(d, monthStart);
              const eventsOnDay = eventsByDate.get(iso) || [];
              const hasEvents = eventsOnDay.length > 0;
              const selectedDay = selected ? isSameDay(d, selected) : false;
              // determine if any event is near (2-5 days from today)
              const isNear = eventsOnDay.some(e => {
                const ed = parseISO(e.date);
                const diff = differenceInCalendarDays(ed, today);
                return diff >= 2 && diff <= 5;
              });

              const outerClasses = selectedDay
                ? 'bg-primary text-primary-foreground'
                : isNear
                  ? 'hover:bg-primary/10 ring-2 ring-accent'
                  : 'hover:bg-primary/10';

              const dayButton = (
                <button
                  key={iso}
                  onClick={() => onSelect && onSelect(d)}
                  className={`flex items-center justify-center ${dayButtonSize} rounded-full transition-colors focus:outline-none ${isCurrent ? 'text-foreground' : 'text-muted-foreground'} ${outerClasses}`}
                >
                  <div className="relative flex items-center justify-center w-full h-full">
                    <span className="text-sm font-medium">{format(d, 'd', { locale: es })}</span>
                    {hasEvents && (
                      <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              );

              if (hasEvents) {
                const content = (
                  <div className="space-y-1">
                    {eventsOnDay.slice(0, 5).map((ev) => (
                      <div key={ev.id} className="text-xs">
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-muted-foreground">{ev.branch} · {ev.sector}</div>
                      </div>
                    ))}
                    {eventsOnDay.length > 5 && <div className="text-xs text-muted-foreground">+{eventsOnDay.length - 5} más</div>}
                  </div>
                );

                return (
                  <Tooltip key={iso}>
                    <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
                    <TooltipContent side="top">{content}</TooltipContent>
                  </Tooltip>
                );
              }

              return dayButton;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

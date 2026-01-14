import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { CalendarClock, Plus, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { hasPermission } from '@/config/permissions';
import { calendarService } from '@/services/calendarService';
import { AddEventDialog } from '@/components/AddEventDialog';
import { cn } from "@/lib/utils";

interface UpcomingInventory {
    id: string;
    branch: string;
    sector: string;
    date: string;
    formattedDate: string;
}

interface Props {
    onDateClick?: (dateIso: string) => void;
}

export function UpcomingInventoriesWidget({ onDateClick }: Props) {
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';
    const [inventories, setInventories] = useState<UpcomingInventory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);

    // Week State
    const [currentDate] = useState(new Date());
    const [weekDays, setWeekDays] = useState<{ day: string, date: number, iso: string, hasEvent: boolean, isToday: boolean }[]>([]);

    useEffect(() => {
        loadData();
    }, [user?.branchName]);

    const loadData = async () => {
        try {
            const events = await calendarService.getEvents(user?.branchName, isAdmin);
            const todayStr = new Date().toISOString().slice(0, 10);

            // Upcoming list (Next 3)
            const upcoming = events
                .filter((e: any) => e.date >= todayStr)
                .sort((a: any, b: any) => a.date.localeCompare(b.date))
                .slice(0, 3) // Less items to fit new design
                .map((e: any) => ({
                    id: e.id,
                    branch: e.branch_name || e.branchId,
                    sector: e.sector || e.description,
                    date: e.date,
                    formattedDate: new Date(e.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })
                }));

            setInventories(upcoming);

            // Generate Week Strip
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Start Monday. Adjust if needed.

            const days = [];
            const weekLetters = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // ES naming or EN? User image shows S M T W T F S
            // Let's use user image style S M T W T F S (EN) or ES? User speaks spanish. L M M J V S D usually.
            // Reference image has 'S M T W...' (EN). But app is ES.
            // Let's stick to ES initials: D L M M J V S
            const esLetters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

            // We generate 7 days starting from Sunday or Monday? 
            // Javascript getDay() 0=Sunday.
            // Let's create a view of [Sun, Mon, Tue, Wed, Thu, Fri, Sat] to match standard calendar view
            const layoutStart = new Date(currentDate);
            layoutStart.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday start

            for (let i = 0; i < 7; i++) {
                const d = new Date(layoutStart);
                d.setDate(layoutStart.getDate() + i);
                const iso = d.toISOString().slice(0, 10);
                const isToday = iso === todayStr;
                // Check if ANY event exists on this day (past or future)
                const hasEvent = events.some((e: any) => e.date === iso);

                days.push({
                    day: esLetters[i], // D, L, M ...
                    date: d.getDate(),
                    iso,
                    hasEvent,
                    isToday
                });
            }
            setWeekDays(days);

        } catch (error) {
            console.error("Error loading upcoming inventories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="p-0 h-full flex flex-col relative overflow-hidden bg-card">
            {/* Header Section with Date & Actions */}
            <div className="p-5 pb-2 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-foreground">
                        {currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <div className="flex gap-1">
                    {hasPermission(user, 'MANAGE_CALENDAR_EVENTS') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setShowAddDialog(true)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Week Strip */}
            <div className="px-5 py-2 flex justify-between items-center mb-2">
                {weekDays.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => onDateClick?.(d.iso)}>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            {d.day}
                        </span>
                        <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                            d.isToday ? "bg-primary text-primary-foreground shadow-md" : "text-foreground group-hover:bg-muted"
                        )}>
                            {d.date}
                        </div>
                        {/* Dot indicator */}
                        <div className={cn(
                            "h-1.5 w-1.5 rounded-full transition-colors",
                            d.hasEvent ? "bg-orange-500" : "bg-transparent"
                        )} />
                    </div>
                ))}
            </div>

            {/* Event List */}
            <div className="flex-1 bg-muted/30 p-4 space-y-3 rounded-t-3xl mt-1">
                {isLoading ? (
                    <div className="space-y-3 pt-2">
                        <div className="h-14 bg-muted animate-pulse rounded-2xl" />
                        <div className="h-14 bg-muted animate-pulse rounded-2xl" />
                    </div>
                ) : inventories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <p className="text-sm">Sin eventos próximos</p>
                    </div>
                ) : (
                    inventories.map((inv) => (
                        <div
                            key={inv.id}
                            className="flex items-center gap-3 p-3 bg-card rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-all group"
                            onClick={() => onDateClick?.(inv.date)}
                        >
                            {/* Avatar / Icon Placeholder */}
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                                <CalendarClock className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold truncate text-foreground">{inv.branch}</h4>
                                <p className="text-xs text-muted-foreground truncate">{inv.sector} • {inv.formattedDate}</p>
                            </div>

                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </div>
                    ))
                )}
            </div>

            <AddEventDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onEventAdded={() => loadData()}
            />
        </Card>
    );
}

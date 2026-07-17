
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WidgetSkeletonProps {
    variant?: 'default' | 'analyst' | 'progress' | 'table' | 'calendar';
}

export function WidgetSkeleton({ variant = 'default' }: WidgetSkeletonProps) {
    if (variant === 'analyst') {
        return (
            <div className="h-full flex flex-col p-4 border rounded-xl bg-card">
                <div className="flex justify-between items-start mb-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-4 w-full" />
                </div>
            </div>
        );
    }

    if (variant === 'progress') {
        return (
            <div className="h-full flex flex-col p-5 border rounded-xl bg-card gap-3">
                <div className="flex justify-between items-center mb-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                <div className="flex flex-col gap-1 mt-1">
                    <Skeleton className="h-10 w-24" /> {/* Big percentage */}
                    <Skeleton className="h-4 w-36" /> {/* Subtitle */}
                </div>
                <div className="flex-1 flex items-end justify-between gap-4 px-2 min-h-0 pt-6 pb-2">
                    <Skeleton className="h-24 flex-1 rounded-t-lg" />
                    <Skeleton className="h-32 flex-1 rounded-t-lg" />
                    <Skeleton className="h-16 flex-1 rounded-t-lg" />
                    <Skeleton className="h-12 flex-1 rounded-t-lg" />
                </div>
            </div>
        );
    }

    if (variant === 'calendar') {
        return (
            <div className="h-full flex flex-col p-5 border rounded-xl bg-card gap-3">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                {/* Calendar grid header skeleton (D L M M J V S) */}
                <div className="flex justify-between px-2 pt-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-4 rounded-full" />
                    ))}
                </div>
                {/* Active day selection skeleton */}
                <div className="flex justify-between px-2 pt-1 pb-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className={cn("h-7 w-7 rounded-full", i === 1 && "bg-muted-foreground/20")} />
                    ))}
                </div>
                {/* Upcoming events empty state skeleton */}
                <div className="flex-1 border border-dashed border-border rounded-xl flex items-center justify-center min-h-[100px]">
                    <Skeleton className="h-4 w-36" />
                </div>
            </div>
        );
    }

    if (variant === 'table') {
        return (
            <div className="h-full flex flex-col p-4 border rounded-xl bg-card">
                <div className="flex justify-between items-center mb-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-8 w-24" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-4 w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 border rounded-xl bg-card">
            <CardHeader className="p-0 mb-4">
                <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="p-0 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </CardContent>
        </div>
    );
}

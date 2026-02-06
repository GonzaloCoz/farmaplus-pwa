
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
            <div className="h-full flex flex-col p-4 border rounded-xl bg-card">
                <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <Skeleton className="h-32 w-32 rounded-full mb-4" />
                    <div className="w-full space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
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

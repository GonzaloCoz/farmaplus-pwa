import { Card } from '@/components/ui/card';

export function InventorySkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center mb-6">
                <div className="h-8 w-1/3 bg-muted rounded"></div>
                <div className="h-8 w-24 bg-muted rounded"></div>
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-4 h-24 bg-muted/50 border-none" />
                ))}
            </div>

            {/* Search Bar Skeleton */}
            <div className="h-10 w-full bg-muted rounded mb-6"></div>

            {/* List Items Skeleton */}
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="p-4 flex gap-4 border-none bg-muted/20">
                        <div className="h-12 w-12 bg-muted rounded"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 bg-muted rounded"></div>
                            <div className="h-3 w-1/2 bg-muted rounded"></div>
                        </div>
                        <div className="h-8 w-8 bg-muted rounded"></div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

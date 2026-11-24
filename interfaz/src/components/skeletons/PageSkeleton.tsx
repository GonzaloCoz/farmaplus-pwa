import { Skeleton } from "@/components/ui/skeleton";
import { PageLayout } from "@/components/layout/PageLayout";

export function PageSkeleton() {
    return (
        <PageLayout>
            {/* Header Skeleton */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            {/* Content Skeleton */}
            <div className="space-y-6">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-[150px] w-full rounded-xl" />
                    <Skeleton className="h-[150px] w-full rounded-xl" />
                    <Skeleton className="h-[150px] w-full rounded-xl" />
                </div>
            </div>
        </PageLayout>
    );
}

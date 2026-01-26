
import { lazy, Suspense } from "react";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { PageTransition } from "./PageTransition";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Stock = lazy(() => import("@/pages/Stock"));
const PreCount = lazy(() => import("@/pages/PreCount"));
const StockImport = lazy(() => import("@/pages/StockImport"));
const ExpirationControl = lazy(() => import("@/pages/ExpirationControl"));
const CyclicInventory = lazy(() => import("@/pages/CyclicInventory"));
const CyclicInventoryDetail = lazy(() => import("@/pages/CyclicInventoryDetail"));
const Products = lazy(() => import("@/pages/Products"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const M3ComponentsDemo = lazy(() => import("@/pages/M3ComponentsDemo"));
const AnimationsDemo = lazy(() => import("@/pages/AnimationsDemo"));
const AdminBranches = lazy(() => import("@/pages/AdminBranches"));
const SmartAnalystPage = lazy(() => import("@/pages/SmartAnalystPage"));
const AdminAudit = lazy(() => import("@/pages/AdminAudit"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const BranchComparison = lazy(() => import("@/pages/BranchComparison"));

// Simple component mapping for isolated windows
const ROUTE_MAP: Record<string, React.ReactNode> = {
    "/": <Dashboard />,
    "/stock": <Stock />,
    "/stock/pre-count": <PreCount />,
    "/stock/import": <StockImport />,
    "/stock/expiration-control": <ExpirationControl />,
    "/cyclic-inventory": <CyclicInventory />,
    "/products": <Products />,
    "/reports": <Reports />,
    "/comparison": <BranchComparison />,
    "/settings": <Settings />,
    "/profile": <Profile />,
    "/m3-demo": <M3ComponentsDemo />,
    "/animations-demo": <AnimationsDemo />,
    "/admin/audit": <AdminAudit />,
    "/admin/users": <AdminUsers />,
    "/admin/branches": <AdminBranches />,
    "/smart-analyst": <SmartAnalystPage />,
};

// Function to handle dynamic routes like /cyclic-inventory/:id
const getComponentForPath = (path: string) => {
    if (ROUTE_MAP[path]) return ROUTE_MAP[path];

    // Pattern matching for /cyclic-inventory/:id
    if (path.startsWith('/cyclic-inventory/')) {
        return <CyclicInventoryDetail />;
    }

    return <div>Página no encontrada</div>;
};

export function WindowRouter({ currentPath }: { initialPath: string, currentPath: string, onPathChange: (path: string) => void }) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <PageTransition key={currentPath}>
                {getComponentForPath(currentPath)}
            </PageTransition>
        </Suspense>
    );
}

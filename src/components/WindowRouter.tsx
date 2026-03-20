
import { lazy, Suspense } from "react";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { PageTransition } from "./PageTransition";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Stock = lazy(() => import("@/pages/Stock"));
const PreCount = lazy(() => import("@/pages/PreCount"));
const StockImport = lazy(() => import("@/pages/StockImport"));
const StockRecountMobile = lazy(() => import("@/pages/StockRecountMobile"));
const ExpirationControl = lazy(() => import("@/pages/ExpirationControl"));
const CyclicInventory = lazy(() => import("@/pages/CyclicInventory"));
const CyclicInventoryDetail = lazy(() => import("@/pages/CyclicInventoryDetail"));
const Products = lazy(() => import("@/pages/Products"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const M3ComponentsDemo = lazy(() => import("@/pages/M3ComponentsDemo"));
const AnimationsDemo = lazy(() => import("@/pages/AnimationsDemo"));
const AdminBranches = lazy(() => import("@/pages/AdminBranches"));
const SmartAnalystPage = lazy(() => import("@/pages/SmartAnalystPage"));
const AdminAudit = lazy(() => import("@/pages/AdminAudit"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const BranchComparison = lazy(() => import("@/pages/BranchComparison"));
const InventoryReminder = lazy(() => import("@/pages/InventoryReminder"));
const TrainingCenter = lazy(() => import("../pages/TrainingCenter"));
const PostDetail = lazy(() => import("../pages/PostDetail"));
const AdminEditor = lazy(() => import("../pages/AdminEditor"));

// Simple component mapping for isolated windows
const ROUTE_MAP: Record<string, React.ReactNode> = {
    "/": <Dashboard />,
    "/stock": <Stock />,
    "/stock/pre-count": <PreCount />,
    "/stock/import": <StockImport />,
    "/stock/recount-mobile": <StockRecountMobile />,
    "/stock/expiration-control": <ExpirationControl />,
    "/cyclic-inventory": <CyclicInventory />,
    "/products": <Products />,
    "/reports": <Reports />,
    "/comparison": <BranchComparison />,
    "/settings": <Settings />,
    "/m3-demo": <M3ComponentsDemo />,
    "/animations-demo": <AnimationsDemo />,
    "/admin/audit": <AdminAudit />,
    "/admin/users": <AdminUsers />,
    "/admin/branches": <AdminBranches />,
    "/smart-analyst": <SmartAnalystPage />,
    "/inventory-reminder": <InventoryReminder />,
    "/foro": <TrainingCenter />,
    "/foro/admin/edit": <AdminEditor />,
    "/foro/admin/edit/:id": <AdminEditor />,
};

// Function to handle dynamic routes like /cyclic-inventory/:id
const getComponentForPath = (path: string) => {
    if (ROUTE_MAP[path]) return ROUTE_MAP[path];

    // Pattern matching for /cyclic-inventory/:id
    if (path.startsWith('/cyclic-inventory/')) {
        return <CyclicInventoryDetail />;
    }

    if (path.startsWith('/foro/')) {
        return <PostDetail />;
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

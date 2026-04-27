import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
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

export function WindowRouter({ currentPath }: { initialPath: string, currentPath: string, onPathChange: (path: string) => void }) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <PageTransition key={currentPath}>
                <Routes location={currentPath}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/stock" element={<Stock />} />
                    <Route path="/stock/pre-count" element={<PreCount />} />
                    <Route path="/stock/import" element={<StockImport />} />
                    <Route path="/stock/recount-mobile" element={<StockRecountMobile />} />
                    <Route path="/stock/expiration-control" element={<ExpirationControl />} />
                    <Route path="/cyclic-inventory" element={<CyclicInventory />} />
                    <Route path="/cyclic-inventory/:id" element={<CyclicInventoryDetail />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/comparison" element={<BranchComparison />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/animations-demo" element={<AnimationsDemo />} />
                    <Route path="/admin/audit" element={<AdminAudit />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/branches" element={<AdminBranches />} />
                    <Route path="/smart-analyst" element={<SmartAnalystPage />} />
                    <Route path="/inventory-reminder" element={<InventoryReminder />} />
                    <Route path="/foro" element={<TrainingCenter />} />
                    <Route path="/foro/:id" element={<PostDetail />} />
                    <Route path="/foro/admin/edit" element={<AdminEditor />} />
                    <Route path="/foro/admin/edit/:id" element={<AdminEditor />} />
                    <Route path="*" element={<div>Página no encontrada ({currentPath})</div>} />
                </Routes>
            </PageTransition>
        </Suspense>
    );
}

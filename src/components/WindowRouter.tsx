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
const ComponentsShowcase = lazy(() => import("@/pages/ComponentsShowcase"));
const Sandbox = lazy(() => import("@/pages/Sandbox"));
const RequestsPage = lazy(() => import("@/pages/RequestsPage"));

export function WindowRouter({ currentPath }: { initialPath: string, currentPath: string, onPathChange: (path: string) => void }) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <PageTransition key={currentPath}>
                <Routes location={currentPath}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/componentes" element={<ComponentsShowcase />} />
                    <Route path="/sandbox" element={<Sandbox />} />
                    <Route path="/solicitudes" element={<RequestsPage />} />
                    <Route path="/stock" element={<Stock />} />
                    <Route path="/stock/colector" element={<PreCount />} />
                    <Route path="/stock/recuento-movil" element={<StockRecountMobile />} />
                    <Route path="/stock/control-vencimiento" element={<ExpirationControl />} />
                    <Route path="/inventario-ciclico" element={<CyclicInventory />} />
                    <Route path="/inventario-ciclico/:id" element={<CyclicInventoryDetail />} />
                    <Route path="/reportes" element={<Reports />} />
                    <Route path="/comparativa" element={<BranchComparison />} />
                    <Route path="/configuracion" element={<Settings />} />
                    <Route path="/demo-animaciones" element={<AnimationsDemo />} />
                    <Route path="/admin/auditoria" element={<AdminAudit />} />
                    <Route path="/admin/usuarios" element={<AdminUsers />} />
                    <Route path="/admin/sucursales" element={<AdminBranches />} />
                    <Route path="/control-vencimiento" element={<SmartAnalystPage />} />
                    <Route path="/recordatorio-inventario" element={<InventoryReminder />} />
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

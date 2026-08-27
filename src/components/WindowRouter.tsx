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
const ReportDetail = lazy(() => import("@/components/ReportDetail"));
const Settings = lazy(() => import("@/pages/Settings"));
const AdminBranches = lazy(() => import("@/pages/AdminBranches"));
const SmartAnalystPage = lazy(() => import("@/pages/SmartAnalystPage"));
const AdminAudit = lazy(() => import("@/pages/AdminAudit"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const BranchComparison = lazy(() => import("@/pages/BranchComparison"));
const InventoryReminder = lazy(() => import("@/pages/InventoryReminder"));
const TrainingCenter = lazy(() => import("../pages/TrainingCenter"));
const PostDetail = lazy(() => import("../pages/PostDetail"));
const AdminEditor = lazy(() => import("../pages/AdminEditor"));
const RequestsPage = lazy(() => import("@/pages/RequestsPage"));
const DataCollectorPage = lazy(() => import("@/pages/DataCollectorPage"));

export function WindowRouter({ currentPath }: { initialPath: string, currentPath: string, onPathChange: (path: string) => void }) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <PageTransition key={currentPath}>
                <Routes location={currentPath}>
                    {/* Inicio & Core */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/solicitudes" element={<RequestsPage />} />

                    {/* Stock */}
                    <Route path="/stock" element={<Stock />} />
                    <Route path="/stock/colector" element={<PreCount />} />
                    <Route path="/stock/recuento-movil" element={<StockRecountMobile />} />
                    <Route path="/stock/control-vencimiento" element={<ExpirationControl />} />
                    <Route path="/stock/importar" element={<StockImport />} />
                    <Route path="/colector" element={<DataCollectorPage />} />

                    {/* Inventario Cíclico */}
                    <Route path="/inventario-ciclico" element={<CyclicInventory />} />
                    <Route path="/inventario-ciclico/:id" element={<CyclicInventoryDetail />} />

                    {/* Reportes & Comparativa */}
                    <Route path="/reportes" element={<Reports />} />
                    <Route path="/reportes/:reportId" element={<ReportDetail />} />
                    <Route path="/comparativa" element={<BranchComparison />} />

                    {/* Configuración & Admin */}
                    <Route path="/configuracion" element={<Settings />} />
                    <Route path="/admin/auditoria" element={<AdminAudit />} />
                    <Route path="/admin/usuarios" element={<AdminUsers />} />
                    <Route path="/admin/sucursales" element={<AdminBranches />} />

                    {/* Vencimientos & Recordatorio */}
                    <Route path="/control-vencimiento" element={<SmartAnalystPage />} />
                    <Route path="/recordatorio-inventario" element={<InventoryReminder />} />

                    {/* Foro / Capacitación */}
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

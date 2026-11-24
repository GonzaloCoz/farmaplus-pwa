import { HashRouter, Route, Routes, Outlet, useLocation, Navigate } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, lazy, Suspense, useState, useRef } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";

import { AppLayout } from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SileoToaster } from "@/components/ui/sileo";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PageTransition } from "./components/PageTransition";
import { SnackbarProvider } from "@/contexts/SnackbarContext";
import { UserProvider, useUser } from "./contexts/UserContext";
import { NotificationPreferencesProvider } from "./contexts/NotificationPreferencesContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { hasPermission } from "@/config/permissions";

import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { PageSkeleton } from "./components/skeletons/PageSkeleton";
import { initDB } from "@/services/preCountDB";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WindowManagerProvider } from "./contexts/WindowManagerContext";
import { LayoutProvider } from "./contexts/LayoutContext";
import { AppContextMenu } from "@/components/AppContextMenu";
import {
  useSystemModules,
  DEFAULT_CONSTRUCTION_PAGES,
  type ConstructionPageKey,
} from "@/hooks/useSystemModules";

// Lazy load de todas las páginas para reducir bundle inicial
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Stock = lazy(() => import("./pages/Stock"));
const PreCount = lazy(() => import("./pages/PreCount"));
const StockRecountMobile = lazy(() => import("./pages/StockRecountMobile"));
const EanImageTester = lazy(() => import("./pages/EanImageTester"));
const ExpirationControl = lazy(() => import("./pages/ExpirationControl"));
const CyclicInventory = lazy(() => import("./pages/CyclicInventory"));
const CyclicInventoryDetail = lazy(() => import("./pages/CyclicInventoryDetail"));

const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminBranches = lazy(() => import("./pages/AdminBranches"));
const SmartAnalystPage = lazy(() => import("./pages/SmartAnalystPage"));
const AdminAudit = lazy(() => import("./pages/AdminAudit"));

const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const TrainingCenter = lazy(() => import("./pages/TrainingCenter"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const AdminEditor = lazy(() => import("./pages/AdminEditor"));
const DataCollectorPage = lazy(() => import("./pages/DataCollectorPage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const LiveSalesTerminal = lazy(() => import("./pages/LiveSalesTerminal"));
const Construction = lazy(() => import("./pages/Construction"));
const Interfarmacias = lazy(() => import("./pages/Interfarmacias"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de tiempo de expiración global
      gcTime: 1000 * 60 * 10,   // 10 minutos para recolección de basura
      retry: 1,
      refetchOnWindowFocus: false, // Evita parpadeos repentinos al cambiar de pestaña
    },
  },
});

// Componente para proteger rutas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (user) {
      useSystemModules.getState().initRealtimeSync();
    }
  }, [user]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const ConstructionRoute = ({
  pageKey,
  titleOverride,
  children,
}: {
  pageKey: ConstructionPageKey;
  titleOverride?: string;
  children?: React.ReactNode;
}) => {
  const isUnderConstruction = useSystemModules(
    (state) => state.modules.constructionPages?.[pageKey] ?? DEFAULT_CONSTRUCTION_PAGES[pageKey]
  );

  if (isUnderConstruction) {
    return <Construction titleOverride={titleOverride} />;
  }

  return <>{children ?? <div className="w-full h-full" />}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user || !hasPermission(user, 'VIEW_ADMIN_DASHBOARD')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      <Route
        path="/login"
        element={
          <Suspense fallback={<DashboardSkeleton />}>
            <PageTransition>
              <Login />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/recuento-movil"
        element={
          <Suspense fallback={<DashboardSkeleton />}>
            <StockRecountMobile />
          </Suspense>
        }
      />
      <Route
        path="/test-ean"
        element={
          <Suspense fallback={<DashboardSkeleton />}>
            <EanImageTester />
          </Suspense>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<DashboardSkeleton />}>
              <PageTransition>
                <Dashboard />
              </PageTransition>
            </Suspense>
          }
        />
            <Route
              path="solicitudes"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="solicitudes" titleOverride="Solicitudes">
                      <RequestsPage />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="interfarmacias"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="interfarmacias" titleOverride="Interfarmacias">
                      <Interfarmacias />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="trazabilidad"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="trazabilidad" titleOverride="Trazabilidad" />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="movimientos"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="movimientos" titleOverride="Movimientos" />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="terminal-ventas"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <LiveSalesTerminal />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="stock"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="stock" titleOverride="Stock">
                      <Stock />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="stock/colector"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="stock" titleOverride="Stock">
                      <PreCount />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="stock/recuento-movil"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="stock" titleOverride="Stock">
                      <StockRecountMobile />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="stock/control-vencimiento"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="control-vencimiento" titleOverride="Control de Vencimiento">
                      <ExpirationControl />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="inventario-ciclico"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="inventario-ciclico" titleOverride="Inventarios Cíclicos">
                      <CyclicInventory />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="inventario-ciclico/:id"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="inventario-ciclico" titleOverride="Inventarios Cíclicos">
                      <CyclicInventoryDetail />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />


            <Route
              path="configuracion"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <PageTransition>
                    <Settings />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="admin/auditoria"
              element={
                <AdminRoute>
                  <Suspense fallback={<PageSkeleton />}>
                    <PageTransition>
                      <AdminAudit />
                    </PageTransition>
                  </Suspense>
                </AdminRoute>
              }
            />

            <Route
              path="admin/usuarios"
              element={
                <AdminRoute>
                  <Suspense fallback={<PageSkeleton />}>
                    <PageTransition>
                      <AdminUsers />
                    </PageTransition>
                  </Suspense>
                </AdminRoute>
              }
            />
            <Route
              path="admin/sucursales"
              element={
                <AdminRoute>
                  <Suspense fallback={<PageSkeleton />}>
                    <PageTransition>
                      <AdminBranches />
                    </PageTransition>
                  </Suspense>
                </AdminRoute>
              }
            />
            <Route
              path="control-vencimiento"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <PageTransition>
                    <ConstructionRoute pageKey="control-vencimiento" titleOverride="Control de Vencimiento">
                      <SmartAnalystPage />
                    </ConstructionRoute>
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path="foro"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <TrainingCenter />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="foro/admin/edit"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <AdminEditor />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="foro/admin/edit/:id"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <AdminEditor />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="foro/:id"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <PostDetail />
                  </PageTransition>
                </Suspense>
              }
            />
        </Route>
      <Route
        path="/colector"
        element={
          <Suspense fallback={<DashboardSkeleton />}>
            <DataCollectorPage />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <Suspense fallback={<DashboardSkeleton />}>
            <PageTransition>
              <NotFound />
            </PageTransition>
          </Suspense>
        }
      />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    // Inicializar DB inmediatamente al cargar la app
    const initialize = async () => {
      try {
        await initDB();
      } catch (error) {
        console.error("Error initializing DB:", error);
      }
    };

    initialize();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SnackbarProvider>
            <NotificationPreferencesProvider>
              <UserProvider>
                <NotificationProvider>
                  <SileoToaster position="bottom-right" options={{ roundness: 12 }} />
                  <OfflineIndicator />
                  <ErrorBoundary>
                    <AppContextMenu>
                      <HashRouter 
                        future={{
                          v7_startTransition: true,
                          v7_relativeSplatPath: true,
                        }}
                      >
                        <WindowManagerProvider>
                          <LayoutProvider>
                            <AppRoutes />
                          </LayoutProvider>
                        </WindowManagerProvider>
                      </HashRouter>
                    </AppContextMenu>
                  </ErrorBoundary>
                </NotificationProvider>
              </UserProvider>
            </NotificationPreferencesProvider>
          </SnackbarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
};

export default App;

// Deployment trigger: Secret unblocked in GitHub security settings.

import { MemoryRouter, Route, Routes, Outlet, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";

import { AppLayout } from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "./components/PageTransition";
import { SnackbarProvider } from "@/contexts/SnackbarContext";
import { UserProvider, useUser } from "./contexts/UserContext";
import { NotificationPreferencesProvider } from "./contexts/NotificationPreferencesContext";

import { LayoutPresetsDialog } from "@/components/dashboard/LayoutPresetsDialog";
import { LAYOUT_PRESETS } from "@/config/widgetPresets";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { PageSkeleton } from "./components/skeletons/PageSkeleton";
import { loadDefaultData, initDB } from "@/services/preCountDB";

// Lazy load de todas las páginas para reducir bundle inicial
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Stock = lazy(() => import("./pages/Stock"));
const PreCount = lazy(() => import("./pages/PreCount"));
const StockImport = lazy(() => import("./pages/StockImport"));
const ExpirationControl = lazy(() => import("./pages/ExpirationControl"));
const CyclicInventory = lazy(() => import("./pages/CyclicInventory"));
const CyclicInventoryDetail = lazy(() => import("./pages/CyclicInventoryDetail"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const M3ComponentsDemo = lazy(() => import("./pages/M3ComponentsDemo"));
const AnimationsDemo = lazy(() => import("./pages/AnimationsDemo"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminBranches = lazy(() => import("./pages/AdminBranches"));


const queryClient = new QueryClient();

// Componente para proteger rutas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
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
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/stock"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Stock />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/stock/pre-count"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <PreCount />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/stock/import"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <StockImport />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/stock/expiration-control"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <ExpirationControl />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/cyclic-inventory"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <CyclicInventory />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/cyclic-inventory/:id"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <CyclicInventoryDetail />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/products"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <PageTransition>
                  <Products />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/reports"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <PageTransition>
                  <Reports />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <PageTransition>
                  <Settings />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/profile"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <PageTransition>
                  <Profile />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/m3-demo"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <M3ComponentsDemo />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/animations-demo"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <AnimationsDemo />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/admin/branches"
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
        </Route>
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
    </AnimatePresence>
  );
};




const App = () => {
  useEffect(() => {
    // Intentar cargar datos por defecto al iniciar
    // Deferir la carga para no bloquear el render inicial
    const timer = setTimeout(async () => {
      try {
        await initDB(); // Initialize DB first
        loadDefaultData().then(loaded => {
          if (loaded) {
            console.log("Base de datos inicializada con archivo por defecto");
          }
        });
      } catch (error) {
        console.error("Error initializing DB:", error);
      }
    }, 1000); // Esperar 1 segundo para asegurar que la UI cargó

    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SnackbarProvider>
          <NotificationPreferencesProvider>
            <UserProvider>
              <Sonner />
              <OfflineIndicator />
              <InstallPrompt />
              <MemoryRouter>
                <AppRoutes />
              </MemoryRouter>
            </UserProvider>
          </NotificationPreferencesProvider>
        </SnackbarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

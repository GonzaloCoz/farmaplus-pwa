import { BrowserRouter, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";

import AppLayout from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/PageTransition";
import { SnackbarProvider } from "@/contexts/SnackbarContext";

import { DashboardSkeleton } from "@/components/DashboardSkeleton";

// Lazy load de todas las páginas para reducir bundle inicial
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Stock = lazy(() => import("./pages/Stock"));
const PreCount = lazy(() => import("./pages/PreCount"));
const StockImport = lazy(() => import("./pages/StockImport"));
const Cyclic = lazy(() => import("./pages/Cyclic"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const M3ComponentsDemo = lazy(() => import("./pages/M3ComponentsDemo"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Componente de loading optimizado


function Layout() {
  return (
    <AppLayout>
      <div className="flex flex-1 flex-col h-full overflow-hidden lg:pl-24">
        <main className="flex-1 h-full w-full overflow-y-auto p-4 sm:pb-6 lg:p-6">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}

const AppRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<Layout />}>
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
            path="/cyclic-inventory"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Cyclic />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/products"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Products />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/reports"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Reports />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Settings />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/profile"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
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

import { loadDefaultData } from "@/services/preCountDB";


const App = () => {
  useEffect(() => {
    // Intentar cargar datos por defecto al iniciar
    loadDefaultData().then(loaded => {
      if (loaded) {
        console.log("Base de datos inicializada con archivo por defecto");
      }
    });


  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SnackbarProvider>
          <Sonner />
          <OfflineIndicator />
          <InstallPrompt />
          <BrowserRouter basename="/farmaplus-pwa/">
            <AppRoutes />
          </BrowserRouter>
        </SnackbarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

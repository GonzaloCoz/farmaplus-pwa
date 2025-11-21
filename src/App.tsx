import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { AppLayout } from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Import = lazy(() => import("./pages/Import"));
const Cyclic = lazy(() => import("./pages/Cyclic"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading component
const PageLoader = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
);

const queryClient = new QueryClient();

function Layout() {
  return (
    <AppLayout>
      {/* Contenedor principal del contenido que se adapta */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden lg:pl-24">
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}

const App = () => {
  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/farmaplus-pwa/service-worker.js')
          .then((registration) => {
            console.log('✅ Service Worker registrado:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available, show update notification
                    console.log('🔄 Nueva versión disponible');
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('❌ Error al registrar Service Worker:', error);
          });
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <OfflineIndicator />
        <InstallPrompt />
        <BrowserRouter basename="/farmaplus-pwa/">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/import" element={<Import />} />
                <Route path="/cyclic-inventory" element={<Cyclic />} />
                <Route path="/products" element={<Products />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

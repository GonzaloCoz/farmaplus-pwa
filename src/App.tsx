import { BrowserRouter, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";

import { AppLayout } from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/PageTransition";
import { SnackbarProvider } from "@/contexts/SnackbarContext";

import Dashboard from "./pages/Dashboard";
import Stock from "./pages/Stock";
import PreCount from "./pages/PreCount";
import StockImport from "./pages/StockImport";
import Cyclic from "./pages/Cyclic";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import M3ComponentsDemo from "./pages/M3ComponentsDemo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ... existing imports ...

function Layout() {
  return (
    <AppLayout>
      {/* Contenedor principal del contenido que se adapta */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden lg:pl-24">
        <main className="flex-1 overflow-y-auto p-4 pb-6 max-h-[calc(100vh-var(--bottom-nav-height)-env(safe-area-inset-bottom))] sm:max-h-screen lg:p-6 lg:pb-6">
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
          <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/stock" element={<PageTransition><Stock /></PageTransition>} />
          <Route path="/stock/pre-count" element={<PageTransition><PreCount /></PageTransition>} />
          <Route path="/stock/import" element={<PageTransition><StockImport /></PageTransition>} />
          <Route path="/cyclic-inventory" element={<PageTransition><Cyclic /></PageTransition>} />
          <Route path="/products" element={<PageTransition><Products /></PageTransition>} />
          <Route path="/reports" element={<PageTransition><Reports /></PageTransition>} />
          <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
          <Route path="/m3-demo" element={<PageTransition><M3ComponentsDemo /></PageTransition>} />
        </Route>
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  // ... existing useEffect ...

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

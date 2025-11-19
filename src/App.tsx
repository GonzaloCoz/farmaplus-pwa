import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppLayout } from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";

import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import Cyclic from "./pages/Cyclic";
import Products from "./pages/Products";
import Reports from "./pages/Reports"; // Asumiendo que Reports ya está en pages
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

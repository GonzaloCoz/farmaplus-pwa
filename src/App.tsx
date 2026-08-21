import { HashRouter, Route, Routes, Outlet, useLocation, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, lazy, Suspense, useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";

import { AppLayout } from "./components/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster as SileoToaster } from "@/components/ui/sileo";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";
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

// Lazy load de todas las páginas para reducir bundle inicial
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Stock = lazy(() => import("./pages/Stock"));
const PreCount = lazy(() => import("./pages/PreCount"));
const StockImport = lazy(() => import("./pages/StockImport"));
const StockRecountMobile = lazy(() => import("./pages/StockRecountMobile"));
const ExpirationControl = lazy(() => import("./pages/ExpirationControl"));
const CyclicInventory = lazy(() => import("./pages/CyclicInventory"));
const CyclicInventoryDetail = lazy(() => import("./pages/CyclicInventoryDetail"));

const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const AnimationsDemo = lazy(() => import("./pages/AnimationsDemo"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminBranches = lazy(() => import("./pages/AdminBranches"));
const SmartAnalystPage = lazy(() => import("./pages/SmartAnalystPage"));
const AdminAudit = lazy(() => import("./pages/AdminAudit"));

const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const BranchComparison = lazy(() => import("./pages/BranchComparison"));
const InventoryReminder = lazy(() => import("./pages/InventoryReminder"));
const TrainingCenter = lazy(() => import("./pages/TrainingCenter"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const AdminEditor = lazy(() => import("./pages/AdminEditor"));
const DataCollectorPage = lazy(() => import("./pages/DataCollectorPage"));


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

  if (!user || !hasPermission(user, 'VIEW_ADMIN_DASHBOARD')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();
  useAndroidBackButton();
  const isNative = Capacitor.isNativePlatform();

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
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {isNative ? (
          <>
            <Route
              index
              element={<Navigate to="/collector" replace />}
            />
            <Route
              path="*"
              element={<Navigate to="/collector" replace />}
            />
          </>
        ) : (
          <>
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
              path="stock"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <Stock />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route
              path="stock/colector"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <PreCount />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="stock/pre-count" element={<Navigate to="/stock/colector" replace />} />
            <Route
              path="stock/recuento-movil"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <StockRecountMobile />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="stock/recount-mobile" element={<Navigate to="/stock/recuento-movil" replace />} />
            <Route
              path="stock/control-vencimiento"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <ExpirationControl />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="stock/expiration-control" element={<Navigate to="/stock/control-vencimiento" replace />} />
            <Route
              path="inventario-ciclico"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <CyclicInventory />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="cyclic-inventory" element={<Navigate to="/inventario-ciclico" replace />} />
            <Route
              path="inventario-ciclico/:id"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <CyclicInventoryDetail />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path="reportes"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <PageTransition>
                    <Reports />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="reports" element={<Navigate to="/reportes" replace />} />
            <Route
              path="comparativa"
              element={
                <AdminRoute>
                  <Suspense fallback={<PageSkeleton />}>
                    <PageTransition>
                      <BranchComparison />
                    </PageTransition>
                  </Suspense>
                </AdminRoute>
              }
            />
            <Route path="comparison" element={<Navigate to="/comparativa" replace />} />
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
            <Route path="settings" element={<Navigate to="/configuracion" replace />} />
            <Route
              path="demo-animaciones"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <AnimationsDemo />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="animations-demo" element={<Navigate to="/demo-animaciones" replace />} />
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
            <Route path="admin/audit" element={<Navigate to="/admin/auditoria" replace />} />

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
            <Route path="admin/users" element={<Navigate to="/admin/usuarios" replace />} />
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
            <Route path="admin/branches" element={<Navigate to="/admin/sucursales" replace />} />
            <Route
              path="control-vencimiento"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <PageTransition>
                    <SmartAnalystPage />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="smart-analyst" element={<Navigate to="/control-vencimiento" replace />} />
            <Route
              path="recordatorio-inventario"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition>
                    <InventoryReminder />
                  </PageTransition>
                </Suspense>
              }
            />
            <Route path="inventory-reminder" element={<Navigate to="/recordatorio-inventario" replace />} />
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
          </>
        )}
      </Route>
      <Route
        path="/collector"
        element={
          <Suspense fallback={<DashboardSkeleton />}>
            <DataCollectorPage />
          </Suspense>
        }
      />
      <Route
        path="/data-collector"
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




import { WindowManagerProvider } from "./contexts/WindowManagerContext";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";

// Toggle to temporarily pause/suspend the entire application UI
const MAINTENANCE_MODE = false;

// Playable Chrome T-Rex Dino Game
const ChromeDinoGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('dino_high_score') || '0', 10);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detect dark mode
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const colorTheme = isDark ? '#e8eaed' : '#535353';
    const groundColor = isDark ? '#5c5f62' : '#d2d2d2';

    // Set canvas dimensions
    canvas.width = 600;
    canvas.height = 150;

    let animationFrameId: number;
    let isJumping = false;
    const groundY = 130;
    const dinoHeight = 36;
    const dinoWidth = 34;
    const startDinoY = groundY - dinoHeight; // 94
    let dinoY = startDinoY; 
    let dinoVy = 0;
    const gravity = 0.5;
    const jumpStrength = -9.5;

    // Obstacles
    interface Obstacle {
      x: number;
      width: number;
      height: number;
      speed: number;
    }
    let obstacles: Obstacle[] = [];
    let obstacleTimer = 0;
    let currentScore = 0;
    let speedMultiplier = 1;

    // Dino animation frame
    let dinoFrame = 0;

    // Handle inputs
    const handleJump = () => {
      if (gameState === 'START') {
        setGameState('PLAYING');
      } else if (gameState === 'PLAYING' && !isJumping) {
        dinoVy = jumpStrength;
        isJumping = true;
      } else if (gameState === 'GAME_OVER') {
        // Reset game
        dinoY = startDinoY;
        dinoVy = 0;
        isJumping = false;
        obstacles = [];
        obstacleTimer = 0;
        currentScore = 0;
        speedMultiplier = 1;
        setScore(0);
        setGameState('PLAYING');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Add event listener to canvas for clicks/taps
    const onCanvasClick = (e: MouseEvent) => {
      e.preventDefault();
      handleJump();
    };
    const onCanvasTouch = (e: TouchEvent) => {
      e.preventDefault();
      handleJump();
    };

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onCanvasTouch);

    // Drawing functions
    const drawDino = (ctx: CanvasRenderingContext2D, y: number, frame: number) => {
      ctx.fillStyle = colorTheme;
      const x = 50; // Dino fixed X
      
      // Head
      ctx.fillRect(x + 16, y + 0, 16, 4); // Top of head
      ctx.fillRect(x + 14, y + 4, 20, 4); // Forehead / snout
      ctx.fillRect(x + 14, y + 8, 20, 4); // Eye level
      ctx.fillRect(x + 14, y + 12, 12, 4); // Jaw
      ctx.fillRect(x + 18, y + 16, 12, 2); // Mouth bottom
      
      // Eye
      ctx.fillStyle = isDark ? '#202124' : '#ffffff';
      ctx.fillRect(x + 18, y + 4, 2, 2);
      ctx.fillStyle = colorTheme;

      // Neck & Body
      ctx.fillRect(x + 8, y + 12, 8, 14); // Back / neck
      ctx.fillRect(x + 0, y + 16, 20, 12); // Main body
      ctx.fillRect(x + 0, y + 20, 24, 6);  // Chest
      
      // Tail
      ctx.fillRect(x - 4, y + 14, 4, 8);
      ctx.fillRect(x - 8, y + 16, 4, 6);
      
      // Arms
      ctx.fillRect(x + 22, y + 18, 4, 2);
      ctx.fillRect(x + 22, y + 20, 2, 2);

      // Legs
      if (gameState === 'PLAYING') {
        const legToggle = Math.floor(frame / 6) % 2 === 0;
        if (legToggle) {
          // Leg 1 down
          ctx.fillRect(x + 6, y + 28, 4, 6);
          ctx.fillRect(x + 6, y + 34, 6, 2);
          // Leg 2 bent
          ctx.fillRect(x + 14, y + 28, 4, 4);
        } else {
          // Leg 1 bent
          ctx.fillRect(x + 6, y + 28, 4, 4);
          // Leg 2 down
          ctx.fillRect(x + 14, y + 28, 4, 6);
          ctx.fillRect(x + 14, y + 34, 6, 2);
        }
      } else {
        // Standing
        ctx.fillRect(x + 6, y + 28, 4, 6);
        ctx.fillRect(x + 6, y + 34, 6, 2);
        ctx.fillRect(x + 14, y + 28, 4, 6);
        ctx.fillRect(x + 14, y + 34, 6, 2);
      }
    };

    const drawCactus = (ctx: CanvasRenderingContext2D, x: number, width: number, height: number) => {
      ctx.fillStyle = colorTheme;
      // Main stem
      ctx.fillRect(x + width / 3, groundY - height, width / 3, height);
      // Left arm
      ctx.fillRect(x, groundY - height * 0.7, width / 3, 4);
      ctx.fillRect(x, groundY - height * 0.7 - 6, 4, 6);
      // Right arm
      ctx.fillRect(x + width * 2/3, groundY - height * 0.8, width / 3, 4);
      ctx.fillRect(x + width - 4, groundY - height * 0.8 - 8, 4, 8);
    };

    const drawGround = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = groundColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(600, groundY);
      ctx.stroke();

      // Ground details
      ctx.fillStyle = groundColor;
      ctx.fillRect(100, groundY + 5, 5, 1);
      ctx.fillRect(250, groundY + 8, 12, 1);
      ctx.fillRect(400, groundY + 4, 8, 1);
      ctx.fillRect(550, groundY + 6, 4, 1);
    };

    // Game loop
    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw ground
      drawGround(ctx);

      // Physics/Logic
      if (gameState === 'PLAYING') {
        dinoFrame++;
        
        // Gravity
        dinoVy += gravity;
        dinoY += dinoVy;

        if (dinoY >= startDinoY) {
          dinoY = startDinoY;
          dinoVy = 0;
          isJumping = false;
        }

        // Spawn obstacles
        obstacleTimer--;
        if (obstacleTimer <= 0) {
          const height = 18 + Math.random() * 20;
          const width = 12 + Math.random() * 8;
          obstacles.push({
            x: 600,
            width,
            height,
            speed: 4.5 * speedMultiplier
          });
          obstacleTimer = 80 + Math.random() * 70;
        }

        // Move and draw obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const obs = obstacles[i];
          obs.x -= obs.speed;

          drawCactus(ctx, obs.x, obs.width, obs.height);

          // Check collision (AABB)
          const dinoLeft = 50 - 2;
          const dinoRight = 50 + 26;
          const dinoTop = dinoY + 2;
          const dinoBottom = dinoY + dinoHeight;

          const obsLeft = obs.x;
          const obsRight = obs.x + obs.width;
          const obsTop = groundY - obs.height;
          const obsBottom = groundY;

          if (
            dinoRight > obsLeft &&
            dinoLeft < obsRight &&
            dinoBottom > obsTop &&
            dinoTop < obsBottom
          ) {
            setGameState('GAME_OVER');
            if (currentScore > highScore) {
              setHighScore(currentScore);
              localStorage.setItem('dino_high_score', currentScore.toString());
            }
          }

          // Remove off-screen obstacles
          if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            currentScore += 10;
            setScore(currentScore);
            
            if (currentScore % 100 === 0) {
              speedMultiplier += 0.08;
            }
          }
        }
      } else {
        // Draw static obstacles
        obstacles.forEach(obs => {
          drawCactus(ctx, obs.x, obs.width, obs.height);
        });
      }

      // Draw Dino
      drawDino(ctx, dinoY, dinoFrame);

      // UI messages on canvas
      if (gameState === 'GAME_OVER') {
        ctx.fillStyle = colorTheme;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('G A M E   O V E R', 300, 50);
        ctx.font = '10px monospace';
        ctx.fillText('TOCÁ O ESPACIO PARA REINICIAR', 300, 75);
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('touchstart', onCanvasTouch);
    };
  }, [gameState, highScore]);

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[600px] mx-auto">
      <div className="flex justify-end w-full mb-1 font-mono text-xs tracking-wider font-bold opacity-60 text-right">
        <span className="mr-4">HI {highScore.toString().padStart(5, '0')}</span>
        <span>{score.toString().padStart(5, '0')}</span>
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full aspect-[4/1] bg-transparent cursor-pointer border-b border-slate-300 dark:border-slate-700"
      />
      {gameState === 'START' && (
        <p className="mt-4 text-xs font-mono opacity-60 animate-pulse text-center">
          [ Presioná ESPACIO o tocá el juego para saltar ]
        </p>
      )}
    </div>
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

    if (!MAINTENANCE_MODE) {
      initialize();
    }
  }, []);


  /* Splash screen removed */

  if (MAINTENANCE_MODE) {
    return (
      <iframe 
        src="/camlboy/index.html" 
        title="Mantenimiento - Farmaplus" 
        className="fixed inset-0 w-full h-full border-none z-50 bg-[#0b0f19]"
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SnackbarProvider>
          <NotificationPreferencesProvider>
            <UserProvider>
              <NotificationProvider>
                <SileoToaster position="bottom-right" options={{ roundness: 12 }} />
                <Sonner />
                <OfflineIndicator />
                <InstallPrompt />
                <ErrorBoundary>
                  <HashRouter 
                    future={{
                      v7_startTransition: true,
                      v7_relativeSplatPath: true,
                    }}
                  >
                    <WindowManagerProvider>
                      <AppRoutes />
                    </WindowManagerProvider>
                  </HashRouter>
                </ErrorBoundary>
              </NotificationProvider>
            </UserProvider>
          </NotificationPreferencesProvider>
        </SnackbarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

// Deployment trigger: Secret unblocked in GitHub security settings.

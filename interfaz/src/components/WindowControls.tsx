import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Square, XClose as XIcon } from '@untitledui/icons';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from "@/lib/utils";

interface WindowControlsProps {
  className?: string;
}

export function WindowControls({ className }: WindowControlsProps) {
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    try {
      const appWindow = getCurrentWindow();
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});

      const unlisten = appWindow.onResized(() => {
        appWindow.isMaximized().then(setIsMaximized).catch(() => {});
      });

      return () => {
        unlisten.then((f) => f()).catch(() => {});
      };
    } catch (e) {
      console.error("Window state listener error:", e);
    }
  }, [isTauri]);

  if (!isTauri) return null;

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error("Minimize error:", err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    } catch (err) {
      console.error("Maximize error:", err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Close error:", err);
    }
  };

  return (
    <div
      data-no-drag
      onMouseDown={(e) => e.stopPropagation()}
      className={cn("flex items-center gap-0.5 shrink-0 select-none", className)}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleMinimize}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg"
        title="Minimizar"
        aria-label="Minimizar ventana"
      >
        <Minus className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleMaximize}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg"
        title={isMaximized ? "Restaurar" : "Maximizar"}
        aria-label={isMaximized ? "Restaurar ventana" : "Maximizar ventana"}
      >
        <Square className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleClose}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 cursor-pointer text-muted-foreground hover:bg-red-500 hover:text-white h-7 w-7 rounded-lg transition-colors"
        title="Cerrar"
        aria-label="Cerrar ventana"
      >
        <XIcon className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

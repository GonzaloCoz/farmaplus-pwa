"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownSub,
  DropdownSubTrigger,
  DropdownSubContent,
  DropdownSeparator,
  MenuItem,
} from "@/components/ui/dropdown";
import {
  ArrowLeft,
  RotateCw,
  Printer,
  Copy,
  Scissors,
  Clipboard,
  CheckSquare,
  Maximize,
  Minimize,
  Activity,
  Wifi,
  Trash2,
  Code,
  Download,
  Folder,
  Link,
  Mail,
  Pencil,
} from "lucide-react";
import { toast } from "@/lib/notifications";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuContextValue {
  openMenu: (e: React.MouseEvent, customContent?: ReactNode) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error("useContextMenu must be used within ContextMenuProvider");
  return ctx;
}

export function GlobalContextMenu() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [isEditable, setIsEditable] = useState(false);
  const [customContent, setCustomContent] = useState<ReactNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const openTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Don't override if a specific data-native-context attribute is present
      if ((e.target as HTMLElement)?.closest("[data-native-context]")) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      openTimeRef.current = performance.now();

      // Check text selection
      const sel = window.getSelection()?.toString().trim() || "";
      setSelectedText(sel);

      // Check if target is an editable input
      const target = e.target as HTMLElement;
      const editable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      setIsEditable(editable);

      // Keep position inside viewport boundaries
      const x = Math.min(e.clientX, window.innerWidth - 240);
      const y = Math.min(e.clientY, window.innerHeight - 340);

      setPosition({ x, y });
      setCustomContent(null);
      setOpen(true);
    };

    // Prevent immediate release mouseup/pointerup from closing the menu
    const handleCapturePointerUp = (e: MouseEvent) => {
      if (performance.now() - openTimeRef.current < 250) {
        e.stopPropagation();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("mouseup", handleCapturePointerUp, true);
    window.addEventListener("pointerup", handleCapturePointerUp, true);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("mouseup", handleCapturePointerUp, true);
      window.removeEventListener("pointerup", handleCapturePointerUp, true);
    };
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    // If attempting to close within 350ms of opening, it's caused by the mouseup
    // of the very right-click gesture that opened the menu. Ignore it!
    if (!next && performance.now() - openTimeRef.current < 350) {
      return;
    }
    setOpen(next);
  }, []);

  const handleBack = () => {
    setOpen(false);
    window.history.back();
  };

  const handleReload = () => {
    setOpen(false);
    window.location.reload();
  };

  const handlePrint = () => {
    setOpen(false);
    window.print();
  };

  const handleCopy = () => {
    setOpen(false);
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      toast.success("Copiado al portapapeles");
    } else {
      document.execCommand("copy");
    }
  };

  const handlePaste = async () => {
    setOpen(false);
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand("insertText", false, text);
    } catch {
      toast.error("No se pudo pegar");
    }
  };

  const handleSelectAll = () => {
    setOpen(false);
    document.execCommand("selectAll");
  };

  const handleClearCache = async () => {
    setOpen(false);
    try {
      localStorage.removeItem("product_cache");
      sessionStorage.clear();
      toast.success("Caché temporal limpiada");
    } catch {
      toast.error("Error al limpiar caché");
    }
  };

  const handleToggleFullscreen = () => {
    setOpen(false);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleInspect = () => {
    setOpen(false);
    toast.info("Atajo de inspección", {
      description: "Presiona F12 o Ctrl+Shift+I para abrir las herramientas de desarrollo de Tauri.",
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownTrigger
        render={
          <span
            style={{
              position: "fixed",
              left: position.x,
              top: position.y,
              width: 0,
              height: 0,
              pointerEvents: "none",
              visibility: "hidden",
            }}
          />
        }
      />
      <DropdownContent
        side="bottom"
        align="start"
        sideOffset={2}
        className="w-56 z-[9999]"
      >
        {customContent ? (
          customContent
        ) : (
          <>
            {/* Si hay texto seleccionado o estamos en input editable */}
            {(selectedText || isEditable) && (
              <>
                {selectedText && (
                  <MenuItem
                    index={0}
                    icon={Copy}
                    label="Copiar"
                    onSelect={handleCopy}
                  />
                )}
                {isEditable && (
                  <>
                    <MenuItem
                      index={1}
                      icon={Clipboard}
                      label="Pegar"
                      onSelect={handlePaste}
                    />
                    <MenuItem
                      index={2}
                      icon={CheckSquare}
                      label="Seleccionar todo"
                      onSelect={handleSelectAll}
                    />
                  </>
                )}
                <DropdownSeparator />
              </>
            )}

            {/* Acciones principales de navegación y página (Estilo Windows 11 Fluent) */}
            <MenuItem
              index={3}
              icon={ArrowLeft}
              label={
                <div className="flex items-center justify-between w-full">
                  <span>Atrás</span>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">Alt+←</span>
                </div>
              }
              onSelect={handleBack}
            />

            <MenuItem
              index={4}
              icon={RotateCw}
              label={
                <div className="flex items-center justify-between w-full">
                  <span>Actualizar</span>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+R</span>
                </div>
              }
              onSelect={handleReload}
            />

            <DropdownSeparator />

            <MenuItem
              index={5}
              icon={Printer}
              label={
                <div className="flex items-center justify-between w-full">
                  <span>Imprimir</span>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">Ctrl+P</span>
                </div>
              }
              onSelect={handlePrint}
            />

            <DropdownSeparator />

            {/* Submenú Flotante con DropdownSub, DropdownSubTrigger y DropdownSubContent */}
            <DropdownSub>
              <DropdownSubTrigger index={6} icon={Folder} label="Más herramientas" />
              <DropdownSubContent className="w-56">
                <MenuItem
                  index={0}
                  icon={Trash2}
                  label="Limpiar caché local"
                  onSelect={handleClearCache}
                />
                <MenuItem
                  index={1}
                  icon={Activity}
                  label="Estado Plex 25"
                  onSelect={() => {
                    setOpen(false);
                    toast.info("Plex 25", {
                      description: "Verificando el servicio de sincronización...",
                    });
                  }}
                />
                <MenuItem
                  index={2}
                  icon={isFullscreen ? Minimize : Maximize}
                  label={
                    <div className="flex items-center justify-between w-full">
                      <span>{isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}</span>
                      <span className="text-[10px] text-muted-foreground/70 font-mono">F11</span>
                    </div>
                  }
                  onSelect={handleToggleFullscreen}
                />
              </DropdownSubContent>
            </DropdownSub>

            <DropdownSeparator />

            <MenuItem
              index={7}
              icon={Code}
              label="Inspeccionar"
              onSelect={handleInspect}
            />
          </>
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}

/**
 * Componente envoltorio opcional para zonas que quieran su propio Context Menu contextual
 */
interface ContextMenuProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

export function ContextMenu({ children, content, className }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const openTimeRef = useRef<number>(0);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    openTimeRef.current = performance.now();

    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 340);

    setPosition({ x, y });
    setOpen(true);
  };

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && performance.now() - openTimeRef.current < 350) {
      return;
    }
    setOpen(next);
  }, []);

  return (
    <div onContextMenu={handleContextMenu} className={className}>
      {children}
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownTrigger
          render={
            <span
              style={{
                position: "fixed",
                left: position.x,
                top: position.y,
                width: 0,
                height: 0,
                pointerEvents: "none",
                visibility: "hidden",
              }}
            />
          }
        />
        <DropdownContent
          side="bottom"
          align="start"
          sideOffset={2}
          className="w-56 z-[9999]"
        >
          {content}
        </DropdownContent>
      </DropdownMenu>
    </div>
  );
}

import { useState, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
} from "@/components/ui/context-menu";
import { DropdownSeparator } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import {
  ArrowLeft,
  RotateCw,
  Copy,
  Clipboard,
  CheckSquare,
  Maximize,
  Minimize,
  Printer,
} from "lucide-react";

/**
 * Menú contextual global de MiPlus construido sobre el ContextMenu oficial de Fluid.
 * Cede el paso automáticamente a menús contextuales propios (como las filas de DataTable).
 */
export function AppContextMenu({ children }: { children: ReactNode }) {
  const [selectedText, setSelectedText] = useState("");
  const [isEditable, setIsEditable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    const sel = window.getSelection()?.toString().trim() || "";
    setSelectedText(sel);

    const target = e.target as HTMLElement | null;
    const editable = Boolean(
      target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
    );
    setIsEditable(editable);
    setIsFullscreen(Boolean(document.fullscreenElement));
  };

  let idx = 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="contents"
        filter={(target) =>
          !target.closest("[data-ff-table] tbody tr[data-row-id]") &&
          !target.closest("[data-native-context]")
        }
        onContextMenu={handleContextMenu}
      >
        {children}
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {selectedText && (
          <MenuItem
            index={idx++}
            label="Copiar"
            icon={Copy}
            onSelect={() => navigator.clipboard?.writeText(selectedText)}
          />
        )}
        {isEditable && (
          <MenuItem
            index={idx++}
            label="Pegar"
            icon={Clipboard}
            onSelect={async () => {
              const text = await navigator.clipboard?.readText().catch(() => "");
              if (text) document.execCommand("insertText", false, text);
            }}
          />
        )}
        {(selectedText || isEditable) && <DropdownSeparator />}
        <MenuItem
          index={idx++}
          label="Volver atrás"
          icon={ArrowLeft}
          onSelect={() => window.history.back()}
        />
        <MenuItem
          index={idx++}
          label="Recargar"
          icon={RotateCw}
          onSelect={() => window.location.reload()}
        />
        <MenuItem
          index={idx++}
          label="Seleccionar todo"
          icon={CheckSquare}
          onSelect={() => document.execCommand("selectAll")}
        />
        <DropdownSeparator />
        <MenuItem
          index={idx++}
          label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          icon={isFullscreen ? Minimize : Maximize}
          onSelect={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            } else {
              document.documentElement.requestFullscreen().catch(() => {});
            }
          }}
        />
        <MenuItem
          index={idx++}
          label="Imprimir"
          icon={Printer}
          onSelect={() => window.print()}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

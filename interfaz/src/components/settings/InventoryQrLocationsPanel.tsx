import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { Plus, Trash2, Printer, Download, Save, ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { FARMAPLUS_SECTORS } from "@/constants/farmaplusSectors";
import { notify } from "@/lib/notifications";
import {
  expandLocationGroups,
  collapseLocationsToGroups,
  fetchBranchLocations,
  saveBranchLocations,
  type BranchLocationItem,
  type FacesPreset,
  type LocationGroupConfig,
  type ScanDirection,
} from "@/services/branchLocationsService";
import { supabase } from "@/integrations/supabase/client";

// A4 Vertical: 210 x 297 mm -> 2 columnas x 4 filas = 8 tarjetas por hoja
const A4_MM_W = 210;
const A4_MM_H = 297;
const MARGIN_MM = 8;
const GAP_X_MM = 5;
const GAP_Y_MM = 5;
const COLS = 2;
const ROWS = 4;
const CARDS_PER_PAGE = COLS * ROWS;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function renderA4PageToCanvas(
  canvas: HTMLCanvasElement,
  cards: BranchLocationItem[],
  pxPerMm: number
) {
  canvas.width = Math.round(A4_MM_W * pxPerMm);
  canvas.height = Math.round(A4_MM_H * pxPerMm);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cardWMm = (A4_MM_W - MARGIN_MM * 2 - GAP_X_MM * (COLS - 1)) / COLS;
  const cardHMm = (A4_MM_H - MARGIN_MM * 2 - GAP_Y_MM * (ROWS - 1)) / ROWS;
  const cardW = cardWMm * pxPerMm;
  const cardH = cardHMm * pxPerMm;
  const pad = 5 * pxPerMm;

  for (let idx = 0; idx < cards.length; idx++) {
    const card = cards[idx];
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = (MARGIN_MM + col * (cardWMm + GAP_X_MM)) * pxPerMm;
    const y = (MARGIN_MM + row * (cardHMm + GAP_Y_MM)) * pxPerMm;

    // Borde tarjeta
    ctx.strokeStyle = "#A1A1AA";
    ctx.lineWidth = 0.45 * pxPerMm;
    drawRoundedRect(ctx, x, y, cardW, cardH, 3.6 * pxPerMm);
    ctx.stroke();

    // Encabezado: solo Sucursal (sin badge de rubro)
    const headerY = y + pad + 2.4 * pxPerMm;
    ctx.fillStyle = "#52525B";
    ctx.font = `600 ${Math.round(2.9 * pxPerMm)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(card.branchName.toUpperCase(), x + pad, headerY);

    // QR más grande a la derecha (sin código abajo)
    const qrSize = 33 * pxPerMm;
    const qrX = x + cardW - pad - qrSize;
    const qrY = y + pad + 5.5 * pxPerMm;
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, card.qrPayload, {
      width: Math.round(qrSize),
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#18181B", light: "#FFFFFF" },
    });
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Título, nombre abreviado (mismo tamaño) y subtítulo a la izquierda
    const textMaxW = cardW - pad * 2 - qrSize - 4 * pxPerMm;
    const mainFontPx = Math.round(5.4 * pxPerMm);
    const lineStep = 6.2 * pxPerMm;

    ctx.fillStyle = "#18181B";
    ctx.font = `700 ${mainFontPx}px Inter, system-ui, sans-serif`;
    const titleLines = wrapText(ctx, card.displayTitle, textMaxW);
    let cursorY = y + pad + 12.5 * pxPerMm;
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, x + pad, cursorY);
      cursorY += lineStep;
    }

    // Nombre abreviado debajo del título con el mismo tamaño
    ctx.fillStyle = "#3F3F46";
    ctx.font = `700 ${mainFontPx}px Inter, system-ui, sans-serif`;
    ctx.fillText(card.locationTag, x + pad, cursorY);
    cursorY += lineStep;

    if (card.displaySubtitle) {
      ctx.fillStyle = "#52525B";
      ctx.font = `500 ${Math.round(2.85 * pxPerMm)}px Inter, system-ui, sans-serif`;
      const subLines = wrapText(ctx, card.displaySubtitle, textMaxW);
      let subY = cursorY + 0.5 * pxPerMm;
      for (const line of subLines.slice(0, 2)) {
        ctx.fillText(line, x + pad, subY);
        subY += 3.5 * pxPerMm;
      }
    }

    // Pie de tarjeta: separador + flecha + instrucción
    const footerLineY = y + cardH - pad - 10 * pxPerMm;
    ctx.strokeStyle = "#D4D4D8";
    ctx.lineWidth = 0.3 * pxPerMm;
    ctx.beginPath();
    ctx.moveTo(x + pad, footerLineY);
    ctx.lineTo(x + cardW - pad, footerLineY);
    ctx.stroke();

    const arrow = card.scanDirection === "horizontal" ? "→" : "↓";
    ctx.fillStyle = "#3F3F46";
    ctx.font = `700 ${Math.round(5.4 * pxPerMm)}px Inter, system-ui, sans-serif`;
    ctx.fillText(arrow, x + pad, footerLineY + 5.5 * pxPerMm);

    ctx.fillStyle = "#3F3F46";
    ctx.font = `600 ${Math.round(2.45 * pxPerMm)}px Inter, system-ui, sans-serif`;
    const instrLines = wrapText(ctx, card.scanInstruction, cardW - pad * 2 - 7 * pxPerMm);
    let instrY = footerLineY + 3.8 * pxPerMm;
    for (const line of instrLines.slice(0, 2)) {
      ctx.fillText(line, x + pad + 6.8 * pxPerMm, instrY);
      instrY += 3.1 * pxPerMm;
    }
  }
}

export function InventoryQrLocationsPanel({ defaultBranchName }: { defaultBranchName?: string } = {}) {
  const { user, allBranches } = useUser();
  const isBranchRole = user?.role === "branch";

  const initialBranch = useMemo(() => {
    if (defaultBranchName && defaultBranchName.trim()) return defaultBranchName.trim().toUpperCase();
    if (isBranchRole && user?.branchName) return user.branchName.toUpperCase();
    if (user?.branchName && user.branchName !== "Casa Central") return user.branchName.toUpperCase();
    return (allBranches[0] || "BELGRANO").toUpperCase();
  }, [defaultBranchName, isBranchRole, user?.branchName, allBranches]);

  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranch);

  useEffect(() => {
    if (defaultBranchName && defaultBranchName.trim() && !isBranchRole) {
      setSelectedBranch(defaultBranchName.trim().toUpperCase());
    }
  }, [defaultBranchName, isBranchRole]);
  const [branchIdMap, setBranchIdMap] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<LocationGroupConfig[]>([
    {
      id: "grp_default_1",
      prefix: "GON",
      categoryBadge: "PERFUMERÍA",
      unitCount: 3,
      facesPreset: "none",
      direction: "vertical",
      excludedTags: [],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (supabase as any)
      .from("branches")
      .select("id, name")
      .then(({ data }: any) => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((b: any) => {
            if (b.name && b.id) map[String(b.name).trim().toUpperCase()] = b.id;
          });
          setBranchIdMap(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchBranchLocations(selectedBranch)
      .then((items) => {
        if (!active) return;
        if (items.length > 0) {
          setGroups(collapseLocationsToGroups(items));
        }
        setPageIndex(0);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedBranch]);

  const expandedAll = useMemo(
    () => expandLocationGroups(selectedBranch, groups),
    [selectedBranch, groups]
  );

  const activeLocations = useMemo(
    () => expandedAll.filter((l) => l.isActive),
    [expandedAll]
  );

  const totalPages = Math.max(1, Math.ceil(activeLocations.length / CARDS_PER_PAGE));

  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(Math.max(0, totalPages - 1));
  }, [pageIndex, totalPages]);

  const currentPageCards = useMemo(() => {
    const start = pageIndex * CARDS_PER_PAGE;
    return activeLocations.slice(start, start + CARDS_PER_PAGE);
  }, [activeLocations, pageIndex]);

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    void renderA4PageToCanvas(previewCanvasRef.current, currentPageCards, 3.6);
  }, [currentPageCards]);

  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}_${prev.length}`,
        prefix: "ESP",
        categoryBadge: "MEDICAMENTOS",
        unitCount: 2,
        facesPreset: "none",
        direction: "vertical",
        excludedTags: [],
      },
    ]);
  };

  const updateGroup = (id: string, patch: Partial<LocationGroupConfig>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleExcludedTag = (tag: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        const list = g.excludedTags || [];
        const exists = list.includes(tag);
        const belongsHere = expandLocationGroups(selectedBranch, [{ ...g, excludedTags: [] }]).some(
          (it) => it.locationTag === tag
        );
        if (!belongsHere) return g;
        return {
          ...g,
          excludedTags: exists ? list.filter((t) => t !== tag) : [...list, tag],
        };
      })
    );
  };

  const handleSaveToSupabase = async () => {
    setIsSaving(true);
    try {
      const branchId = branchIdMap[selectedBranch.toUpperCase()] || user?.branchId || null;
      const res = await saveBranchLocations(selectedBranch, branchId, expandedAll, user?.id);
      if (res.ok) {
        notify.success(
          "Ubicaciones guardadas",
          `${res.count} ubicaciones vigentes sincronizadas en Supabase para ${selectedBranch}.`
        );
      } else {
        notify.error("Error al guardar", res.error || "No se pudo guardar en Supabase.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = async () => {
    if (activeLocations.length === 0) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const offscreen = document.createElement("canvas");
      for (let p = 0; p < totalPages; p++) {
        if (p > 0) doc.addPage();
        const slice = activeLocations.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
        await renderA4PageToCanvas(offscreen, slice, 7.5);
        const imgData = offscreen.toDataURL("image/png");
        doc.addImage(imgData, "PNG", 0, 0, A4_MM_W, A4_MM_H);
      }
      doc.save(`QR_Ubicaciones_${selectedBranch}.pdf`);
      notify.success("PDF generado", `Hoja A4 (2×3) descargada con ${activeLocations.length} QR.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    if (activeLocations.length === 0) return;
    setIsExporting(true);
    try {
      const offscreen = document.createElement("canvas");
      const dataUrls: string[] = [];
      for (let p = 0; p < totalPages; p++) {
        const slice = activeLocations.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
        await renderA4PageToCanvas(offscreen, slice, 7.5);
        dataUrls.push(offscreen.toDataURL("image/png"));
      }
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(
        `<html><head><title>QR ${selectedBranch}</title><style>@page{size:A4 portrait;margin:0}body{margin:0}img{width:210mm;height:297mm;page-break-after:always;display:block}</style></head><body>${dataUrls
          .map((src) => `<img src="${src}" />`)
          .join("")}<script>window.onload=()=>{window.print();}</script></body></html>`
      );
      win.document.close();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera Sucursal + Resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <QrCode className="size-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {activeLocations.length} ubicaciones vigentes en {selectedBranch}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {totalPages} {totalPages === 1 ? "hoja A4" : "hojas A4"} (2 columnas × 3 filas)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isBranchRole && allBranches.length > 0 && (
            <Select
              value={selectedBranch}
              onValueChange={(v) => setSelectedBranch(v.toUpperCase())}
            >
              <SelectTrigger className="w-44" placeholder="Sucursal" />
              <SelectContent>
                {allBranches.map((b, i) => (
                  <SelectItem key={b} index={i} value={b.toUpperCase()}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            onClick={handleSaveToSupabase}
            disabled={isSaving || isLoading}
            className="gap-1.5"
          >
            <Save className="size-3.5" />
            {isSaving ? "Guardando..." : "Guardar en Supabase"}
          </Button>
        </div>
      </div>

      {/* Constructor de muebles */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">
            Muebles y sectores de la sucursal
          </span>
          <Button size="sm" variant="outline" onClick={addGroup} className="gap-1.5">
            <Plus className="size-3.5" />
            Agregar mueble
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {groups.map((grp) => (
            <div
              key={grp.id}
              className="grid grid-cols-1 gap-2 rounded-xl border border-border/60 bg-background p-3 sm:grid-cols-12 sm:items-center"
            >
              <div className="sm:col-span-5">
                <Select
                  value={grp.prefix}
                  onValueChange={(val) => updateGroup(grp.id, { prefix: val })}
                >
                  <SelectTrigger placeholder="Mueble" />
                  <SelectContent>
                    {FARMAPLUS_SECTORS.map((sec, idx) => (
                      <SelectItem key={sec.prefix} index={idx} value={sec.prefix}>
                        {sec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-3">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={grp.unitCount}
                  onChange={(e) =>
                    updateGroup(grp.id, { unitCount: Math.max(1, Number(e.target.value) || 1) })
                  }
                  aria-label="Cantidad de unidades"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:col-span-4">
                <Select
                  value={grp.direction}
                  onValueChange={(val) =>
                    updateGroup(grp.id, { direction: val as ScanDirection })
                  }
                >
                  <SelectTrigger placeholder="Sentido" />
                  <SelectContent>
                    <SelectItem index={0} value="vertical">↓ Vertical</SelectItem>
                    <SelectItem index={1} value="horizontal">→ Horizontal</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeGroup(grp.id)}
                  aria-label="Eliminar mueble"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chips de posiciones generadas (clic para activar/excluir cara puntual) */}
      {expandedAll.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted-foreground">
            Clic en una posición para excluirla si no existe físicamente:
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto rounded-lg border border-border/50 p-2">
            {expandedAll.map((loc) => (
              <button
                key={loc.locationTag}
                type="button"
                onClick={() => toggleExcludedTag(loc.locationTag)}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-mono transition ${
                  loc.isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground line-through opacity-60"
                }`}
              >
                {loc.locationTag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vista previa Canvas A4 (2x4) + Descarga / Impresión */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-[12px] font-medium text-foreground">
              Hoja A4 {pageIndex + 1} de {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={isExporting || activeLocations.length === 0}
              className="gap-1.5"
            >
              <Printer className="size-3.5" />
              Imprimir A4
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting || activeLocations.length === 0}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              {isExporting ? "Generando..." : "Descargar PDF A4"}
            </Button>
          </div>
        </div>

        <div className="flex justify-center overflow-auto rounded-lg bg-zinc-200/70 p-3 dark:bg-zinc-900/60">
          <canvas
            ref={previewCanvasRef}
            className="max-w-full rounded bg-white shadow-md"
            style={{ width: "min(100%, 540px)", height: "auto" }}
          />
        </div>
      </div>
    </div>
  );
}

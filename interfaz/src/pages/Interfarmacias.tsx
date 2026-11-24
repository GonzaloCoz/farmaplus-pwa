"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  useDataTable,
  DataTable,
  DataTableColumnHeader,
  DataTableTitle,
  DataTableSearch,
  DataTableFilters,
  DataTableFilterChips,
  DataTableViewOptions,
  DataTablePagination,
  DataTableSelectionBar,
  selectColumn,
  rowActionsColumn,
  useUndoableRows,
  type ColumnDef,
} from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/menu-item";
import { Tooltip, TooltipGroup } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDataTransferHorizontalIcon from "@hugeicons/core-free-icons/ArrowDataTransferHorizontalIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import CheckIcon from "@hugeicons/core-free-icons/CheckIcon";
import Clock05Icon from "@hugeicons/core-free-icons/Clock05Icon";
import SearchCheckIcon from "@hugeicons/core-free-icons/SearchCheckIcon";
import { useIcons } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import { typeClass, useSize } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { UndoToaster, showUndoToast } from "@/components/undo-toast";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import {
  fetchInterfarmaciasMesActual,
  markInterfarmaciasAudited,
  type EstadoInterfarmacia,
  type InterfarmaciaRow,
} from "@/services/interfarmaciasService";
import type { Row } from "@tanstack/react-table";

export type { EstadoInterfarmacia, InterfarmaciaRow };

// Datos de muestra alineados al modelo real de onze_center.envios / envioslineas
const MOCK_ROWS: InterfarmaciaRow[] = [
  {
    id: "300006696",
    nroEnvio: "300006696",
    fechaRecepcion: "",
    sucursalOrigen: "Villa del Parque",
    sucursalDestino: "Devoto",
    estado: "En tránsito",
    totalSkus: 14,
    unidadesEnviadas: 38,
    unidadesRecibidas: null,
    fechaEnvio: "2026-11-20 18:21",
    usuarioEnvio: "SCIGLIANODELA",
    usuarioRecepcion: null,
    tags: ["Sin recepción", "Hoy"],
    observacion: "Reposición urgente de medicamentos éticos y perfumería.",
  },
  {
    id: "260009124",
    nroEnvio: "260009124",
    fechaRecepcion: "",
    sucursalOrigen: "Belgrano VI",
    sucursalDestino: "Belgrano VII",
    estado: "En tránsito",
    totalSkus: 9,
    unidadesEnviadas: 21,
    unidadesRecibidas: null,
    fechaEnvio: "2026-11-18 14:35",
    usuarioEnvio: "MARTINEZLUIS",
    usuarioRecepcion: null,
    tags: ["Sin recepción", "+48 hs"],
    observacion: "Pendiente de recepción en sucursal destino.",
  },
  {
    id: "400003310",
    nroEnvio: "400003310",
    fechaRecepcion: "2026-11-19 16:48",
    sucursalOrigen: "Villa Crespo",
    sucursalDestino: "Palermo",
    estado: "Con diferencia",
    totalSkus: 18,
    unidadesEnviadas: 54,
    unidadesRecibidas: 51,
    fechaEnvio: "2026-11-19 13:15",
    usuarioEnvio: "GOMEZCARLA",
    usuarioRecepcion: "PEREZSOFIA",
    tags: ["Faltante (-3 u.)", "Revisar"],
    observacion: "Faltaron 3 unidades de Sertal Compuesto VL al abrir la caja.",
  },
  {
    id: "530021143",
    nroEnvio: "530021143",
    fechaRecepcion: "2026-11-19 12:33",
    sucursalOrigen: "Belgrano VII",
    sucursalDestino: "Recoleta",
    estado: "Recibido",
    totalSkus: 22,
    unidadesEnviadas: 65,
    unidadesRecibidas: 65,
    fechaEnvio: "2026-11-19 12:15",
    usuarioEnvio: "PEREZSOFIA",
    usuarioRecepcion: "ACOSTATOMAS",
    tags: ["Completo"],
    observacion: "Recepción confirmada sin diferencias en Plex.",
  },
  {
    id: "240001905",
    nroEnvio: "240001905",
    fechaRecepcion: "",
    sucursalOrigen: "Beccar",
    sucursalDestino: "San Isidro",
    estado: "En tránsito",
    totalSkus: 6,
    unidadesEnviadas: 12,
    unidadesRecibidas: null,
    fechaEnvio: "2026-11-17 11:20",
    usuarioEnvio: "RODRIGUEZANA",
    usuarioRecepcion: null,
    tags: ["Sin recepción", "+72 hs", "Psicotrópicos"],
    observacion: "Alerta de demora: supera las 72 hs sin recepción registrada.",
  },
  {
    id: "200008451",
    nroEnvio: "200008451",
    fechaRecepcion: "2026-11-18 17:05",
    sucursalOrigen: "Caballito",
    sucursalDestino: "Flores",
    estado: "Auditado",
    totalSkus: 11,
    unidadesEnviadas: 27,
    unidadesRecibidas: 27,
    fechaEnvio: "2026-11-18 15:10",
    usuarioEnvio: "DIAZMARCOS",
    usuarioRecepcion: "TORRESLUCIA",
    tags: ["Auditado", "Jorge Gallegos"],
    observacion: "Controlado y cerrado por auditoría de interfarmacias.",
  },
  {
    id: "540005109",
    nroEnvio: "540005109",
    fechaRecepcion: "2026-11-19 14:12",
    sucursalOrigen: "Palermo II",
    sucursalDestino: "Palermo III",
    estado: "Recibido",
    totalSkus: 8,
    unidadesEnviadas: 19,
    unidadesRecibidas: 19,
    fechaEnvio: "2026-11-19 13:37",
    usuarioEnvio: "FERNANDEZJULI",
    usuarioRecepcion: "GOMEZCARLA",
    tags: ["Completo"],
    observacion: "FOLDER DERMO",
  },
  {
    id: "600002218",
    nroEnvio: "600002218",
    fechaRecepcion: "",
    sucursalOrigen: "Chacarita",
    sucursalDestino: "Colegiales",
    estado: "En tránsito",
    totalSkus: 5,
    unidadesEnviadas: 15,
    unidadesRecibidas: null,
    fechaEnvio: "2026-11-20 11:05",
    usuarioEnvio: "LOPEZNAHUEL",
    usuarioRecepcion: null,
    tags: ["Sin recepción", "Hoy"],
    observacion: "Despachado en primer turno de cadetería.",
  },
  {
    id: "70006033",
    nroEnvio: "70006033",
    fechaRecepcion: "2026-11-18 19:22",
    sucursalOrigen: "Belgrano",
    sucursalDestino: "Núñez",
    estado: "Con diferencia",
    totalSkus: 16,
    unidadesEnviadas: 42,
    unidadesRecibidas: 41,
    fechaEnvio: "2026-11-18 16:40",
    usuarioEnvio: "SANCHEZPAULA",
    usuarioRecepcion: "CAROLCAMILA",
    tags: ["Faltante (-1 u.)", "Pendiente descargo"],
    observacion: "Diferencia de 1 unidad en Actron 600 x 20; se consultó a origen.",
  },
  {
    id: "130009512",
    nroEnvio: "130009512",
    fechaRecepcion: "2026-11-17 18:14",
    sucursalOrigen: "Recoleta III",
    sucursalDestino: "Recoleta IV",
    estado: "Auditado",
    totalSkus: 25,
    unidadesEnviadas: 80,
    unidadesRecibidas: 80,
    fechaEnvio: "2026-11-17 16:02",
    usuarioEnvio: "SILVAGABRIEL",
    usuarioRecepcion: "DIAZMARCOS",
    tags: ["Auditado", "Jorge Gallegos"],
    observacion: "Transferencia de sobrestock validada sin observaciones.",
  },
  {
    id: "290003874",
    nroEnvio: "290003874",
    fechaRecepcion: "2026-11-19 15:40",
    sucursalOrigen: "Villa Urquiza",
    sucursalDestino: "Villa Urquiza II",
    estado: "Recibido",
    totalSkus: 10,
    unidadesEnviadas: 24,
    unidadesRecibidas: 24,
    fechaEnvio: "2026-11-19 14:55",
    usuarioEnvio: "TORRESLUCIA",
    usuarioRecepcion: "MORALESDIEGO",
    tags: ["Completo"],
    observacion: "Recibido en el mismo día.",
  },
  {
    id: "360004490",
    nroEnvio: "360004490",
    fechaRecepcion: "",
    sucursalOrigen: "Berazategui",
    sucursalDestino: "Quilmes",
    estado: "En tránsito",
    totalSkus: 12,
    unidadesEnviadas: 33,
    unidadesRecibidas: null,
    fechaEnvio: "2026-11-20 10:18",
    usuarioEnvio: "MORALESDIEGO",
    usuarioRecepcion: null,
    tags: ["Sin recepción", "Hoy"],
    observacion: "En camino con logística zona sur.",
  },
];

const EXTRA_SUCURSALES = [
  [17, "Retiro"], [15, "Palermo"], [22, "Flores"], [21, "Caballito II"],
  [18, "Núñez"], [11, "Pompeya"], [10, "Recoleta"], [12, "Devoto"],
  [25, "San Isidro II"], [9, "Caballito III"], [24, "Beccar"], [26, "Belgrano VI"],
  [27, "Microcentro"], [5, "Recoleta IV"], [13, "Recoleta III"], [20, "Caballito"],
  [37, "Quilmes"], [30, "Villa del Parque"], [29, "Villa Urquiza"], [28, "Belgrano V"],
  [23, "San Isidro"], [36, "Berazategui"], [32, "Villa Urquiza III"], [46, "San Miguel"],
  [40, "Villa Crespo"], [48, "Parque Centenario"], [49, "Pilar"], [38, "Belgrano IV"],
  [45, "Villa Ballester II"], [55, "Belgrano VIII"], [54, "Palermo II"], [59, "Palermo III"],
  [58, "Villa Luro"], [60, "Chacarita"], [61, "González Catán"], [65, "Boedo"],
  [63, "Ramos Mejía II"], [62, "Morón"], [64, "Ramos Mejía"], [66, "Devoto II"],
  [53, "Belgrano VII"], [75, "Devoto III"], [74, "Palermo IV"], [56, "Caballito IV"],
] as const;

const EXTRA_USERS = [
  "SCIGLIANODELA", "DELCARPIOCARLO", "KAHALEIARA", "MARTINEZLUIS",
  "GOMEZCARLA", "PEREZSOFIA", "DIAZMARCOS", "LOPEZNAHUEL",
  "SANCHEZPAULA", "TORRESLUCIA", "MORALESDIEGO", "FERNANDEZJULI",
];

const EXTRA_OBS: Record<EstadoInterfarmacia, string[]> = {
  "En tránsito": [
    "Despachado por cadetería interna, aguardando confirmación en destino.",
    "Reposición de faltante solicitada por zonal.",
    "FOLDER DERMO",
    "Pendiente de recepción en sucursal destino.",
  ],
  "Recibido": [
    "Recepción confirmada sin diferencias en Plex.",
    "Ingresado en el mismo día por turno tarde.",
    "Controlado al abrir bulto, cantidades exactas.",
    "Transferencia cerrada correctamente en destino.",
  ],
  "Con diferencia": [
    "Diferencia al controlar bulto; se pidió revisión a sucursal origen.",
    "Faltó mercadería en el envío, pendiente de regularización.",
    "Unidades recibidas menores al envío original.",
  ],
  "Auditado": [
    "Validado y cerrado por auditoría de interfarmacias.",
    "Controlado sin desvíos por Jorge Gallegos.",
    "Seguimiento documentado y cierre conforme.",
  ],
  "Anulado": [
    "Envío anulado en sucursal origen.",
  ],
};

const GENERATED_ROWS: InterfarmaciaRow[] = Array.from({ length: 53 }, (_, i) => {
  const [oriId, oriName] = EXTRA_SUCURSALES[(i * 7 + 3) % EXTRA_SUCURSALES.length];
  const [, desName] = EXTRA_SUCURSALES[(i * 11 + 13) % EXTRA_SUCURSALES.length === (i * 7 + 3) % EXTRA_SUCURSALES.length ? (i * 11 + 14) % EXTRA_SUCURSALES.length : (i * 11 + 13) % EXTRA_SUCURSALES.length];
  const estados: EstadoInterfarmacia[] = ["Recibido", "En tránsito", "Recibido", "Auditado", "En tránsito", "Con diferencia", "Recibido", "Auditado"];
  const estado = estados[i % estados.length];
  const day = Math.max(1, 20 - Math.floor((i + 2) / 3));
  const envHour = 9 + ((i * 5) % 10);
  const envMin = (i * 13) % 60;
  const fechaEnvio = `2026-11-${String(day).padStart(2, "0")} ${String(envHour).padStart(2, "0")}:${String(envMin).padStart(2, "0")}`;
  const recDay = Math.min(20, day + (i % 2));
  const recHour = recDay === day ? Math.min(21, envHour + 1 + (i % 3)) : 9 + ((i * 3) % 8);
  const recMin = (envMin + 17 + i * 7) % 60;
  const fechaRecepcion =
    estado === "En tránsito"
      ? ""
      : `2026-11-${String(recDay).padStart(2, "0")} ${String(recHour).padStart(2, "0")}:${String(recMin).padStart(2, "0")}`;
  const nroEnvio = `${oriId}${String(5100 + i * 37).padStart(7, "0")}`;
  const totalSkus = 3 + ((i * 5) % 24);
  const unidadesEnviadas = totalSkus * 2 + ((i * 3) % 19);
  const diff = estado === "Con diferencia" ? 1 + (i % 4) : 0;
  const unidadesRecibidas = estado === "En tránsito" ? null : Math.max(1, unidadesEnviadas - diff);
  const tags =
    estado === "En tránsito"
      ? day <= 17 ? ["Sin recepción", "+72 hs"] : day <= 18 ? ["Sin recepción", "+48 hs"] : ["Sin recepción"]
      : estado === "Con diferencia"
        ? [`Faltante (-${diff} u.)`, "Revisar"]
        : estado === "Auditado"
          ? ["Auditado", "Jorge Gallegos"]
          : ["Completo"];
  const obsList = EXTRA_OBS[estado];

  return {
    id: nroEnvio,
    nroEnvio,
    fechaRecepcion,
    sucursalOrigen: oriName,
    sucursalDestino: desName,
    estado,
    totalSkus,
    unidadesEnviadas,
    unidadesRecibidas,
    fechaEnvio,
    usuarioEnvio: EXTRA_USERS[i % EXTRA_USERS.length],
    usuarioRecepcion: estado === "En tránsito" ? null : EXTRA_USERS[(i + 5) % EXTRA_USERS.length],
    tags,
    observacion: obsList[i % obsList.length],
  };
});

const SAMPLE_SKUS = [
  { ean: "7795345124230", idProducto: "1004520118", costoPPP: 8420.5, prod: "SERTAL COMPUESTO VL comp.rec.x 10", lab: "ROEMMERS", rubro: "Medicamentos", tag: "Ético" },
  { ean: "7793640215622", idProducto: "1011890420", costoPPP: 6190.25, prod: "ACTRON 600 RAPIDA ACCION caps.x 20", lab: "BAYER CONSUMER", rubro: "Medicamentos", tag: "Venta libre" },
  { ean: "7795338001425", idProducto: "1002910034", costoPPP: 4850.0, prod: "CLONAGIN 0.5 mg comp.x 30", lab: "BALIARDA", rubro: "Medicamentos", tag: "Psicotrópico" },
  { ean: "7795345011493", idProducto: "1029400157", costoPPP: 14320.8, prod: "SESAREN 50 mg comp.x 30", lab: "ROEMMERS", rubro: "Medicamentos", tag: "Psicotrópico" },
  { ean: "7796285048761", idProducto: "1049800085", costoPPP: 11240.4, prod: "PROGEST caps.blandas x 30", lab: "ELEA", rubro: "Medicamentos", tag: "Ético" },
  { ean: "7791293049014", idProducto: "1087120611", costoPPP: 5980.0, prod: "DOVE MASC 1 MINUT REPARACION x 300g", lab: "UNILEVER", rubro: "Perfumería", tag: "Perfumería" },
  { ean: "7798033010440", idProducto: "1093040209", costoPPP: 1640.9, prod: "FARMAPLUS SOLUCION FISIOLOGICA x 100ml", lab: "SUFARMA", rubro: "Accesorios", tag: "Marca propia" },
  { ean: "7795327061997", idProducto: "1008740512", costoPPP: 9750.3, prod: "ACIFOL B12 comp.x 60", lab: "DOMÍNGUEZ", rubro: "Medicamentos", tag: "Ético" },
  { ean: "7702018037865", idProducto: "1075210388", costoPPP: 12890.0, prod: "GILLETTE MACH3 SENSITIVE CART x 2", lab: "NEW PGA S.R.L.", rubro: "Perfumería", tag: "Perfumería" },
  { ean: "7798074620776", idProducto: "1036180074", costoPPP: 3910.6, prod: "DICLOMAR 75 mg comp.x 10", lab: "CASASCO", rubro: "Medicamentos", tag: "Ético" },
  { ean: "7796363003828", idProducto: "1052090193", costoPPP: 18450.75, prod: "MONTAIR 10 mg comp.rec.x 30", lab: "BIOTENK", rubro: "Medicamentos", tag: "Trazable" },
  { ean: "6902395970071", idProducto: "1098450721", costoPPP: 24600.0, prod: "MAYBELLINE SUPERSTAY LUMI MATTE 120", lab: "L'ORÉAL", rubro: "Perfumería", tag: "Dermocosm." },
];

function buildSkuSubRows(parent: InterfarmaciaRow, seed: number): InterfarmaciaRow[] {
  const count = Math.min(5, Math.max(3, parent.totalSkus % 6 || 4));
  let remEnv = parent.unidadesEnviadas;
  const totalDiff =
    parent.unidadesRecibidas !== null ? Math.max(0, parent.unidadesEnviadas - parent.unidadesRecibidas) : 0;

  return Array.from({ length: count }, (_, idx) => {
    const sku = SAMPLE_SKUS[(seed * 3 + idx * 5) % SAMPLE_SKUS.length];
    const isLast = idx === count - 1;
    const env = isLast ? Math.max(1, remEnv) : Math.max(1, Math.round(remEnv / (count - idx)));
    remEnv = Math.max(0, remEnv - env);
    const itemDiff = idx === 0 && totalDiff > 0 ? Math.min(env, totalDiff) : 0;
    const rec = parent.unidadesRecibidas === null ? null : Math.max(0, env - itemDiff);
    const itemEstado: EstadoInterfarmacia =
      parent.estado === "En tránsito"
        ? "En tránsito"
        : itemDiff > 0
          ? "Con diferencia"
          : parent.estado === "Auditado"
            ? "Auditado"
            : "Recibido";

    return {
      id: `${parent.id}::${sku.ean}-${idx}`,
      nroEnvio: sku.ean,
      idProducto: sku.idProducto,
      costoPPP: sku.costoPPP,
      fechaRecepcion: sku.rubro,
      sucursalOrigen: sku.prod,
      sucursalDestino: sku.lab,
      estado: itemEstado,
      totalSkus: 1,
      unidadesEnviadas: env,
      unidadesRecibidas: rec,
      fechaEnvio: parent.fechaEnvio,
      usuarioEnvio: parent.usuarioEnvio,
      usuarioRecepcion: parent.usuarioRecepcion,
      tags: itemDiff > 0 ? [sku.tag, `Faltante (-${itemDiff} u.)`] : [sku.tag],
      observacion:
        itemDiff > 0
          ? `Faltaron ${itemDiff} u. al controlar bulto (Envío ${parent.nroEnvio}).`
          : `Lote 26${String.fromCharCode(65 + ((seed + idx) % 12))}${10 + idx} · Vto ${String(1 + ((seed + idx) % 12)).padStart(2, "0")}/2027`,
      isSubRow: true,
    };
  });
}

const ALL_MOCK_ROWS: InterfarmaciaRow[] = [...MOCK_ROWS, ...GENERATED_ROWS].map((row, idx) => ({
  ...row,
  subRows: buildSkuSubRows(row, idx + 1),
}));

const ESTADO_COLOR: Record<EstadoInterfarmacia, "amber" | "green" | "red" | "blue" | "zinc"> = {
  "En tránsito": "amber",
  "Recibido": "green",
  "Con diferencia": "red",
  "Auditado": "blue",
  "Anulado": "zinc",
};

const ESTADO_OPTIONS = Object.entries(ESTADO_COLOR).map(([value, color]) => ({ value, color }));

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function splitDateTimeEs(iso: string): { dateLabel: string; timeLabel: string | null } {
  if (!iso) return { dateLabel: "", timeLabel: null };
  const [datePart, timePart] = iso.trim().split(/[T ]/);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return { dateLabel: iso, timeLabel: null };
  const day = DAYS_ES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = y === new Date().getUTCFullYear() ? "" : `, ${y}`;
  return {
    dateLabel: `${day} ${d} ${MONTHS_ES[m - 1]}${year}`,
    timeLabel: timePart ? timePart.slice(0, 5) : null,
  };
}

function formatDayEs(iso: string) {
  const { dateLabel, timeLabel } = splitDateTimeEs(iso);
  return timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel;
}

function DateTimeCell({ value }: { value: string }) {
  const { dateLabel, timeLabel } = splitDateTimeEs(value);
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums whitespace-nowrap">
      <span>{dateLabel}</span>
      {timeLabel && <span className="text-muted-foreground">{timeLabel}</span>}
    </span>
  );
}

const ARS_FORMAT = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCostoPPP(value: number) {
  return ARS_FORMAT.format(value);
}

function formatInterfarmaciaContext(row: Row<InterfarmaciaRow>): string {
  const item = row.original;
  const diff =
    item.unidadesRecibidas !== null ? item.unidadesRecibidas - item.unidadesEnviadas : null;
  const diffText = diff !== null && diff !== 0 ? ` (Dif: ${diff > 0 ? `+${diff}` : diff} u.)` : "";

  if (row.depth > 0) {
    const parent = row.getParentRow()?.original;
    const lines = [
      `${item.sucursalOrigen} (${item.sucursalDestino})`,
      `EAN: ${item.nroEnvio}${item.idProducto ? ` | IDProducto: ${item.idProducto}` : ""}${item.costoPPP !== undefined ? ` | Costo PPP: ${formatCostoPPP(item.costoPPP)}` : ""}`,
      parent
        ? `Interfarmacia Envío ${parent.nroEnvio} (${parent.sucursalOrigen} → ${parent.sucursalDestino} · Envío: ${formatDayEs(parent.fechaEnvio)} · Recepción: ${parent.fechaRecepcion ? formatDayEs(parent.fechaRecepcion) : "Pendiente"})`
        : null,
      `Estado: ${item.estado} | Enviadas: ${item.unidadesEnviadas} · Recibidas: ${item.unidadesRecibidas ?? "Pendiente"}${diffText}`,
      item.observacion ? `Obs: ${item.observacion}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  }

  const lines = [
    `Interfarmacia Envío ${item.nroEnvio} (${formatDayEs(item.fechaEnvio)})`,
    `${item.sucursalOrigen} → ${item.sucursalDestino} | Recepción: ${item.fechaRecepcion ? formatDayEs(item.fechaRecepcion) : "Pendiente"}`,
    `Estado: ${item.estado} | ${item.totalSkus} SKUs · Enviadas: ${item.unidadesEnviadas} · Recibidas: ${item.unidadesRecibidas ?? "Pendiente"}${diffText}`,
    item.observacion ? `Obs: ${item.observacion}` : null,
  ];

  const diffSubs = (item.subRows ?? []).filter(
    (s) => s.unidadesRecibidas !== null && s.unidadesRecibidas !== s.unidadesEnviadas
  );
  if (diffSubs.length > 0) {
    lines.push("Detalle con diferencia:");
    for (const s of diffSubs) {
      const sDiff = (s.unidadesRecibidas ?? 0) - s.unidadesEnviadas;
      lines.push(
        `• ${s.sucursalOrigen} (EAN ${s.nroEnvio}): ${s.unidadesEnviadas} env. / ${s.unidadesRecibidas} rec. (${sDiff > 0 ? `+${sDiff}` : sDiff} u.)`
      );
    }
  }

  return lines.filter(Boolean).join("\n");
}

function sendContextToChat(text: string, targetBranch?: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
  window.dispatchEvent(new CustomEvent("miplus:open-chat-context", { detail: { text, targetBranch } }));
}

function copyContextToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
  notify.success("Contexto copiado", "Listo para pegar en el chat interno.");
}

const CHIP_RADIUS = { pill: "rounded-full", rounded: "rounded-md", sharp: "rounded-[1px]" };

/** Hugeicons ShippingTruck01 / DeliveryTruck01 / SearchTruck / ErrorTruck en estilo duotone real (relleno cerrado + ruedas huecas). */
function DuotoneTruckIcon({
  variant,
  className,
}: {
  variant: "shipping" | "delivery" | "search" | "error";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* Relleno duotone cerrado de caja y cabina */}
      <path
        d="M2 7C2 5.58579 2 4.87868 2.43934 4.43934C2.87868 4 3.58579 4 5 4H12C13.4142 4 14.1213 4 14.5607 4.43934C15 4.87868 15 5.58579 15 7V17.5H4.5C3.56538 17.5 3.09808 17.5 2.75 17.299C2.52197 17.1674 2.33261 16.978 2.20096 16.75C2 16.4019 2 15.9346 2 15V7Z"
        fill="currentColor"
        fillOpacity={0.22}
      />
      <path
        d="M15 6.5H15.5C19.0899 6.5 22 9.41015 22 13V15.7632C22 15.9831 22 16.0931 21.9885 16.1855C21.9036 16.8669 21.3669 17.4036 20.6855 17.4885C20.5931 17.5 20.4831 17.5 20.2632 17.5H15V6.5Z"
        fill="currentColor"
        fillOpacity={0.22}
      />
      {/* Trazos originales Hugeicons */}
      {variant === "delivery" ? (
        <>
          <path
            d="M14.5 17.5H9.5M19.5 17.5H20.2632C20.4831 17.5 20.5931 17.5 20.6855 17.4885C21.3669 17.4036 21.9036 16.8669 21.9885 16.1855C22 16.0931 22 15.9831 22 15.7632V13C22 9.41015 19.0899 6.5 15.5 6.5M2 4H12C13.4142 4 14.1213 4 14.5607 4.43934C15 4.87868 15 5.58579 15 7V15.5M2 12.75V15C2 15.9346 2 16.4019 2.20096 16.75C2.33261 16.978 2.52197 17.1674 2.75 17.299C3.09808 17.5 3.56538 17.5 4.5 17.5"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 7H8M2 10H6"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <path
          d="M14.5 17.5H9.5M19.5 17.5H20.2632C20.4831 17.5 20.5931 17.5 20.6855 17.4885C21.3669 17.4036 21.9036 16.8669 21.9885 16.1855C22 16.0931 22 15.9831 22 15.7632V13C22 9.41015 19.0899 6.5 15.5 6.5M15 15.5V7C15 5.58579 15 4.87868 14.5607 4.43934C14.1213 4 13.4142 4 12 4H5C3.58579 4 2.87868 4 2.43934 4.43934C2 4.87868 2 5.58579 2 7V15C2 15.9346 2 16.4019 2.20096 16.75C2.33261 16.978 2.52197 17.1674 2.75 17.299C3.09808 17.5 3.56538 17.5 4.5 17.5"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Lupa de auditoría (SearchTruck) */}
      {variant === "search" && (
        <>
          <circle cx={8} cy={9.75} r={2.35} fill="var(--background)" stroke="currentColor" strokeWidth={1.6} />
          <path d="M9.8 11.55L11.5 13.25" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </>
      )}
      {/* Cruz de diferencia (Cancel01 / Cross Hugeicons) */}
      {variant === "error" && (
        <path
          d="M6.6 8.6L10.4 12.4M10.4 8.6L6.6 12.4"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Ruedas huecas (recortan el relleno de la carrocería limpiamente) */}
      <circle cx={17} cy={17.5} r={2.5} fill="var(--background)" stroke="currentColor" strokeWidth={1.75} />
      <circle cx={7} cy={17.5} r={2.5} fill="var(--background)" stroke="currentColor" strokeWidth={1.75} />
    </svg>
  );
}

function TagChips({ tags }: { tags: string[] }) {
  const shape = useShape();
  const compact = useSize().variant === "compact";
  return (
    <span className="flex h-[1lh] min-w-0 items-center gap-1 overflow-x-clip [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent)]">
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex shrink-0 items-center bg-hover px-2 text-foreground",
            CHIP_RADIUS[shape.variant],
            compact ? "h-5" : "h-6",
            typeClass("caption", compact ? "compact" : "default")
          )}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

function removeRows(list: InterfarmaciaRow[], ids: readonly string[]): InterfarmaciaRow[] {
  return list
    .filter((r) => !ids.includes(r.id))
    .map((r) => (r.subRows ? { ...r, subRows: removeRows(r.subRows, ids) } : r));
}

export default function Interfarmacias() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const history = useUndoableRows<InterfarmaciaRow>(ALL_MOCK_ROWS, { getId: (r) => r.id });
  const rows = history.rows;
  const { apply, undoTo, stepCount } = history;
  const stepCountRef = useRef(stepCount);
  useEffect(() => {
    stepCountRef.current = stepCount;
  });

  const loadFromSupabase = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      const res = await fetchInterfarmaciasMesActual();
      if (!res.error && res.rows.length > 0) {
        const origenLabel = res.source === "plex" ? "Plex (onze_center)" : "Supabase";
        startTransition(() => {
          apply(`Sincronizado desde ${origenLabel}`, () => res.rows);
          setIsLiveData(true);
          setLastSyncedAt(res.lastSyncedAt);
        });
        if (manual) {
          notify.success(
            "Interfarmacias actualizados",
            `${res.rows.length.toLocaleString("es-AR")} envíos del mes cargados desde ${origenLabel}.`
          );
        }
      } else if (manual) {
        notify.info(
          "Sin datos sincronizados todavía",
          res.error
            ? `No se pudo leer desde Plex ni Supabase (${res.error}).`
            : "No hay envíos cargados para el mes actual."
        );
      }
      setRefreshing(false);
      startTransition(() => setLoading(false));
    },
    [apply]
  );

  useEffect(() => {
    void loadFromSupabase(false);
  }, [loadFromSupabase]);

  const deleteRows = useCallback(
    (ids: string[], label: string) => {
      const before = stepCountRef.current;
      apply(label, (old) => removeRows(old, ids));
      showUndoToast(label, () => undoTo(before));
    },
    [apply, undoTo]
  );

  const markAudited = useCallback(
    (ids: string[], label: string) => {
      const before = stepCountRef.current;
      apply(label, (old) =>
        old.map((r) =>
          ids.includes(r.id)
            ? {
                ...r,
                estado: "Auditado" as const,
                tags: Array.from(new Set([...r.tags.filter((t) => t !== "Revisar"), "Auditado"])),
              }
            : r
        )
      );
      if (isLiveData) {
        void markInterfarmaciasAudited(ids, user?.id);
      }
      showUndoToast(label, () => undoTo(before));
    },
    [apply, isLiveData, undoTo, user?.id]
  );

  const icons = useIcons();
  const RotateIcon = icons["rotate-ccw"];
  const sharp = useShape().variant === "sharp";
  const [skuCodeMode, setSkuCodeMode] = useState<"ean" | "idProducto">("ean");

  const columns = useMemo<ColumnDef<InterfarmaciaRow>[]>(
    () => [
      selectColumn<InterfarmaciaRow>(),
      {
        accessorKey: "sucursalOrigen",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Origen (Envía)" />,
        enableHiding: false,
        meta: { label: "Origen (Envía)", lines: 1, className: "min-w-44" },
      },
      {
        accessorKey: "nroEnvio",
        header: ({ column }) => <DataTableColumnHeader column={column} title="N° Envío" />,
        cell: ({ row }) =>
          row.depth > 0 ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="tabular-nums text-muted-foreground">
                {skuCodeMode === "ean" ? row.original.nroEnvio : row.original.idProducto ?? row.original.nroEnvio}
              </span>
              <Tooltip
                content={skuCodeMode === "ean" ? "Cambiar a IDProducto" : "Cambiar a EAN"}
                side="top"
                hoverable={false}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={skuCodeMode === "ean" ? "Cambiar a IDProducto" : "Cambiar a EAN"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSkuCodeMode((prev) => (prev === "ean" ? "idProducto" : "ean"));
                  }}
                  className={cn(
                    "relative z-[1] flex size-6 shrink-0 items-center justify-center text-muted-foreground outline-none",
                    "transition-colors duration-80 hover:bg-hover hover:text-foreground",
                    sharp ? "rounded-[1px]" : "rounded-[4px]"
                  )}
                >
                  <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={14} strokeWidth={1.5} />
                </button>
              </Tooltip>
            </span>
          ) : (
            <span className="tabular-nums">{row.original.nroEnvio}</span>
          ),
        meta: { label: "N° Envío", lines: 1, className: "tabular-nums min-w-44" },
      },
      {
        accessorKey: "fechaEnvio",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha envío" />,
        cell: ({ row }) =>
          row.depth > 0 ? (
            <span className="tabular-nums text-muted-foreground" title="Costo PPP">
              {row.original.costoPPP !== undefined ? formatCostoPPP(row.original.costoPPP) : "—"}
            </span>
          ) : (
            <DateTimeCell value={row.original.fechaEnvio} />
          ),
        meta: { label: "Fecha envío", className: "min-w-36 tabular-nums whitespace-nowrap" },
      },
      {
        accessorKey: "fechaRecepcion",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha recepción" />,
        cell: ({ row }) =>
          row.depth > 0 ? (
            <span>{row.original.fechaRecepcion}</span>
          ) : row.original.fechaRecepcion ? (
            <DateTimeCell value={row.original.fechaRecepcion} />
          ) : (
            <span className="text-muted-foreground">Pendiente</span>
          ),
        meta: { label: "Fecha recepción", lines: 1, className: "min-w-36" },
      },
      {
        accessorKey: "sucursalDestino",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Destino (Recibe)" />,
        meta: { label: "Destino (Recibe)", lines: 1, className: "min-w-36" },
      },
      {
        accessorKey: "estado",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
        cell: ({ row }) => {
          const estado = row.original.estado;
          if (estado === "En tránsito") {
            return (
              <span className="inline-flex h-[1lh] min-w-0 items-center gap-1.5 text-foreground">
                {row.depth > 0 ? (
                  <HugeiconsIcon
                    icon={Clock05Icon}
                    size={15}
                    strokeWidth={1.75}
                    className="shrink-0 text-[oklch(0.58_0.135_62)] dark:text-[oklch(0.73_0.135_62)]"
                  />
                ) : (
                  <DuotoneTruckIcon
                    variant="delivery"
                    className="text-[oklch(0.58_0.135_62)] dark:text-[oklch(0.73_0.135_62)]"
                  />
                )}
                <span className="truncate">{estado}</span>
              </span>
            );
          }
          if (estado === "Recibido") {
            return (
              <span className="inline-flex h-[1lh] min-w-0 items-center gap-1.5 text-foreground">
                {row.depth > 0 ? (
                  <HugeiconsIcon
                    icon={CheckIcon}
                    size={15}
                    strokeWidth={1.75}
                    className="shrink-0 text-[oklch(0.56_0.125_132.616)] dark:text-[oklch(0.68_0.125_132.616)]"
                  />
                ) : (
                  <DuotoneTruckIcon
                    variant="shipping"
                    className="text-[oklch(0.56_0.125_132.616)] dark:text-[oklch(0.68_0.125_132.616)]"
                  />
                )}
                <span className="truncate">{estado}</span>
              </span>
            );
          }
          if (estado === "Auditado") {
            return (
              <span className="inline-flex h-[1lh] min-w-0 items-center gap-1.5 text-foreground">
                {row.depth > 0 ? (
                  <HugeiconsIcon
                    icon={SearchCheckIcon}
                    size={15}
                    strokeWidth={1.75}
                    className="shrink-0 text-[oklch(0.55_0.13_248)] dark:text-[oklch(0.72_0.13_248)]"
                  />
                ) : (
                  <DuotoneTruckIcon
                    variant="search"
                    className="text-[oklch(0.55_0.13_248)] dark:text-[oklch(0.72_0.13_248)]"
                  />
                )}
                <span className="truncate">{estado}</span>
              </span>
            );
          }
          if (estado === "Anulado") {
            return (
              <span className="inline-flex h-[1lh] min-w-0 items-center gap-1.5 text-muted-foreground">
                {row.depth > 0 ? (
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={15}
                    strokeWidth={1.75}
                    className="shrink-0 text-muted-foreground"
                  />
                ) : (
                  <DuotoneTruckIcon variant="error" className="text-muted-foreground" />
                )}
                <span className="truncate">{estado}</span>
              </span>
            );
          }
          return (
            <span className="inline-flex h-[1lh] min-w-0 items-center gap-1.5 text-foreground">
              {row.depth > 0 ? (
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={15}
                  strokeWidth={1.75}
                  className="shrink-0 text-[oklch(0.55_0.155_24)] dark:text-[oklch(0.68_0.155_24)]"
                />
              ) : (
                <DuotoneTruckIcon
                  variant="error"
                  className="text-[oklch(0.55_0.155_24)] dark:text-[oklch(0.68_0.155_24)]"
                />
              )}
              <span className="truncate">{estado}</span>
            </span>
          );
        },
        meta: {
          label: "Estado",
          filter: { type: "options", options: ESTADO_OPTIONS },
        },
      },
      {
        accessorKey: "totalSkus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="SKUs" />,
        cell: ({ row }) =>
          row.depth > 0 ? <span className="text-muted-foreground">—</span> : row.original.totalSkus,
        meta: { label: "SKUs", className: "tabular-nums" },
      },
      {
        accessorKey: "unidadesEnviadas",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Enviadas" />,
        meta: { label: "Enviadas", className: "tabular-nums" },
      },
      {
        accessorKey: "unidadesRecibidas",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Recibidas" />,
        cell: ({ row }) =>
          row.original.unidadesRecibidas === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                "tabular-nums",
                row.original.unidadesRecibidas !== row.original.unidadesEnviadas && "font-medium text-red-500"
              )}
            >
              {row.original.unidadesRecibidas}
            </span>
          ),
        meta: { label: "Recibidas", className: "tabular-nums" },
      },
      {
        accessorKey: "observacion",
        header: "Observación",
        meta: { label: "Observación", className: "w-full min-w-60", lines: 1 },
      },
      {
        accessorKey: "usuarioEnvio",
        header: "Operador envío",
        meta: { label: "Operador envío", lines: 1 },
      },
      {
        accessorKey: "usuarioRecepcion",
        header: "Operador recepción",
        cell: ({ row }) =>
          row.original.usuarioRecepcion ? (
            row.original.usuarioRecepcion
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        meta: { label: "Operador recepción", lines: 1 },
      },
      {
        accessorKey: "tags",
        header: "Etiquetas",
        enableSorting: false,
        cell: ({ row }) => <TagChips tags={row.original.tags} />,
        meta: { label: "Etiquetas", className: "min-w-48" },
      },
      rowActionsColumn<InterfarmaciaRow>((row) => {
        const targetBranch =
          row.depth > 0 ? row.getParentRow()?.original.sucursalOrigen : row.original.sucursalOrigen;
        const copyValue =
          row.depth > 0 && skuCodeMode === "idProducto"
            ? row.original.idProducto ?? row.original.nroEnvio
            : row.original.nroEnvio;
        const copyLabel =
          row.depth > 0 ? (skuCodeMode === "idProducto" ? "Copiar IDProducto" : "Copiar EAN") : "Copiar N° Envío";
        return (
          <>
            <MenuItem
              index={0}
              label={targetBranch ? `Enviar a ${targetBranch}` : "Enviar al chat"}
              onSelect={() => sendContextToChat(formatInterfarmaciaContext(row), targetBranch)}
            />
            <MenuItem
              index={1}
              label="Copiar contexto"
              onSelect={() => copyContextToClipboard(formatInterfarmaciaContext(row))}
            />
            <MenuItem
              index={2}
              label={copyLabel}
              onSelect={() => navigator.clipboard?.writeText(copyValue)}
            />
            <MenuItem
              index={3}
              label="Marcar como auditado"
              onSelect={() => markAudited([row.original.id], `Auditado envío ${row.original.nroEnvio}`)}
            />
            <MenuItem
              index={4}
              label="Quitar de la vista"
              destructive
              onSelect={() => deleteRows([row.original.id], `Eliminado envío ${row.original.nroEnvio}`)}
            />
          </>
        );
      }),
    ],
    [deleteRows, markAudited, sharp, skuCodeMode]
  );

  const table = useDataTable({
    data: rows,
    columns,
    pageSize: 20,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.subRows,
    filterFromLeafRows: false,
    maxLeafRowFilterDepth: 0,
    globalFilterFn: (row, columnId, search) => {
      const query = (typeof search === "string" ? search : search?.query ?? "").trim().toLowerCase();
      if (!query) return true;
      if (typeof search === "object" && search?.column && search.column !== columnId) return false;
      const value = row.getValue(columnId);
      const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
      if (text.toLowerCase().includes(query)) return true;
      const subs = row.original.subRows;
      if (!subs?.length) return false;
      return subs.some((sub) => {
        const subVal = sub[columnId as keyof InterfarmaciaRow];
        const subText = Array.isArray(subVal) ? subVal.join(" ") : String(subVal ?? "");
        if (subText.toLowerCase().includes(query)) return true;
        return columnId === "nroEnvio" && !!sub.idProducto?.toLowerCase().includes(query);
      });
    },
    initialState: {
      sorting: [{ id: "fechaEnvio", desc: true }],
      columnVisibility: { tags: false, usuarioEnvio: false, usuarioRecepcion: false },
    },
  });

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-2 overflow-hidden px-4 py-5 md:px-6"
      style={
        {
          "--background": "var(--surface-3)",
          "--color-background": "var(--surface-3)",
        } as CSSProperties
      }
    >
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <DataTableTitle table={table}>Interfarmacias</DataTableTitle>
        {isLiveData && lastSyncedAt ? (
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">
            Sincronizado {new Date(lastSyncedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : (
          !loading && (
            <span className="ml-2 text-xs text-muted-foreground">Datos de muestra</span>
          )
        )}
        <span className="ml-auto" />
        <TooltipGroup>
          <Tooltip content="Refrescar envíos" side="bottom" hoverable={false}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refrescar envíos"
              disabled={refreshing}
              onClick={() => void loadFromSupabase(true)}
            >
              <RotateIcon size={15} className={cn(refreshing && "animate-spin")} />
            </Button>
          </Tooltip>
          <DataTableFilters table={table} />
          <DataTableViewOptions table={table} label="Columnas" />
          <DataTableSearch table={table} placeholder="Buscar N° envío, sucursal, EAN..." />
        </TooltipGroup>
      </div>

      <DataTableFilterChips table={table} />

      <DataTable
        table={table}
        fill
        resizeColumns
        reorderColumns
        loading={loading}
        loadingRows={12}
        className={cn(
          "[&_tbody:has(>tr[data-expanded])>tr[data-depth='0']:not([data-expanded]):not([data-state='selected'])]:opacity-50",
          "[&_tbody>tr[data-depth='0']]:transition-opacity [&_tbody>tr[data-depth='0']]:duration-150",
          "[&_tbody:has(>tr[data-expanded])>tr[data-depth='0']:not([data-expanded]):hover]:opacity-100",
          "[&_tbody:has(>tr[data-expanded])>tr[data-depth='0']:not([data-expanded]):focus-within]:opacity-100",
          "[&_tr[data-expanded]_[data-subrow-guide]]:bg-foreground/25",
          "[&_tr[data-depth='1']_[data-subrow-guide]]:bg-foreground/25"
        )}
        empty={
          rows.length === 0
            ? {
                title: "No quedan interfarmacias en la vista",
                description: "Podés deshacer la última acción para recuperarlas.",
                action: history.canUndo ? (
                  <Button variant="ghost" size="sm" onClick={history.undo}>
                    Deshacer
                  </Button>
                ) : undefined,
              }
            : table.getState().columnFilters.length > 0
              ? { title: "Sin coincidencias con los filtros actuales" }
              : {
                  title: "No se encontraron interfarmacias",
                  description: "Probá buscar por N° de envío, sucursal o EAN.",
                }
        }
        onUndo={history.undo}
        onRedo={history.redo}
      />

      <DataTablePagination table={table} pageSizes={[10, 20, 50]} />

      <DataTableSelectionBar
        table={table}
        actions={(picked) => {
          const branches = Array.from(
            new Set(
              picked
                .map((r) => (r.depth > 0 ? r.getParentRow()?.original.sucursalOrigen : r.original.sucursalOrigen))
                .filter(Boolean)
            )
          );
          const singleBranch = branches.length === 1 ? branches[0] : undefined;
          return [
          {
            value: "send-chat",
            label: singleBranch ? `Enviar a ${singleBranch}` : "Enviar al chat",
            icon: icons["message-circle"],
            onSelect: () => {
              sendContextToChat(picked.map((r) => formatInterfarmaciaContext(r)).join("\n\n"), singleBranch);
              table.resetRowSelection();
            },
          },
          {
            value: "copy-context",
            label: picked.length === 1 ? "Copiar contexto" : `Copiar ${picked.length} contextos`,
            icon: icons.copy,
            onSelect: () => {
              copyContextToClipboard(picked.map((r) => formatInterfarmaciaContext(r)).join("\n\n"));
              table.resetRowSelection();
            },
          },
          {
            value: "audit",
            label: picked.length === 1 ? "Marcar auditado" : `Auditar ${picked.length} envíos`,
            icon: icons.check,
            onSelect: () => {
              markAudited(
                picked.map((r) => r.original.id),
                picked.length === 1
                  ? `Auditado envío ${picked[0].original.nroEnvio}`
                  : `Auditados ${picked.length} interfarmacias`
              );
              table.resetRowSelection();
            },
          },
          {
            value: "copy",
            label: "Copiar N° Envío",
            icon: icons.copy,
            onSelect: () => navigator.clipboard?.writeText(picked.map((r) => r.original.nroEnvio).join("\n")),
          },
          {
            value: "delete",
            label: picked.length === 1 ? "Quitar" : `Quitar ${picked.length} filas`,
            icon: icons.x,
            destructive: true,
            onSelect: () => {
              deleteRows(
                picked.map((r) => r.original.id),
                picked.length === 1
                  ? `Eliminado envío ${picked[0].original.nroEnvio}`
                  : `Eliminados ${picked.length} interfarmacias`
              );
              table.resetRowSelection();
            },
          },
        ];
        }}
      />

      <UndoToaster />
    </div>
  );
}

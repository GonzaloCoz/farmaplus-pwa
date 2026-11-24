import { supabase } from "@/integrations/supabase/client";
import { isTauriEnvironment } from "@/services/mysqlTauriBridge";
import { getSessionToken } from "@/services/vault";

export type EstadoInterfarmacia = "En tránsito" | "Recibido" | "Con diferencia" | "Auditado" | "Anulado";

export type InterfarmaciaRow = {
  id: string;
  nroEnvio: string;
  fechaRecepcion: string;
  sucursalOrigen: string;
  sucursalDestino: string;
  estado: EstadoInterfarmacia;
  totalSkus: number;
  unidadesEnviadas: number;
  unidadesRecibidas: number | null;
  fechaEnvio: string;
  usuarioEnvio: string;
  usuarioRecepcion: string | null;
  tags: string[];
  observacion: string;
  idProducto?: string;
  costoPPP?: number;
  isSubRow?: boolean;
  subRows?: InterfarmaciaRow[];
};

type EnvioDbRow = {
  id_envio_global: number;
  suc_origen_nombre: string;
  suc_destino_nombre: string;
  fecha_envio: string;
  fecha_recepcion: string | null;
  id_estado_plex: number;
  estado: EstadoInterfarmacia;
  total_skus: number;
  unidades_enviadas: number;
  unidades_recibidas: number | null;
  operador_envio: string | null;
  operador_recepcion: string | null;
  descripcion: string | null;
  auditado: boolean;
  observacion_auditoria: string | null;
  sincronizado_en: string;
};

type LineaDbRow = {
  id_envio_global: number;
  orden: number;
  id_producto: number;
  ean: string;
  producto: string;
  laboratorio: string;
  rubro: string;
  cantidad_enviada: number;
  cantidad_recibida: number | null;
  costo_ppp: number;
  lote_vto: string | null;
  lote_fecha_vto: string | null;
};

function toLocalDateTimeString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function buildTags(e: EnvioDbRow): string[] {
  if (e.estado === "Anulado") return ["Anulado"];
  if (e.estado === "Auditado" || e.auditado) return ["Auditado"];
  if (e.estado === "Con diferencia") {
    const diff = (e.unidades_recibidas ?? 0) - e.unidades_enviadas;
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    return [`Diferencia (${sign} u.)`, "Revisar"];
  }
  if (e.estado === "En tránsito") {
    const hours = (Date.now() - new Date(e.fecha_envio).getTime()) / 3_600_000;
    if (hours >= 72) return ["Sin recepción", "+72 hs"];
    if (hours >= 48) return ["Sin recepción", "+48 hs"];
    return ["Sin recepción"];
  }
  return ["Completo"];
}

type PlexEnvioRaw = {
  id_envio: number;
  id_envio_global: number;
  fecha_envio: string;
  fecha_recepcion: string | null;
  descripcion: string;
  suc_origen: number;
  origen_nombre: string;
  suc_destino: number;
  destino_nombre: string;
  id_estado: number;
  operador_envio: string;
  operador_recepcion: string | null;
};

type PlexLineaRaw = {
  id_envio_global: number;
  orden: number;
  id_producto: number;
  ean: string;
  producto: string;
  laboratorio: string;
  rubro: string;
  cantidad_enviada: number;
  cantidad_recibida: number | null;
  costo_ppp: number;
  lote_vto: string | null;
  lote_fecha_vto: string | null;
};

type PlexInterfarmaciasResult = {
  envios: PlexEnvioRaw[];
  lineas: PlexLineaRaw[];
};

const ROMANS = new Set(["I", "II", "III", "IV", "V", "VI"]);
const SMALL_WORDS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y"]);

function cleanBranchName(raw: string | null | undefined, sucId: number): string {
  if (!raw || !raw.trim()) return `Sucursal #${sucId}`;
  const stripped = raw.trim().replace(/^(?:Z\s+)?(?:BS\s+AS|GBA|INT)\s*-\s*/i, "");
  return stripped
    .split(/\s+/)
    .map((w, idx) => {
      const up = w.toUpperCase();
      if (ROMANS.has(up)) return up;
      if (idx > 0 && SMALL_WORDS.has(up)) return up.toLowerCase();
      return up.charAt(0) + up.slice(1).toLowerCase();
    })
    .join(" ");
}

async function fetchFromPlexTauri(firstDayStr: string): Promise<{
  rows: InterfarmaciaRow[];
  lastSyncedAt: string | null;
  source?: "plex";
  error?: string;
} | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const password = await getSessionToken();
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<PlexInterfarmaciasResult>("cargar_interfarmacias_plex", {
      host: "172.30.40.62",
      port: 3306,
      user: "root",
      password,
      database: "onze_center",
      desde: firstDayStr,
    });

    const lineasByEnvio = new Map<number, PlexLineaRaw[]>();
    for (const ln of res.lineas) {
      const list = lineasByEnvio.get(ln.id_envio_global) ?? [];
      list.push(ln);
      lineasByEnvio.set(ln.id_envio_global, list);
    }

    const nowIso = new Date().toISOString();
    const rows: InterfarmaciaRow[] = res.envios.map((e) => {
      const nro = String(e.id_envio_global);
      const lines = lineasByEnvio.get(e.id_envio_global) ?? [];
      const unidadesEnviadas = lines.reduce((acc, l) => acc + Number(l.cantidad_enviada || 0), 0);
      const hasRecep =
        e.id_estado === 10 || lines.some((l) => l.cantidad_recibida !== null && l.cantidad_recibida !== undefined);
      const unidadesRecibidas = hasRecep
        ? lines.reduce((acc, l) => acc + Number(l.cantidad_recibida ?? 0), 0)
        : null;

      let estado: EstadoInterfarmacia = "En tránsito";
      if (e.id_estado === 11) {
        estado = "Anulado";
      } else if (e.id_estado === 10) {
        const hasDiff =
          lines.some(
            (l) => l.cantidad_recibida !== null && Number(l.cantidad_recibida) !== Number(l.cantidad_enviada)
          ) || (unidadesRecibidas !== null && unidadesRecibidas !== unidadesEnviadas);
        estado = hasDiff ? "Con diferencia" : "Recibido";
      }

      const subRows: InterfarmaciaRow[] = lines.map((ln) => {
        const itemDiff =
          ln.cantidad_recibida !== null ? Number(ln.cantidad_recibida) - Number(ln.cantidad_enviada) : 0;
        const itemEstado: EstadoInterfarmacia =
          estado === "Anulado"
            ? "Anulado"
            : estado === "En tránsito"
              ? "En tránsito"
              : itemDiff !== 0
                ? "Con diferencia"
                : "Recibido";
        const obsParts: string[] = [];
        if (itemDiff !== 0) {
          obsParts.push(`Diferencia ${itemDiff > 0 ? `+${itemDiff}` : itemDiff} u. en envío ${nro}`);
        }
        if (ln.lote_vto) obsParts.push(`Lote ${ln.lote_vto}`);
        if (ln.lote_fecha_vto) obsParts.push(`Vto ${ln.lote_fecha_vto}`);

        return {
          id: `${nro}::${ln.id_producto}-${ln.orden}`,
          nroEnvio: ln.ean || String(ln.id_producto),
          idProducto: String(ln.id_producto),
          costoPPP: Number(ln.costo_ppp ?? 0),
          fechaRecepcion: ln.rubro || "—",
          sucursalOrigen: ln.producto || `SKU ${ln.id_producto}`,
          sucursalDestino: ln.laboratorio || "—",
          estado: itemEstado,
          totalSkus: 1,
          unidadesEnviadas: Number(ln.cantidad_enviada),
          unidadesRecibidas: ln.cantidad_recibida !== null ? Number(ln.cantidad_recibida) : null,
          fechaEnvio: e.fecha_envio,
          usuarioEnvio: e.operador_envio,
          usuarioRecepcion: e.operador_recepcion,
          tags: [ln.rubro || "SKU"],
          observacion: obsParts.join(" · "),
          isSubRow: true,
        };
      });

      const fakeEnvioRow: EnvioDbRow = {
        id_envio_global: e.id_envio_global,
        suc_origen_nombre: cleanBranchName(e.origen_nombre, e.suc_origen),
        suc_destino_nombre: cleanBranchName(e.destino_nombre, e.suc_destino),
        fecha_envio: e.fecha_envio.replace(" ", "T") + ":00-03:00",
        fecha_recepcion: e.fecha_recepcion ? e.fecha_recepcion.replace(" ", "T") + ":00-03:00" : null,
        id_estado_plex: e.id_estado,
        estado,
        total_skus: lines.length,
        unidades_enviadas: unidadesEnviadas,
        unidades_recibidas: unidadesRecibidas,
        operador_envio: e.operador_envio,
        operador_recepcion: e.operador_recepcion,
        descripcion: e.descripcion,
        auditado: false,
        observacion_auditoria: null,
        sincronizado_en: nowIso,
      };

      return {
        id: nro,
        nroEnvio: nro,
        fechaRecepcion: e.fecha_recepcion ?? "",
        sucursalOrigen: fakeEnvioRow.suc_origen_nombre,
        sucursalDestino: fakeEnvioRow.suc_destino_nombre,
        estado,
        totalSkus: lines.length,
        unidadesEnviadas,
        unidadesRecibidas,
        fechaEnvio: e.fecha_envio,
        usuarioEnvio: e.operador_envio,
        usuarioRecepcion: e.operador_recepcion,
        tags: buildTags(fakeEnvioRow),
        observacion: e.descripcion,
        subRows,
      };
    });

    return { rows, lastSyncedAt: nowIso, source: "plex" };
  } catch (err: any) {
    return {
      rows: [],
      lastSyncedAt: null,
      error: err?.toString?.() || "No se pudo conectar a Plex (172.30.40.62)",
    };
  }
}

export async function fetchInterfarmaciasMesActual(): Promise<{
  rows: InterfarmaciaRow[];
  lastSyncedAt: string | null;
  source?: "plex" | "supabase";
  error?: string;
}> {
  const now = new Date();
  const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const firstOfMonth = `${firstDayStr}T00:00:00-03:00`;

  // 1. En MiPlus Desktop (Tauri), leemos directo en tiempo real desde Plex (172.30.40.62 / onze_center)
  const plexRes = await fetchFromPlexTauri(firstDayStr);
  if (plexRes && !plexRes.error && plexRes.rows.length > 0) {
    return plexRes;
  }

  // 2. Fallback a Supabase (web o fuera de VPN)
  // Supabase PostgREST pagina de a 1000 por defecto; traemos por bloques hasta completar el mes
  const envios: EnvioDbRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 10000; from += PAGE) {
    const { data, error } = await (supabase as any)
      .from("interfarmacias_envios")
      .select(
        "id_envio_global,suc_origen_nombre,suc_destino_nombre,fecha_envio,fecha_recepcion,id_estado_plex,estado,total_skus,unidades_enviadas,unidades_recibidas,operador_envio,operador_recepcion,descripcion,auditado,observacion_auditoria,sincronizado_en"
      )
      .gte("fecha_envio", firstOfMonth)
      .order("fecha_envio", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      const combined = plexRes?.error
        ? `Plex: ${plexRes.error} · Supabase: ${error.message}`
        : error.message;
      return { rows: [], lastSyncedAt: null, error: combined };
    }
    const batch = (data ?? []) as EnvioDbRow[];
    envios.push(...batch);
    if (batch.length < PAGE) break;
  }

  if (envios.length === 0) {
    return { rows: [], lastSyncedAt: null };
  }

  // Traemos todas las lineas de los envios del mes en lotes por ID
  const envioIds = envios.map((e) => e.id_envio_global);
  const lineasByEnvio = new Map<number, LineaDbRow[]>();
  const CHUNK = 400;
  for (let i = 0; i < envioIds.length; i += CHUNK) {
    const slice = envioIds.slice(i, i + CHUNK);
    const { data, error } = await (supabase as any)
      .from("interfarmacias_lineas")
      .select(
        "id_envio_global,orden,id_producto,ean,producto,laboratorio,rubro,cantidad_enviada,cantidad_recibida,costo_ppp,lote_vto,lote_fecha_vto"
      )
      .in("id_envio_global", slice)
      .order("orden", { ascending: true });

    if (error) {
      const combined = plexRes?.error
        ? `Plex: ${plexRes.error} · Supabase: ${error.message}`
        : error.message;
      return { rows: [], lastSyncedAt: null, error: combined };
    }
    for (const ln of (data ?? []) as LineaDbRow[]) {
      const list = lineasByEnvio.get(ln.id_envio_global) ?? [];
      list.push(ln);
      lineasByEnvio.set(ln.id_envio_global, list);
    }
  }

  let lastSyncedAt: string | null = null;
  const rows: InterfarmaciaRow[] = envios.map((e) => {
    if (!lastSyncedAt || e.sincronizado_en > lastSyncedAt) {
      lastSyncedAt = e.sincronizado_en;
    }
    const nro = String(e.id_envio_global);
    const fechaEnvio = toLocalDateTimeString(e.fecha_envio);
    const fechaRecepcion = toLocalDateTimeString(e.fecha_recepcion);
    const lines = lineasByEnvio.get(e.id_envio_global) ?? [];

    const subRows: InterfarmaciaRow[] = lines.map((ln) => {
      const itemDiff =
        ln.cantidad_recibida !== null ? ln.cantidad_recibida - ln.cantidad_enviada : 0;
      const itemEstado: EstadoInterfarmacia =
        e.estado === "Anulado"
          ? "Anulado"
          : e.estado === "En tránsito"
            ? "En tránsito"
            : itemDiff !== 0
              ? "Con diferencia"
              : e.estado === "Auditado" || e.auditado
                ? "Auditado"
                : "Recibido";
      const obsParts: string[] = [];
      if (itemDiff !== 0) {
        obsParts.push(`Diferencia ${itemDiff > 0 ? `+${itemDiff}` : itemDiff} u. en envío ${nro}`);
      }
      if (ln.lote_vto) obsParts.push(`Lote ${ln.lote_vto}`);
      if (ln.lote_fecha_vto) obsParts.push(`Vto ${ln.lote_fecha_vto}`);

      return {
        id: `${nro}::${ln.id_producto}-${ln.orden}`,
        nroEnvio: ln.ean || String(ln.id_producto),
        idProducto: String(ln.id_producto),
        costoPPP: Number(ln.costo_ppp ?? 0),
        fechaRecepcion: ln.rubro || "—",
        sucursalOrigen: ln.producto,
        sucursalDestino: ln.laboratorio || "—",
        estado: itemEstado,
        totalSkus: 1,
        unidadesEnviadas: Number(ln.cantidad_enviada),
        unidadesRecibidas: ln.cantidad_recibida !== null ? Number(ln.cantidad_recibida) : null,
        fechaEnvio,
        usuarioEnvio: e.operador_envio ?? "",
        usuarioRecepcion: e.operador_recepcion,
        tags: [ln.rubro || "SKU"],
        observacion: obsParts.join(" · "),
        isSubRow: true,
      };
    });

    return {
      id: nro,
      nroEnvio: nro,
      fechaRecepcion,
      sucursalOrigen: e.suc_origen_nombre,
      sucursalDestino: e.suc_destino_nombre,
      estado: e.auditado ? "Auditado" : e.estado,
      totalSkus: e.total_skus,
      unidadesEnviadas: Number(e.unidades_enviadas),
      unidadesRecibidas: e.unidades_recibidas !== null ? Number(e.unidades_recibidas) : null,
      fechaEnvio,
      usuarioEnvio: e.operador_envio ?? "",
      usuarioRecepcion: e.operador_recepcion,
      tags: buildTags(e),
      observacion: e.observacion_auditoria || e.descripcion || "",
      subRows,
    };
  });

  return { rows, lastSyncedAt };
}

export async function markInterfarmaciasAudited(ids: string[], userId?: string): Promise<boolean> {
  const numericIds = ids
    .filter((id) => !id.includes("::"))
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n));
  if (numericIds.length === 0) return true;

  const { error } = await (supabase as any)
    .from("interfarmacias_envios")
    .update({
      auditado: true,
      auditado_por: userId ?? null,
      auditado_en: new Date().toISOString(),
      estado: "Auditado",
    })
    .in("id_envio_global", numericIds);

  return !error;
}

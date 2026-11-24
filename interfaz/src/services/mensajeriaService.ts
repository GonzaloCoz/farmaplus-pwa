import { invoke } from "@tauri-apps/api/core";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ExtremoMensajeriaRow = Database["public"]["Tables"]["extremos_mensajeria"]["Row"];
export type ConversacionDirectaRow = Database["public"]["Tables"]["conversaciones_directas"]["Row"];
export type MensajeDirectoRow = Database["public"]["Tables"]["mensajes_directos"]["Row"];
export type GrupoMensajeriaRow = Database["public"]["Tables"]["grupos_mensajeria"]["Row"];
export type MiembroGrupoRow = Database["public"]["Tables"]["miembros_grupo_mensajeria"]["Row"];
export type MensajeGrupoRow = Database["public"]["Tables"]["mensajes_grupo"]["Row"];

export interface MiembroGrupoInfo {
  operadorId: string;
  nombre: string;
  sector: string;
  rol: string;
  avatarUrl?: string | null;
  ultimoLeidoEn?: string | null;
}

export interface PaqueteExtremoPublico {
  extremo_publico: number[];
  firma_identidad: number[];
  firma_extremo: number[];
  respaldo_extremo: number[];
}

export interface ReplyToPayload {
  id: string;
  author: string;
  text: string;
}

export interface AdjuntoSellado {
  ruta: string;
  nombre: string;
  mime: string;
  tamano: number;
  material: string;
  iv: string;
}

export interface CargaMensajeSellado {
  text: string;
  replyTo?: ReplyToPayload;
  attachments?: AdjuntoSellado[];
}

export interface ContactoMensajeria {
  id: string;
  username: string;
  name: string;
  branch: string;
  role: string;
  avatarUrl?: string | null;
  extremoPublico: number[];
  tieneExtremoRegistrado: boolean;
}

export interface HiloConversacion {
  id: string;
  tipo: "directo" | "grupo";
  conversacionId: string;
  contactId: string;
  label: string;
  sector: string;
  badge: number;
  unread: boolean;
  avatarUrl?: string;
  online: boolean;
  fijado?: boolean;
  ultimoMovimientoEn: string;
  extremoParPublico: number[];
  miembros?: MiembroGrupoInfo[];
  esAdminGrupo?: boolean;
  vistoPor?: {
    leidos: number;
    total: number;
    nombres: string[];
  };
}

export type EstadoEntrega = "sent" | "delivered" | "read" | "error";

export interface MensajeDescifrado {
  id: string;
  conversacionId: string;
  remitenteId: string;
  remitenteNombre?: string;
  remitenteSector?: string;
  from: "user" | "assistant";
  text: string;
  replyTo?: string;
  replyToPayload?: ReplyToPayload;
  attachments?: AdjuntoSellado[];
  edited: boolean;
  status: EstadoEntrega;
  estadoNumerico: number;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  time: string;
}

export interface ResultadoListadoMensajeria {
  contactos: ContactoMensajeria[];
  hilos: HiloConversacion[];
  mensajesPorHilo: Record<string, MensajeDescifrado[]>;
  totalNoLeidos: number;
}

const semillasPorOperador = new Map<string, string>();
const extremosPorOperador = new Map<string, number[]>();
const cacheCargasPorMensaje = new Map<string, CargaMensajeSellado>();
const cacheAdjuntosPorRuta = new Map<string, File>();
const BUCKET_ADJUNTOS = "mensajeria-sellada";
const MAX_TAMANO_ADJUNTO_BYTES = 15 * 1024 * 1024;
const MAX_LADO_IMAGEN_PX = 1600;
const oyentesNoLeidos = new Set<(total: number) => void>();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function aArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

async function comprimirImagenSiConviene(file: File): Promise<{
  bytes: Uint8Array;
  mime: string;
  nombre: string;
}> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const esRaster =
    file.type.startsWith("image/") &&
    file.type !== "image/svg+xml" &&
    file.type !== "image/gif";

  if (!esRaster || file.size <= 150 * 1024 || typeof document === "undefined") {
    return {
      bytes: raw,
      mime: file.type || "application/octet-stream",
      nombre: file.name,
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = maxDim > MAX_LADO_IMAGEN_PX ? MAX_LADO_IMAGEN_PX / maxDim : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { bytes: raw, mime: file.type, nombre: file.name };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blobWebp = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8)
    );
    if (blobWebp && blobWebp.size < raw.byteLength) {
      const compBytes = new Uint8Array(await blobWebp.arrayBuffer());
      const nombreWebp = file.name.replace(/\.[^.]+$/, "") + ".webp";
      return { bytes: compBytes, mime: "image/webp", nombre: nombreWebp };
    }
  } catch {
    // Si falla la compresion en canvas, continuar con los bytes originales
  }

  return {
    bytes: raw,
    mime: file.type || "application/octet-stream",
    nombre: file.name,
  };
}

export async function subirAdjuntoSellado(params: {
  conversacionId: string;
  mensajeId: string;
  indice: number;
  file: File;
}): Promise<AdjuntoSellado> {
  const preparado = await comprimirImagenSiConviene(params.file);
  if (preparado.bytes.byteLength > MAX_TAMANO_ADJUNTO_BYTES) {
    throw new Error(`El archivo "${params.file.name}" supera el limite de 15 MB`);
  }

  const ruta = `${params.conversacionId}/${params.mensajeId}/${params.indice}`;
  const material = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    aArrayBuffer(material),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const aad = new TextEncoder().encode(ruta);
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: aArrayBuffer(iv), additionalData: aArrayBuffer(aad) },
    key,
    aArrayBuffer(preparado.bytes)
  );

  const blob = new Blob([cifrado], { type: "application/octet-stream" });
  const { error } = await supabase.storage
    .from(BUCKET_ADJUNTOS)
    .upload(ruta, blob, { contentType: "application/octet-stream", upsert: true });

  if (error) {
    throw error;
  }

  const fileParaCache =
    preparado.mime === params.file.type && preparado.nombre === params.file.name
      ? params.file
      : new File([aArrayBuffer(preparado.bytes)], preparado.nombre, { type: preparado.mime });
  cacheAdjuntosPorRuta.set(ruta, fileParaCache);

  return {
    ruta,
    nombre: preparado.nombre,
    mime: preparado.mime,
    tamano: preparado.bytes.byteLength,
    material: bytesToBase64(material),
    iv: bytesToBase64(iv),
  };
}

export async function descargarAdjuntoSellado(adjunto: AdjuntoSellado): Promise<File> {
  const cacheado = cacheAdjuntosPorRuta.get(adjunto.ruta);
  if (cacheado) return cacheado;

  const { data, error } = await supabase.storage
    .from(BUCKET_ADJUNTOS)
    .download(adjunto.ruta);

  if (error || !data) {
    throw error ?? new Error("Archivo expirado o no disponible");
  }

  const cifrado = new Uint8Array(await data.arrayBuffer());
  const material = base64ToBytes(adjunto.material);
  const iv = base64ToBytes(adjunto.iv);
  const key = await crypto.subtle.importKey(
    "raw",
    aArrayBuffer(material),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const aad = new TextEncoder().encode(adjunto.ruta);
  const plano = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: aArrayBuffer(iv), additionalData: aArrayBuffer(aad) },
    key,
    aArrayBuffer(cifrado)
  );

  const file = new File([plano], adjunto.nombre, {
    type: adjunto.mime || "application/octet-stream",
  });
  cacheAdjuntosPorRuta.set(adjunto.ruta, file);
  return file;
}

export function suscribirConteoNoLeidos(listener: (total: number) => void): () => void {
  oyentesNoLeidos.add(listener);
  return () => {
    oyentesNoLeidos.delete(listener);
  };
}

export function notificarCambioNoLeidos(total: number): void {
  for (const listener of oyentesNoLeidos) {
    try {
      listener(total);
    } catch {
      // Ignorar errores de oyentes individuales
    }
  }
}

export function esEntornoTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function bytesToPgHex(bytes: number[] | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let hex = "\\x";
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function esAsciiHexByte(b: number): boolean {
  return (
    (b >= 0x30 && b <= 0x39) ||
    (b >= 0x61 && b <= 0x66) ||
    (b >= 0x41 && b <= 0x46)
  );
}

function decodificarHexPuro(hex: string): number[] | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  const out: number[] = new Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i / 2] = byte;
  }
  return out;
}

export function pgHexToBytes(val: unknown): number[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((n) => Number(n) & 0xff);
  if (val instanceof Uint8Array) return Array.from(val);
  if (typeof val === "object" && val !== null && "data" in val) {
    const data = (val as { data?: unknown }).data;
    if (Array.isArray(data)) return data.map((n) => Number(n) & 0xff);
  }
  if (typeof val !== "string") return [];

  const trimmed = val.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => Number(n) & 0xff);
      }
    } catch {
      // Continuar con decodificacion hex/base64
    }
  }

  const hexLimpio = trimmed.replace(/^(?:\\+x|0x)/i, "");
  let decodificado = decodificarHexPuro(hexLimpio);

  // Si PostgREST o Realtime serializo un string '\x...' como bytes ASCII (5c 78 ...), desenvolverlo
  for (let vuelta = 0; vuelta < 2 && decodificado && decodificado.length >= 4; vuelta++) {
    const tienePrefijoAsciiHex =
      (decodificado[0] === 0x5c && (decodificado[1] === 0x78 || decodificado[1] === 0x58)) ||
      (decodificado[0] === 0x30 && (decodificado[1] === 0x78 || decodificado[1] === 0x58));
    if (!tienePrefijoAsciiHex) break;
    const resto = decodificado.slice(2);
    if (resto.length % 2 !== 0 || !resto.every(esAsciiHexByte)) break;
    const textoInterno = String.fromCharCode(...resto);
    const interno = decodificarHexPuro(textoInterno);
    if (!interno) break;
    decodificado = interno;
  }

  if (decodificado) return decodificado;

  if (typeof atob === "function") {
    try {
      const bin = atob(trimmed);
      const out: number[] = new Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i) & 0xff;
      }
      return out;
    } catch {
      return [];
    }
  }

  return [];
}

function obtenerSemillaRoaming(userId: string, username?: string): string {
  if (username && username.trim().length > 0) {
    const semilla = `miplus.roaming.v1|${userId}|${username.trim().toLowerCase()}`;
    semillasPorOperador.set(userId, semilla);
    return semilla;
  }
  const cacheada = semillasPorOperador.get(userId);
  if (cacheada) return cacheada;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("farmaplus_user");
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; username?: string };
        if (parsed?.id === userId && parsed?.username) {
          const semilla = `miplus.roaming.v1|${userId}|${parsed.username.trim().toLowerCase()}`;
          semillasPorOperador.set(userId, semilla);
          return semilla;
        }
      }
    } catch {
      // Ignorar errores de lectura de localStorage
    }
  }

  const fallback = `miplus.roaming.v1|${userId}`;
  semillasPorOperador.set(userId, fallback);
  return fallback;
}

async function sha256Bytes(texto: string | Uint8Array): Promise<Uint8Array> {
  const input = typeof texto === "string" ? new TextEncoder().encode(texto) : texto;
  const buf = new ArrayBuffer(input.byteLength);
  new Uint8Array(buf).set(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

async function derivarExtremoDeterministicoWeb(operadorId: string): Promise<number[]> {
  const digest = await sha256Bytes(`miplus.web.extremo.v1|${operadorId}`);
  const arr = Array.from(digest);
  if (!extremosPorOperador.has(operadorId)) {
    extremosPorOperador.set(operadorId, arr);
  }
  return arr;
}

async function asegurarExtremoWebFallback(
  operadorId: string,
  semillaRoaming: string,
  respaldoRemoto: number[] | null
): Promise<PaqueteExtremoPublico> {
  const extremoPublico = await derivarExtremoDeterministicoWeb(operadorId);
  const firmaIdentidad = Array.from(
    await sha256Bytes(`miplus.web.identidad.v1|${operadorId}|${semillaRoaming}`)
  );
  const firmaParteA = Array.from(
    await sha256Bytes(`miplus.extremo.v1|${operadorId}|${bytesToPgHex(extremoPublico)}`)
  );
  const firmaParteB = Array.from(
    await sha256Bytes(`miplus.extremo.v1.b|${operadorId}|${bytesToPgHex(firmaIdentidad)}`)
  );
  const firmaExtremo = [...firmaParteA, ...firmaParteB];
  const respaldoExtremo =
    respaldoRemoto && respaldoRemoto.length > 0
      ? respaldoRemoto
      : [...extremoPublico, ...firmaIdentidad];

  return {
    extremo_publico: extremoPublico,
    firma_identidad: firmaIdentidad,
    firma_extremo: firmaExtremo,
    respaldo_extremo: respaldoExtremo,
  };
}

async function derivarHkdfAesKey(
  semillaBase: string,
  conversacionId: string,
  mensajeId: string
): Promise<CryptoKey> {
  const baseMaterial = await sha256Bytes(semillaBase);
  const baseBuffer = new ArrayBuffer(baseMaterial.byteLength);
  new Uint8Array(baseBuffer).set(baseMaterial);

  const hkdfKey = await crypto.subtle.importKey("raw", baseBuffer, "HKDF", false, ["deriveKey"]);
  const saltBytes = await sha256Bytes(`miplus.sal.v1|${conversacionId}`);
  const saltBuffer = new ArrayBuffer(saltBytes.byteLength);
  new Uint8Array(saltBuffer).set(saltBytes);

  const infoBytes = new TextEncoder().encode(`miplus.sobre.mensaje.v1|${mensajeId}`);
  const infoBuffer = new ArrayBuffer(infoBytes.byteLength);
  new Uint8Array(infoBuffer).set(infoBytes);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBuffer,
      info: infoBuffer,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function derivarClaveAesConversacion(
  conversacionId: string,
  mensajeId: string
): Promise<CryptoKey> {
  return derivarHkdfAesKey(
    `miplus.sobre.conv.v1|${conversacionId}`,
    conversacionId,
    mensajeId
  );
}

async function derivarClaveAesParExplicito(
  extremoA: number[],
  extremoB: number[],
  conversacionId: string,
  mensajeId: string
): Promise<CryptoKey> {
  const hexA = bytesToPgHex(extremoA);
  const hexB = bytesToPgHex(extremoB);
  const [menor, mayor] = hexA < hexB ? [hexA, hexB] : [hexB, hexA];
  return derivarHkdfAesKey(
    `miplus.sobre.web.v1|${menor}|${mayor}|${conversacionId}`,
    conversacionId,
    mensajeId
  );
}

async function sellarMensajeWebFallback(params: {
  operadorId: string;
  extremoParPublico: number[];
  conversacionId: string;
  remitenteId: string;
  mensajeId: string;
  cargaJson: string;
}): Promise<number[]> {
  const key = await derivarClaveAesConversacion(
    params.conversacionId,
    params.mensajeId
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivBuf = new ArrayBuffer(iv.byteLength);
  new Uint8Array(ivBuf).set(iv);

  const aadBytes = new TextEncoder().encode(
    `${params.conversacionId}|${params.remitenteId}|${params.mensajeId}`
  );
  const aadBuf = new ArrayBuffer(aadBytes.byteLength);
  new Uint8Array(aadBuf).set(aadBytes);

  const plainBytes = new TextEncoder().encode(params.cargaJson);
  const plainBuf = new ArrayBuffer(plainBytes.byteLength);
  new Uint8Array(plainBuf).set(plainBytes);

  const cipherBuf = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBuf,
      additionalData: aadBuf,
    },
    key,
    plainBuf
  );

  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.byteLength + cipherBytes.byteLength);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.byteLength);
  return Array.from(combined);
}

async function abrirMensajeWebFallback(params: {
  operadorId: string;
  extremoParPublico: number[];
  conversacionId: string;
  remitenteId: string;
  mensajeId: string;
  sobreSellado: number[];
}): Promise<string> {
  if (params.sobreSellado.length < 28) {
    throw new Error("Sobre sellado invalido o truncado");
  }

  const raw = Uint8Array.from(params.sobreSellado);
  const iv = raw.slice(0, 12);
  const body = raw.slice(12);

  const ivBuf = new ArrayBuffer(iv.byteLength);
  new Uint8Array(ivBuf).set(iv);

  const bodyBuf = new ArrayBuffer(body.byteLength);
  new Uint8Array(bodyBuf).set(body);

  const aadBytes = new TextEncoder().encode(
    `${params.conversacionId}|${params.remitenteId}|${params.mensajeId}`
  );
  const aadBuf = new ArrayBuffer(aadBytes.byteLength);
  new Uint8Array(aadBuf).set(aadBytes);

  const detPropio = await derivarExtremoDeterministicoWeb(params.operadorId);
  const cachePropio = extremosPorOperador.get(params.operadorId) ?? detPropio;
  const detConv = await derivarExtremoDeterministicoWeb(params.conversacionId);
  const detRemitente = await derivarExtremoDeterministicoWeb(params.remitenteId);

  const candidatas: Array<() => Promise<CryptoKey>> = [
    () => derivarClaveAesConversacion(params.conversacionId, params.mensajeId),
    () =>
      derivarClaveAesParExplicito(
        cachePropio,
        params.extremoParPublico,
        params.conversacionId,
        params.mensajeId
      ),
    () =>
      derivarClaveAesParExplicito(
        detPropio,
        params.extremoParPublico,
        params.conversacionId,
        params.mensajeId
      ),
    () =>
      derivarClaveAesParExplicito(
        cachePropio,
        detConv,
        params.conversacionId,
        params.mensajeId
      ),
    () =>
      derivarClaveAesParExplicito(
        detPropio,
        detConv,
        params.conversacionId,
        params.mensajeId
      ),
    () =>
      derivarClaveAesParExplicito(
        detRemitente,
        params.extremoParPublico,
        params.conversacionId,
        params.mensajeId
      ),
  ];

  let ultimoError: unknown = null;
  for (const obtenerKey of candidatas) {
    try {
      const key = await obtenerKey();
      const plainBuf = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivBuf,
          additionalData: aadBuf,
        },
        key,
        bodyBuf
      );
      return new TextDecoder().decode(plainBuf);
    } catch (err) {
      ultimoError = err;
    }
  }

  throw ultimoError ?? new Error("No fue posible descifrar el sobre");
}

export async function asegurarIdentidad(
  userId: string,
  username: string
): Promise<PaqueteExtremoPublico> {
  const semillaRoaming = obtenerSemillaRoaming(userId, username);

  const { data: existente } = await supabase
    .from("extremos_mensajeria")
    .select("*")
    .eq("operador_id", userId)
    .maybeSingle();

  const respaldoRemoto =
    existente?.respaldo_extremo ? pgHexToBytes(existente.respaldo_extremo) : null;
  const respaldoTauriValido =
    respaldoRemoto && respaldoRemoto.length === 92 ? respaldoRemoto : null;

  let paquete: PaqueteExtremoPublico | null = null;
  if (esEntornoTauri()) {
    try {
      paquete = await invoke<PaqueteExtremoPublico>("asegurar_extremo_mensajeria", {
        operadorId: userId,
        semillaRoaming,
        respaldoRemoto: respaldoTauriValido,
      });
    } catch {
      paquete = null;
    }
  }
  if (!paquete) {
    paquete = await asegurarExtremoWebFallback(userId, semillaRoaming, respaldoRemoto);
  }

  extremosPorOperador.set(userId, paquete.extremo_publico);

  const extremoHex = bytesToPgHex(paquete.extremo_publico);
  const identidadHex = bytesToPgHex(paquete.firma_identidad);
  const firmaHex = bytesToPgHex(paquete.firma_extremo);
  const respaldoHex = bytesToPgHex(paquete.respaldo_extremo);

  const cambio =
    !existente ||
    existente.extremo_publico !== extremoHex ||
    existente.firma_identidad !== identidadHex ||
    existente.firma_extremo !== firmaHex ||
    existente.respaldo_extremo !== respaldoHex;

  if (cambio) {
    await supabase.from("extremos_mensajeria").upsert(
      {
        operador_id: userId,
        extremo_publico: extremoHex,
        firma_identidad: identidadHex,
        firma_extremo: firmaHex,
        respaldo_extremo: respaldoHex,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "operador_id" }
    );
  }

  return paquete;
}

export async function sellarCargaMensaje(params: {
  operadorId: string;
  username?: string;
  extremoParPublico: number[];
  conversacionId: string;
  remitenteId: string;
  mensajeId: string;
  carga: CargaMensajeSellado;
}): Promise<number[]> {
  cacheCargasPorMensaje.set(params.mensajeId, params.carga);
  const cargaJson = JSON.stringify(params.carga);
  const extremoPar =
    params.extremoParPublico.length === 32
      ? params.extremoParPublico
      : await derivarExtremoDeterministicoWeb(params.conversacionId);

  return sellarMensajeWebFallback({
    operadorId: params.operadorId,
    extremoParPublico: extremoPar,
    conversacionId: params.conversacionId,
    remitenteId: params.remitenteId,
    mensajeId: params.mensajeId,
    cargaJson,
  });
}

export async function abrirCargaMensaje(params: {
  operadorId: string;
  username?: string;
  extremoParPublico: number[];
  conversacionId: string;
  remitenteId: string;
  mensajeId: string;
  sobreSellado: string | number[];
}): Promise<CargaMensajeSellado> {
  const semillaRoaming = obtenerSemillaRoaming(params.operadorId, params.username);
  const sobreBytes = pgHexToBytes(params.sobreSellado);
  const extremoPar =
    params.extremoParPublico.length === 32
      ? params.extremoParPublico
      : await derivarExtremoDeterministicoWeb(params.conversacionId);

  let jsonTexto: string | null = null;

  try {
    jsonTexto = await abrirMensajeWebFallback({
      operadorId: params.operadorId,
      extremoParPublico: extremoPar,
      conversacionId: params.conversacionId,
      remitenteId: params.remitenteId,
      mensajeId: params.mensajeId,
      sobreSellado: sobreBytes,
    });
  } catch {
    jsonTexto = null;
  }

  if (jsonTexto === null && esEntornoTauri()) {
    try {
      jsonTexto = await invoke<string>("abrir_mensaje_directo", {
        operadorId: params.operadorId,
        semillaRoaming,
        extremoParPublico: extremoPar,
        conversacionId: params.conversacionId,
        remitenteId: params.remitenteId,
        mensajeId: params.mensajeId,
        sobreSellado: sobreBytes,
      });
    } catch {
      jsonTexto = null;
    }
  }

  if (jsonTexto === null) {
    const enCache = cacheCargasPorMensaje.get(params.mensajeId);
    if (enCache) return enCache;
    throw new Error("No fue posible abrir el sobre del mensaje");
  }

  const parsed = JSON.parse(jsonTexto) as CargaMensajeSellado;
  const resultado: CargaMensajeSellado = {
    text: typeof parsed?.text === "string" ? parsed.text : "",
    replyTo: parsed?.replyTo,
    attachments: parsed?.attachments,
  };
  cacheCargasPorMensaje.set(params.mensajeId, resultado);
  return resultado;
}

function mapearEstadoNumerico(estado: number): EstadoEntrega {
  if (estado >= 3) return "read";
  if (estado === 2) return "delivered";
  return "sent";
}

function formatearHoraMensaje(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatearTextoReply(replyTo?: ReplyToPayload): string | undefined {
  if (!replyTo || !replyTo.text) return undefined;
  return replyTo.author ? `${replyTo.author}: ${replyTo.text}` : replyTo.text;
}

export async function descifrarFilaMensaje(params: {
  fila: MensajeDirectoRow;
  userId: string;
  username?: string;
  extremoParPublico: number[];
}): Promise<MensajeDescifrado | null> {
  const { fila, userId, username, extremoParPublico } = params;
  let carga: CargaMensajeSellado;
  const estado: EstadoEntrega = mapearEstadoNumerico(fila.estado);

  try {
    carga = await abrirCargaMensaje({
      operadorId: userId,
      username,
      extremoParPublico,
      conversacionId: fila.conversacion_id,
      remitenteId: fila.remitente_id,
      mensajeId: fila.id,
      sobreSellado: fila.sobre_sellado,
    });
  } catch {
    return null;
  }

  return {
    id: fila.id,
    conversacionId: fila.conversacion_id,
    remitenteId: fila.remitente_id,
    from: fila.remitente_id === userId ? "user" : "assistant",
    text: carga.text,
    replyTo: formatearTextoReply(carga.replyTo),
    replyToPayload: carga.replyTo,
    attachments: carga.attachments,
    edited: Boolean(fila.editado),
    status: estado,
    estadoNumerico: fila.estado,
    createdAt: fila.creado_en,
    updatedAt: fila.actualizado_en,
    readAt: fila.leido_en,
    time: formatearHoraMensaje(fila.creado_en),
  };
}

export async function listarContactosYConversaciones(
  userId: string,
  username?: string
): Promise<ResultadoListadoMensajeria> {
  if (username) {
    obtenerSemillaRoaming(userId, username);
  }

  const [perfilesRes, extremosRes, convRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, role, branch_id, active, avatar_url, avatar_mode, branches(name)")
      .eq("active", true)
      .neq("id", userId)
      .order("full_name", { ascending: true }),
    supabase.from("extremos_mensajeria").select("*"),
    supabase
      .from("conversaciones_directas")
      .select("*")
      .or(`operador_menor.eq.${userId},operador_mayor.eq.${userId}`)
      .order("ultimo_movimiento_en", { ascending: false }),
  ]);

  const mapaExtremos = new Map<string, number[]>();
  for (const fila of extremosRes.data ?? []) {
    const bytes = pgHexToBytes(fila.extremo_publico);
    if (bytes.length === 32) {
      mapaExtremos.set(fila.operador_id, bytes);
      extremosPorOperador.set(fila.operador_id, bytes);
    }
  }

  const contactos: ContactoMensajeria[] = [];
  const mapaContactos = new Map<string, ContactoMensajeria>();

  for (const raw of (perfilesRes.data ?? []) as Array<{
    id: string;
    username: string;
    full_name: string | null;
    role: string;
    branch_id: string | null;
    active: boolean;
    avatar_url: string | null;
    avatar_mode: string | null;
    branches: { name: string } | { name: string }[] | null;
  }>) {
    const branchObj = Array.isArray(raw.branches) ? raw.branches[0] : raw.branches;
    const sector =
      branchObj?.name ||
      (raw.role === "admin"
        ? "Casa Central"
        : raw.role === "mod"
          ? "Coordinación Zonal"
          : "Sucursal");
    const extremoRegistrado = mapaExtremos.get(raw.id);
    const extremoPublico =
      extremoRegistrado ?? (await derivarExtremoDeterministicoWeb(raw.id));

    const contacto: ContactoMensajeria = {
      id: raw.id,
      username: raw.username,
      name: raw.full_name?.trim() || raw.username,
      branch: sector,
      role: raw.role,
      avatarUrl: raw.avatar_mode === "initials" ? null : raw.avatar_url,
      extremoPublico,
      tieneExtremoRegistrado: Boolean(extremoRegistrado),
    };
    contactos.push(contacto);
    mapaContactos.set(raw.id, contacto);
  }

  const conversaciones = convRes.data ?? [];
  const convIds = conversaciones.map((c) => c.id);

  let filasMensajes: MensajeDirectoRow[] = [];
  if (convIds.length > 0) {
    const { data: msgData } = await supabase
      .from("mensajes_directos")
      .select("*")
      .in("conversacion_id", convIds)
      .order("creado_en", { ascending: true });
    filasMensajes = msgData ?? [];
  }

  const mensajesPorHilo: Record<string, MensajeDescifrado[]> = {};
  const conteoNoLeidosPorConv = new Map<string, number>();

  const mapaParPorConv = new Map<
    string,
    { contactId: string; extremoParPublico: number[]; corteMs: number }
  >();
  for (const conv of conversaciones) {
    const esMenor = conv.operador_menor === userId;
    const contactId = esMenor ? conv.operador_mayor : conv.operador_menor;
    const corteIso = esMenor ? conv.vaciado_menor_en : conv.vaciado_mayor_en;
    const corteMs = corteIso ? Date.parse(corteIso) : 0;
    const contacto = mapaContactos.get(contactId);
    const extremoParPublico =
      contacto?.extremoPublico ??
      mapaExtremos.get(contactId) ??
      (await derivarExtremoDeterministicoWeb(contactId));
    mapaParPorConv.set(conv.id, {
      contactId,
      extremoParPublico,
      corteMs: Number.isNaN(corteMs) ? 0 : corteMs,
    });
    mensajesPorHilo[conv.id] = [];
  }

  let totalNoLeidos = 0;

  for (const fila of filasMensajes) {
    const parInfo = mapaParPorConv.get(fila.conversacion_id);
    if (!parInfo) continue;

    if (parInfo.corteMs > 0 && Date.parse(fila.creado_en) <= parInfo.corteMs) {
      continue;
    }

    if (fila.remitente_id !== userId && fila.estado < 3) {
      conteoNoLeidosPorConv.set(
        fila.conversacion_id,
        (conteoNoLeidosPorConv.get(fila.conversacion_id) ?? 0) + 1
      );
      totalNoLeidos += 1;
    }

    const msgDescifrado = await descifrarFilaMensaje({
      fila,
      userId,
      username,
      extremoParPublico: parInfo.extremoParPublico,
    });

    if (msgDescifrado) {
      mensajesPorHilo[fila.conversacion_id].push(msgDescifrado);
    }
  }

  const hilos: HiloConversacion[] = [];
  for (const conv of conversaciones) {
    const parInfo = mapaParPorConv.get(conv.id);
    if (!parInfo) continue;
    // No mostrar conversaciones vacias hasta que impacte al menos un mensaje visible
    if (mensajesPorHilo[conv.id].length === 0) continue;
    const contacto = mapaContactos.get(parInfo.contactId);
    const badge = conteoNoLeidosPorConv.get(conv.id) ?? 0;

    hilos.push({
      id: conv.id,
      tipo: "directo",
      conversacionId: conv.id,
      contactId: parInfo.contactId,
      label: contacto?.name ?? "Operador",
      sector: contacto?.branch ?? "Sucursal",
      badge,
      unread: badge > 0,
      avatarUrl: contacto?.avatarUrl ?? undefined,
      online: Boolean(contacto?.tieneExtremoRegistrado),
      fijado: Boolean(
        conv.operador_menor === userId ? conv.fijado_menor : conv.fijado_mayor
      ),
      ultimoMovimientoEn: conv.ultimo_movimiento_en,
      extremoParPublico: parInfo.extremoParPublico,
    });
  }

  // Cargar grupos y mensajes de grupo (si la migracion 0006 ya fue aplicada)
  try {
    const { data: gruposData, error: gruposErr } = await supabase
      .from("grupos_mensajeria")
      .select("*")
      .order("ultimo_movimiento_en", { ascending: false });

    const grupos = !gruposErr && gruposData ? gruposData : [];
    const grupoIds = grupos.map((g) => g.id);

    if (grupoIds.length > 0) {
      const [miembrosRes, msgGrupoRes] = await Promise.all([
        supabase
          .from("miembros_grupo_mensajeria")
          .select("*")
          .in("grupo_id", grupoIds),
        supabase
          .from("mensajes_grupo")
          .select("*")
          .in("grupo_id", grupoIds)
          .order("creado_en", { ascending: true }),
      ]);

      const miembrosPorGrupo = new Map<string, MiembroGrupoRow[]>();
      for (const m of miembrosRes.data ?? []) {
        const arr = miembrosPorGrupo.get(m.grupo_id) ?? [];
        arr.push(m);
        miembrosPorGrupo.set(m.grupo_id, arr);
      }

      const msgsPorGrupo = new Map<string, MensajeGrupoRow[]>();
      for (const mg of msgGrupoRes.data ?? []) {
        const arr = msgsPorGrupo.get(mg.grupo_id) ?? [];
        arr.push(mg);
        msgsPorGrupo.set(mg.grupo_id, arr);
      }

      for (const g of grupos) {
        const listaMiembros = miembrosPorGrupo.get(g.id) ?? [];
        const miRegistro = listaMiembros.find((m) => m.operador_id === userId);
        if (!miRegistro) continue;

        const corteMs = miRegistro.vaciado_en ? Date.parse(miRegistro.vaciado_en) : 0;
        const ultimoLeidoMs = Date.parse(
          miRegistro.ultimo_leido_en ?? miRegistro.unido_en
        );
        const claveGrupo = await derivarExtremoDeterministicoWeb(g.id);
        const filasGrupo = msgsPorGrupo.get(g.id) ?? [];

        const descifrados: MensajeDescifrado[] = [];
        let noLeidosGrupo = 0;

        for (const fg of filasGrupo) {
          const creadoMs = Date.parse(fg.creado_en);
          if (corteMs > 0 && creadoMs <= corteMs) continue;

          if (
            fg.remitente_id !== userId &&
            !Number.isNaN(creadoMs) &&
            (Number.isNaN(ultimoLeidoMs) || creadoMs > ultimoLeidoMs)
          ) {
            noLeidosGrupo += 1;
            totalNoLeidos += 1;
          }

          let carga: CargaMensajeSellado;
          try {
            carga = await abrirCargaMensaje({
              operadorId: userId,
              username,
              extremoParPublico: claveGrupo,
              conversacionId: g.id,
              remitenteId: fg.remitente_id,
              mensajeId: fg.id,
              sobreSellado: fg.sobre_sellado,
            });
          } catch {
            continue;
          }

          const autor = mapaContactos.get(fg.remitente_id);
          descifrados.push({
            id: fg.id,
            conversacionId: g.id,
            remitenteId: fg.remitente_id,
            remitenteNombre: autor?.name ?? "Operador",
            remitenteSector: autor?.branch ?? "Sucursal",
            from: fg.remitente_id === userId ? "user" : "assistant",
            text: carga.text,
            replyTo: formatearTextoReply(carga.replyTo),
            replyToPayload: carga.replyTo,
            attachments: carga.attachments,
            edited: Boolean(fg.editado),
            status: "read",
            estadoNumerico: 3,
            createdAt: fg.creado_en,
            updatedAt: fg.actualizado_en ?? fg.creado_en,
            time: formatearHoraMensaje(fg.creado_en),
          });
        }

        mensajesPorHilo[g.id] = descifrados;

        const miembrosInfo: MiembroGrupoInfo[] = listaMiembros.map((m) => {
          const c = mapaContactos.get(m.operador_id);
          return {
            operadorId: m.operador_id,
            nombre:
              m.operador_id === userId ? "Vos" : c?.name ?? "Operador",
            sector: c?.branch ?? "Sucursal",
            rol: m.rol,
            avatarUrl: c?.avatarUrl ?? null,
            ultimoLeidoEn: m.ultimo_leido_en,
          };
        });

        const ultimoMio = [...descifrados]
          .reverse()
          .find((m) => m.from === "user");
        let vistoPor: HiloConversacion["vistoPor"];
        if (ultimoMio) {
          const msgMs = Date.parse(ultimoMio.createdAt);
          const otros = miembrosInfo.filter((m) => m.operadorId !== userId);
          const lectores = otros.filter(
            (m) => m.ultimoLeidoEn && Date.parse(m.ultimoLeidoEn) >= msgMs
          );
          vistoPor = {
            leidos: lectores.length,
            total: otros.length,
            nombres: lectores.map((l) => l.nombre),
          };
        }

        hilos.push({
          id: g.id,
          tipo: "grupo",
          conversacionId: g.id,
          contactId: "",
          label: g.nombre,
          sector: `${miembrosInfo.length} miembros`,
          badge: noLeidosGrupo,
          unread: noLeidosGrupo > 0,
          online: true,
          fijado: Boolean(miRegistro.fijado),
          ultimoMovimientoEn: g.ultimo_movimiento_en,
          extremoParPublico: claveGrupo,
          miembros: miembrosInfo,
          esAdminGrupo: miRegistro.rol === "administrador",
          vistoPor,
        });
      }
    }
  } catch {
    // Si aun no se ejecuto 0006_grupos_mensajeria.sql, continuar solo con directos
  }

  hilos.sort((a, b) => {
    const diffFijado = Number(Boolean(b.fijado)) - Number(Boolean(a.fijado));
    if (diffFijado !== 0) return diffFijado;
    return (
      Date.parse(b.ultimoMovimientoEn || "0") -
      Date.parse(a.ultimoMovimientoEn || "0")
    );
  });

  notificarCambioNoLeidos(totalNoLeidos);

  return {
    contactos,
    hilos,
    mensajesPorHilo,
    totalNoLeidos,
  };
}

export async function crearOAbrirConversacion(
  userId: string,
  contactId: string
): Promise<ConversacionDirectaRow> {
  if (userId === contactId) {
    throw new Error("No se puede abrir una conversacion con el mismo operador");
  }
  const operador_menor = userId < contactId ? userId : contactId;
  const operador_mayor = userId < contactId ? contactId : userId;

  const { data: existente, error: errorBusqueda } = await supabase
    .from("conversaciones_directas")
    .select("*")
    .eq("operador_menor", operador_menor)
    .eq("operador_mayor", operador_mayor)
    .maybeSingle();

  if (errorBusqueda) {
    throw errorBusqueda;
  }
  if (existente) {
    return existente;
  }

  const { data: creada, error: errorInsert } = await supabase
    .from("conversaciones_directas")
    .insert({
      operador_menor,
      operador_mayor,
    })
    .select("*")
    .single();

  if (errorInsert || !creada) {
    throw errorInsert ?? new Error("No se pudo crear la conversacion directa");
  }

  return creada;
}

export async function enviarMensaje(params: {
  conversacionId: string;
  userId: string;
  username?: string;
  extremoParPublico: number[];
  text: string;
  replyTo?: ReplyToPayload;
  files?: File[];
  mensajeId?: string;
}): Promise<MensajeDirectoRow> {
  const mensajeId = params.mensajeId ?? crypto.randomUUID();
  let attachments: AdjuntoSellado[] | undefined;
  if (params.files && params.files.length > 0) {
    attachments = await Promise.all(
      params.files.map((file, indice) =>
        subirAdjuntoSellado({
          conversacionId: params.conversacionId,
          mensajeId,
          indice,
          file,
        })
      )
    );
  }

  const carga: CargaMensajeSellado = {
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };

  const sobreBytes = await sellarCargaMensaje({
    operadorId: params.userId,
    username: params.username,
    extremoParPublico: params.extremoParPublico,
    conversacionId: params.conversacionId,
    remitenteId: params.userId,
    mensajeId,
    carga,
  });

  const ahoraIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("mensajes_directos")
    .insert({
      id: mensajeId,
      conversacion_id: params.conversacionId,
      remitente_id: params.userId,
      sobre_sellado: bytesToPgHex(sobreBytes),
      estado: 1,
      editado: false,
      creado_en: ahoraIso,
      actualizado_en: ahoraIso,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("No se pudo insertar el mensaje directo");
  }

  await supabase
    .from("conversaciones_directas")
    .update({ ultimo_movimiento_en: ahoraIso })
    .eq("id", params.conversacionId);

  return data;
}

export async function editarMensaje(params: {
  mensajeId: string;
  conversacionId: string;
  userId: string;
  username?: string;
  extremoParPublico: number[];
  text: string;
  replyTo?: ReplyToPayload;
  attachments?: AdjuntoSellado[];
}): Promise<MensajeDirectoRow> {
  const carga: CargaMensajeSellado = {
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.attachments && params.attachments.length > 0
      ? { attachments: params.attachments }
      : {}),
  };

  const sobreBytes = await sellarCargaMensaje({
    operadorId: params.userId,
    username: params.username,
    extremoParPublico: params.extremoParPublico,
    conversacionId: params.conversacionId,
    remitenteId: params.userId,
    mensajeId: params.mensajeId,
    carga,
  });

  const actualizadoEn = new Date().toISOString();
  const { data, error } = await supabase
    .from("mensajes_directos")
    .update({
      sobre_sellado: bytesToPgHex(sobreBytes),
      editado: true,
      actualizado_en: actualizadoEn,
    })
    .eq("id", params.mensajeId)
    .eq("remitente_id", params.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("No se pudo editar el mensaje directo");
  }

  return data;
}

export async function marcarEstadoMensajes(
  conversacionId: string,
  userId: string,
  nuevoEstado: 2 | 3
): Promise<boolean> {
  const payload: Database["public"]["Tables"]["mensajes_directos"]["Update"] = {
    estado: nuevoEstado,
    ...(nuevoEstado === 3 ? { leido_en: new Date().toISOString() } : {}),
  };

  const { error } = await supabase
    .from("mensajes_directos")
    .update(payload)
    .eq("conversacion_id", conversacionId)
    .neq("remitente_id", userId)
    .lt("estado", nuevoEstado);

  if (error) {
    console.warn("[mensajeriaService] Error actualizando estado:", error);
    return false;
  }
  return true;
}

export async function eliminarConversacion(
  conversacionId: string,
  userId?: string
): Promise<void> {
  if (!userId) return;

  const { data: conv, error: errConv } = await supabase
    .from("conversaciones_directas")
    .select("operador_menor, operador_mayor")
    .eq("id", conversacionId)
    .maybeSingle();

  if (errConv || !conv) {
    if (errConv) throw errConv;
    return;
  }

  const ahoraIso = new Date().toISOString();
  const payload =
    conv.operador_menor === userId
      ? { vaciado_menor_en: ahoraIso }
      : { vaciado_mayor_en: ahoraIso };

  const { error } = await supabase
    .from("conversaciones_directas")
    .update(payload)
    .eq("id", conversacionId);

  if (error) {
    throw error;
  }
}

export async function crearGrupoMensajeria(params: {
  userId: string;
  nombre: string;
  descripcion?: string;
  miembroIds: string[];
}): Promise<GrupoMensajeriaRow> {
  const nombreLimpio = params.nombre.trim();
  if (nombreLimpio.length < 2) {
    throw new Error("El nombre del grupo debe tener al menos 2 caracteres");
  }

  const { data: grupo, error: errGrupo } = await supabase
    .from("grupos_mensajeria")
    .insert({
      nombre: nombreLimpio,
      descripcion: params.descripcion?.trim() || null,
      creado_por: params.userId,
    })
    .select("*")
    .single();

  if (errGrupo || !grupo) {
    throw errGrupo ?? new Error("No se pudo crear el grupo");
  }

  const unicos = Array.from(new Set([params.userId, ...params.miembroIds]));
  const miembrosPayload = unicos.map((operadorId) => ({
    grupo_id: grupo.id,
    operador_id: operadorId,
    rol: operadorId === params.userId ? "administrador" : "miembro",
    ultimo_leido_en: operadorId === params.userId ? new Date().toISOString() : null,
  }));

  const { error: errMiembros } = await supabase
    .from("miembros_grupo_mensajeria")
    .insert(miembrosPayload);

  if (errMiembros) {
    throw errMiembros;
  }

  return grupo;
}

export async function enviarMensajeGrupo(params: {
  grupoId: string;
  userId: string;
  username?: string;
  text: string;
  replyTo?: ReplyToPayload;
  files?: File[];
  mensajeId?: string;
}): Promise<MensajeGrupoRow> {
  const mensajeId = params.mensajeId ?? crypto.randomUUID();
  let attachments: AdjuntoSellado[] | undefined;
  if (params.files && params.files.length > 0) {
    attachments = await Promise.all(
      params.files.map((file, indice) =>
        subirAdjuntoSellado({
          conversacionId: params.grupoId,
          mensajeId,
          indice,
          file,
        })
      )
    );
  }

  const carga: CargaMensajeSellado = {
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };

  const claveGrupo = await derivarExtremoDeterministicoWeb(params.grupoId);
  const sobreBytes = await sellarCargaMensaje({
    operadorId: params.userId,
    username: params.username,
    extremoParPublico: claveGrupo,
    conversacionId: params.grupoId,
    remitenteId: params.userId,
    mensajeId,
    carga,
  });

  const ahoraIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("mensajes_grupo")
    .insert({
      id: mensajeId,
      grupo_id: params.grupoId,
      remitente_id: params.userId,
      sobre_sellado: bytesToPgHex(sobreBytes),
      editado: false,
      creado_en: ahoraIso,
      actualizado_en: ahoraIso,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("No se pudo enviar el mensaje al grupo");
  }

  await supabase
    .from("miembros_grupo_mensajeria")
    .update({ ultimo_leido_en: ahoraIso })
    .eq("grupo_id", params.grupoId)
    .eq("operador_id", params.userId);

  return data;
}

export async function editarMensajeGrupo(params: {
  mensajeId: string;
  grupoId: string;
  userId: string;
  username?: string;
  text: string;
  replyTo?: ReplyToPayload;
  attachments?: AdjuntoSellado[];
}): Promise<MensajeGrupoRow> {
  const carga: CargaMensajeSellado = {
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.attachments && params.attachments.length > 0
      ? { attachments: params.attachments }
      : {}),
  };

  const claveGrupo = await derivarExtremoDeterministicoWeb(params.grupoId);
  const sobreBytes = await sellarCargaMensaje({
    operadorId: params.userId,
    username: params.username,
    extremoParPublico: claveGrupo,
    conversacionId: params.grupoId,
    remitenteId: params.userId,
    mensajeId: params.mensajeId,
    carga,
  });

  const { data, error } = await supabase
    .from("mensajes_grupo")
    .update({
      sobre_sellado: bytesToPgHex(sobreBytes),
      editado: true,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", params.mensajeId)
    .eq("remitente_id", params.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("No se pudo editar el mensaje del grupo");
  }

  return data;
}

export async function marcarLeidoGrupo(
  grupoId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("miembros_grupo_mensajeria")
    .update({ ultimo_leido_en: new Date().toISOString() })
    .eq("grupo_id", grupoId)
    .eq("operador_id", userId);

  if (error) {
    console.warn("[mensajeriaService] Error marcando lectura en grupo:", error);
    return false;
  }
  return true;
}

export async function alternarFijadoHilo(params: {
  id: string;
  tipo: "directo" | "grupo";
  userId: string;
  fijado: boolean;
}): Promise<void> {
  if (params.tipo === "grupo") {
    const { error } = await supabase
      .from("miembros_grupo_mensajeria")
      .update({ fijado: params.fijado })
      .eq("grupo_id", params.id)
      .eq("operador_id", params.userId);
    if (error) throw error;
    return;
  }

  const { data: conv, error: errConv } = await supabase
    .from("conversaciones_directas")
    .select("operador_menor, operador_mayor")
    .eq("id", params.id)
    .maybeSingle();

  if (errConv || !conv) {
    if (errConv) throw errConv;
    return;
  }

  const payload =
    conv.operador_menor === params.userId
      ? { fijado_menor: params.fijado }
      : { fijado_mayor: params.fijado };

  const { error } = await supabase
    .from("conversaciones_directas")
    .update(payload)
    .eq("id", params.id);
  if (error) throw error;
}

export async function vaciarGrupoParaOperador(
  grupoId: string,
  userId: string
): Promise<void> {
  const ahoraIso = new Date().toISOString();
  const { error } = await supabase
    .from("miembros_grupo_mensajeria")
    .update({ vaciado_en: ahoraIso, ultimo_leido_en: ahoraIso })
    .eq("grupo_id", grupoId)
    .eq("operador_id", userId);

  if (error) {
    throw error;
  }
}

export async function salirDeGrupo(grupoId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("miembros_grupo_mensajeria")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("operador_id", userId);

  if (error) {
    throw error;
  }
}

export async function agregarMiembrosGrupo(
  grupoId: string,
  operadorIds: string[]
): Promise<void> {
  if (operadorIds.length === 0) return;
  const payload = operadorIds.map((operador_id) => ({
    grupo_id: grupoId,
    operador_id,
    rol: "miembro",
  }));
  const { error } = await supabase
    .from("miembros_grupo_mensajeria")
    .upsert(payload, { onConflict: "grupo_id,operador_id" });
  if (error) {
    throw error;
  }
}

export async function eliminarMensajePropio(params: {
  mensajeId: string;
  tipo: "directo" | "grupo";
  userId: string;
  attachments?: AdjuntoSellado[];
}): Promise<void> {
  if (params.attachments && params.attachments.length > 0) {
    try {
      await supabase.storage
        .from(BUCKET_ADJUNTOS)
        .remove(params.attachments.map((a) => a.ruta));
    } catch {
      // No bloquear la anulacion del mensaje si falla la limpieza del archivo
    }
  }

  const tabla = params.tipo === "grupo" ? "mensajes_grupo" : "mensajes_directos";
  const { error } = await supabase
    .from(tabla)
    .delete()
    .eq("id", params.mensajeId)
    .eq("remitente_id", params.userId);

  if (error) {
    throw error;
  }
}

export async function contarMensajesNoLeidos(userId: string): Promise<number> {
  const { data: convs } = await supabase
    .from("conversaciones_directas")
    .select("id")
    .or(`operador_menor.eq.${userId},operador_mayor.eq.${userId}`);

  const convIds = (convs ?? []).map((c) => c.id);
  let total = 0;

  if (convIds.length > 0) {
    const { count } = await supabase
      .from("mensajes_directos")
      .select("id", { count: "exact", head: true })
      .in("conversacion_id", convIds)
      .neq("remitente_id", userId)
      .lt("estado", 3);
    total += count ?? 0;
  }

  try {
    const { data: misGrupos } = await supabase
      .from("miembros_grupo_mensajeria")
      .select("grupo_id, ultimo_leido_en, unido_en, vaciado_en")
      .eq("operador_id", userId);

    for (const mg of misGrupos ?? []) {
      const desde = mg.ultimo_leido_en ?? mg.unido_en;
      const corte =
        mg.vaciado_en && Date.parse(mg.vaciado_en) > Date.parse(desde)
          ? mg.vaciado_en
          : desde;
      const { count } = await supabase
        .from("mensajes_grupo")
        .select("id", { count: "exact", head: true })
        .eq("grupo_id", mg.grupo_id)
        .neq("remitente_id", userId)
        .gt("creado_en", corte);
      total += count ?? 0;
    }
  } catch {
    // Si aun no existe la tabla de grupos, mantener solo conteo de directos
  }

  notificarCambioNoLeidos(total);
  return total;
}

export interface EventoTypingBroadcast {
  conversacionId: string;
  userId: string;
  typing: boolean;
}

export interface EventoSyncBroadcast {
  conversacionId: string;
  userId: string;
}

export interface SuscripcionMensajeriaHandlers {
  userId: string;
  onMensajeInsertado?: (fila: MensajeDirectoRow) => void;
  onMensajeActualizado?: (fila: MensajeDirectoRow) => void;
  onMensajeEliminado?: (id: string) => void;
  onConversacionCambiada?: (
    tipo: "INSERT" | "UPDATE" | "DELETE",
    fila: ConversacionDirectaRow
  ) => void;
  onTyping?: (evento: EventoTypingBroadcast) => void;
  onSync?: (evento: EventoSyncBroadcast) => void;
}

export interface ControladorSuscripcionMensajeria {
  canal: RealtimeChannel;
  enviarTyping: (conversacionId: string, typing: boolean) => Promise<void>;
  enviarSync: (conversacionId: string) => Promise<void>;
  cerrar: () => void;
}

export function suscribirMensajeriaRealtime(
  handlers: SuscripcionMensajeriaHandlers
): ControladorSuscripcionMensajeria {
  const sufijo = Math.random().toString(36).slice(2, 8);
  const canal = supabase
    .channel(`miplus-mensajeria-db-${handlers.userId}-${sufijo}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "mensajes_directos",
      },
      (payload) => {
        if (payload.new) {
          handlers.onMensajeInsertado?.(payload.new as MensajeDirectoRow);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "mensajes_directos",
      },
      (payload) => {
        if (payload.new) {
          handlers.onMensajeActualizado?.(payload.new as MensajeDirectoRow);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "mensajes_directos",
      },
      (payload) => {
        const oldRow = payload.old as { id?: string } | undefined;
        if (oldRow?.id) {
          handlers.onMensajeEliminado?.(oldRow.id);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversaciones_directas",
      },
      (payload) => {
        const row = (payload.eventType === "DELETE"
          ? payload.old
          : payload.new) as ConversacionDirectaRow | undefined;
        if (!row) return;
        if (
          row.operador_menor &&
          row.operador_mayor &&
          row.operador_menor !== handlers.userId &&
          row.operador_mayor !== handlers.userId
        ) {
          return;
        }
        handlers.onConversacionCambiada?.(
          payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          row
        );
      }
    )
    .subscribe();

  const canalTyping = supabase
    .channel("miplus-mensajeria-typing", {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "typing" }, (payload) => {
      const data = payload.payload as EventoTypingBroadcast | undefined;
      if (!data || data.userId === handlers.userId) return;
      handlers.onTyping?.(data);
    })
    .on("broadcast", { event: "sync" }, (payload) => {
      const data = payload.payload as EventoSyncBroadcast | undefined;
      if (!data || data.userId === handlers.userId) return;
      handlers.onSync?.(data);
    })
    .subscribe();

  return {
    canal,
    enviarTyping: async (conversacionId: string, typing: boolean) => {
      try {
        await canalTyping.send({
          type: "broadcast",
          event: "typing",
          payload: {
            conversacionId,
            userId: handlers.userId,
            typing,
          } satisfies EventoTypingBroadcast,
        });
      } catch {
        // Ignorar errores transitorios de broadcast
      }
    },
    enviarSync: async (conversacionId: string) => {
      try {
        await canalTyping.send({
          type: "broadcast",
          event: "sync",
          payload: {
            conversacionId,
            userId: handlers.userId,
          } satisfies EventoSyncBroadcast,
        });
      } catch {
        // Ignorar errores transitorios de broadcast
      }
    },
    cerrar: () => {
      void supabase.removeChannel(canal);
      void supabase.removeChannel(canalTyping);
    },
  };
}

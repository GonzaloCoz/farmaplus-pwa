export interface NotificationSegment {
  text: string;
  highlight?: boolean;
}

export interface NotificationTemplate {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  /** Sector de MiPlus del cual proviene la notificación (ej. "Inventario Cíclico") */
  sector: string;
  /** Oración en una sola línea con partes destacadas (usuario/sistema y entidad clave) */
  segments: NotificationSegment[];
  /** Fallback plano para compatibilidad con tabla Supabase actual */
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    name: string;
    avatarUrl?: string;
    initials?: string;
  };
  metadata?: Record<string, unknown>;
}

export const SECTOR_BY_CATEGORY: Record<string, string> = {
  INVENTARIO: "Inventario Cíclico",
  VENCIMIENTO: "Control de Vencimientos",
  CALENDARIO: "Calendario",
  SYSTEM: "Sistema",
  ALERTA: "Alertas",
  ANUNCIO: "Comunicados",
  ENVIADO: "Comunicados",
};

export const DEMO_NOTIFICATIONS: NotificationTemplate[] = [
  // ── Caso base: Solicitud de auditoría en Inventario Cíclico ──
  {
    id: "demo-inv-1",
    type: "info",
    category: "INVENTARIO",
    sector: "Inventario Cíclico",
    segments: [
      { text: "Gonzalo Coz", highlight: true },
      { text: " solicitó una auditoría en " },
      { text: "Elea", highlight: true },
    ],
    title: "Gonzalo Coz solicitó una auditoría en Elea",
    message: "",
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    sender: {
      name: "Gonzalo Coz",
      initials: "GC",
    },
    metadata: { lab: "Elea" },
  },
  {
    id: "demo-venc-1",
    type: "error",
    category: "VENCIMIENTO",
    sector: "Control de Vencimientos",
    segments: [
      { text: "Sistema", highlight: true },
      { text: " detectó lote próximo a vencer en " },
      { text: "Ibuprofeno 400mg", highlight: true },
    ],
    title: "Sistema detectó lote próximo a vencer en Ibuprofeno 400mg",
    message: "",
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
    sender: {
      name: "Sistema",
      initials: "SI",
    },
  },
  {
    id: "demo-cal-1",
    type: "info",
    category: "CALENDARIO",
    sector: "Calendario",
    segments: [
      { text: "Gonzalo Coz", highlight: true },
      { text: " programó el evento " },
      { text: "Auditoría Zonal", highlight: true },
      { text: " para mañana" },
    ],
    title: "Gonzalo Coz programó el evento Auditoría Zonal para mañana",
    message: "",
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
    sender: {
      name: "Gonzalo Coz",
      initials: "GC",
    },
  },
  {
    id: "demo-sync-1",
    type: "success",
    category: "SYSTEM",
    sector: "Sincronización Plex",
    segments: [
      { text: "Plex", highlight: true },
      { text: " actualizó las existencias de " },
      { text: "Sucursal Central", highlight: true },
    ],
    title: "Plex actualizó las existencias de Sucursal Central",
    message: "",
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    sender: {
      name: "Plex",
      initials: "PX",
    },
  },

  // ── Pestaña: Mencionado ──
  {
    id: "demo-mencion-1",
    type: "info",
    category: "ANUNCIO",
    sector: "Inventario Cíclico",
    segments: [
      { text: "Mariana Gómez", highlight: true },
      { text: " te mencionó en el recuento de " },
      { text: "Roemmers", highlight: true },
    ],
    title: "Mariana Gómez te mencionó en el recuento de Roemmers",
    message: "",
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    sender: {
      name: "Mariana Gómez",
      initials: "MG",
    },
  },
];

/**
 * Mapa y resolvedor de logos de laboratorios almacenados en `public/Logos/`.
 * Soporta coincidencia exacta sin tildes/puntuación y coincidencia por marca madre (familia).
 */

const LOGO_FILES: string[] = [
    "ABBOTT.png",
    "ADIUM.png",
    "ALCON.png",
    "ANDROMACO.png",
    "ARCOR.png",
    "ARISTON.png",
    "ASPEN PHARMA.png",
    "BAGO.png",
    "BALIARDA.png",
    "BAYER.png",
    "BEIERSDORF.png",
    "BERNABO.png",
    "BETA.png",
    "BIOSINTEX RETAI.png",
    "CASASCO.png",
    "CASSARA.png",
    "CEPAGE.png",
    "COLGATE.png",
    "COTY ARGENTINA S.A..png",
    "CRAVERI.png",
    "DENVER FARMA.png",
    "ELEA.png",
    "EUROFARMA.png",
    "FINADIET.png",
    "FORTBENTON.png",
    "GADOR.png",
    "GALDERMA.png",
    "GENOMMA LAB..png",
    "GLAXOSMITHKLINE.png",
    "HALEON ARGENTIN.png",
    "INSBRUCK.png",
    "ISDIN.png",
    "KENVUE ARGENTINA.png",
    "LA ROCHE-POSAY.png",
    "LAZAR.png",
    "LEPETIT.png",
    "LOREAL ARGENTINA S.A..png",
    "MAR.png",
    "MEDISOL.png",
    "MEGALABS ARGENTINA.png",
    "MONTPELLIER.png",
    "NEW PGA S.R.L..png",
    "NEW REVLON ARGENTINA S.A..png",
    "NOVA ARGENTIA.png",
    "NOVO NORDISK.png",
    "NOVOPLOS.png",
    "NUTRICIA-BAGO.png",
    "PANALAB.png",
    "PFIZER.png",
    "PHARMATRIX.png",
    "POEN.png",
    "ROEMMERS.png",
    "ROSPAW.png",
    "SANOFI-AVENTIS.png",
    "SERVIER.png",
    "SIEGFRIED.png",
    "TEMIS-LOSTALO.png",
    "TEVA ARGENTINA.png",
    "TRB-PHARMA.png",
    "UNILEVER.png",
    "VALUGE.png",
    "VICHY.png",
];

function normalizeLabKey(raw: string): string {
    return raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .trim();
}

const EXACT_LOGO_MAP: Map<string, string> = new Map();
const FAMILY_LOGO_ENTRIES: Array<{ key: string; url: string }> = [];

for (const file of LOGO_FILES) {
    const baseName = file.replace(/\.png$/i, "");
    const key = normalizeLabKey(baseName);
    const url = `/Logos/${encodeURIComponent(file)}`;
    EXACT_LOGO_MAP.set(key, url);
    if (key.length >= 4) {
        FAMILY_LOGO_ENTRIES.push({ key, url });
    }
}

// Ordenar de clave más específica (larga) a más corta para coincidencias de familia
FAMILY_LOGO_ENTRIES.sort((a, b) => b.key.length - a.key.length);

// Alias explícitos adicionales para divisiones frecuentes en Plex
const EXPLICIT_ALIASES: Record<string, string> = {
    "BIOSINTEX": "/Logos/BIOSINTEX%20RETAI.png",
    "BIOSINTEX RETAIL": "/Logos/BIOSINTEX%20RETAI.png",
    "HALEON": "/Logos/HALEON%20ARGENTIN.png",
    "HALEON ARGENTINA": "/Logos/HALEON%20ARGENTIN.png",
    "LOREAL": "/Logos/LOREAL%20ARGENTINA%20S.A..png",
    "L OREAL ARGENTINA S A": "/Logos/LOREAL%20ARGENTINA%20S.A..png",
    "COTY": "/Logos/COTY%20ARGENTINA%20S.A..png",
    "REVLON": "/Logos/NEW%20REVLON%20ARGENTINA%20S.A..png",
    "MEGALABS": "/Logos/MEGALABS%20ARGENTINA.png",
    "KENVUE": "/Logos/KENVUE%20ARGENTINA.png",
    "TEVA": "/Logos/TEVA%20ARGENTINA.png",
    "GSK": "/Logos/GLAXOSMITHKLINE.png",
};

/**
 * Devuelve la ruta pública `/Logos/...` del logo para un laboratorio dado, o `null` si aún no tiene logo cargado.
 */
export function getLaboratoryLogoUrl(labName?: string | null): string | null {
    if (!labName) return null;
    const key = normalizeLabKey(labName);
    if (!key) return null;

    // 1. Coincidencia exacta normalizada
    const exact = EXACT_LOGO_MAP.get(key);
    if (exact) return exact;

    // 2. Alias explícito
    if (EXPLICIT_ALIASES[key]) {
        return EXPLICIT_ALIASES[key];
    }

    // 3. Coincidencia por familia / marca madre (ej. "BAYER CONSUMER" -> "BAYER.png", "ABBOTT NUTRICIO" -> "ABBOTT.png")
    for (const entry of FAMILY_LOGO_ENTRIES) {
        if (key.startsWith(entry.key + " ")) {
            return entry.url;
        }
    }

    return null;
}


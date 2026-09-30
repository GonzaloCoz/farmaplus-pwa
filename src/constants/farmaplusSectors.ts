import Bookshelf03Icon from "@hugeicons/core-free-icons/Bookshelf03Icon";
import ArchiveIcon from "@hugeicons/core-free-icons/ArchiveIcon";
import Desk01Icon from "@hugeicons/core-free-icons/Desk01Icon";
import ShelvingUnitIcon from "@hugeicons/core-free-icons/ShelvingUnitIcon";
import ChartBubble02Icon from "@hugeicons/core-free-icons/ChartBubble02Icon";
import LockerIcon from "@hugeicons/core-free-icons/LockerIcon";
import FridgeIcon from "@hugeicons/core-free-icons/FridgeIcon";
import MirrorRectangularIcon from "@hugeicons/core-free-icons/MirrorRectangularIcon";
import Bookshelf01Icon from "@hugeicons/core-free-icons/Bookshelf01Icon";
import RoboticIcon from "@hugeicons/core-free-icons/RoboticIcon";
import ToolCaseIcon from "@hugeicons/core-free-icons/ToolCaseIcon";

export interface FarmaplusSectorDef {
    id: string;
    prefix: string;
    exampleCode: string;
    name: string;
    zone: 'Mostrador & Farmacia' | 'Salón & Exhibición' | 'Especiales & Control' | 'Depósito & Trastienda';
    icon: any;
    description: string;
    useCase: string;
    tagColor: string;
}

export const FARMAPLUS_SECTORS: FarmaplusSectorDef[] = [
    // 1. Zona Mostrador & Farmacia
    {
        id: 'espaldar',
        prefix: 'ESP',
        exampleCode: 'ESP-01',
        name: 'Espaldar',
        zone: 'Mostrador & Farmacia',
        icon: Bookshelf03Icon,
        description: 'Estantería trasera detrás del mostrador.',
        useCase: 'Medicamentos éticos y productos de alta y media rotación al alcance inmediato del farmacéutico.',
        tagColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    },
    {
        id: 'cajonera',
        prefix: 'CAJ',
        exampleCode: 'CAJ-01',
        name: 'Cajonera o Estantería',
        zone: 'Mostrador & Farmacia',
        icon: ArchiveIcon,
        description: 'Cajoneras deslizantes profundas o estanterías de especialidades.',
        useCase: 'Comprimidos, jarabes y cajas organizadas alfabéticamente por droga o marca.',
        tagColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    },
    {
        id: 'mostrador',
        prefix: 'MOS',
        exampleCode: 'MOS-01',
        name: 'Mostrador / Cajones',
        zone: 'Mostrador & Farmacia',
        icon: Desk01Icon,
        description: 'Puestos de mostrador de despacho y cajones bajo mesada.',
        useCase: 'Línea de cajas de despacho, PC mostrador, accesorios rápidos y productos en entrega activa.',
        tagColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
    },
    {
        id: 'robot',
        prefix: 'ROB',
        exampleCode: 'ROB-01',
        name: 'Robot',
        zone: 'Mostrador & Farmacia',
        icon: RoboticIcon,
        description: 'Dispensador robotizado automático (Rowa / Gollmann).',
        useCase: 'Almacenamiento compacto automatizado que entrega unidades directamente al mostrador mediante cinta.',
        tagColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
    },

    // 2. Zona Salón & Exhibición
    {
        id: 'gondola',
        prefix: 'GON',
        exampleCode: 'GON-01',
        name: 'Góndola',
        zone: 'Salón & Exhibición',
        icon: Bookshelf01Icon,
        description: 'Góndolas y pasillos centrales del salón de venta.',
        useCase: 'Autoservicio de dermocosmética, perfumería, cuidado personal, higiene y productos de venta libre (OTC).',
        tagColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    },
    {
        id: 'vidriera',
        prefix: 'VID',
        exampleCode: 'VID-01',
        name: 'Vidriera',
        zone: 'Salón & Exhibición',
        icon: MirrorRectangularIcon,
        description: 'Vitrinas y escaparates exteriores de fachada.',
        useCase: 'Exhibición publicitaria hacia la vía pública o galería comercial (fragancias importadas, solares, lanzamientos).',
        tagColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
    },
    {
        id: 'burbuja',
        prefix: 'BUR',
        exampleCode: 'BUR-01',
        name: 'Burbuja',
        zone: 'Salón & Exhibición',
        icon: ChartBubble02Icon,
        description: 'Exhibidores acrílicos circulares.',
        useCase: 'Puntos focales acrílicos en el salón para artículos de impulso.',
        tagColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
    },

    // 3. Zona Especiales & Control
    {
        id: 'heladera',
        prefix: 'HELA',
        exampleCode: 'HELA-01',
        name: 'Heladera',
        zone: 'Especiales & Control',
        icon: FridgeIcon,
        description: 'Heladeras de refrigeración para cadena de frío.',
        useCase: 'Conservación térmica estricta entre 2°C y 8°C (insulinas, vacunas, colirios, derivados plasmáticos y biológicos).',
        tagColor: 'bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
    },
    {
        id: 'archivados',
        prefix: 'ARC',
        exampleCode: 'ARC-01',
        name: 'Archivados',
        zone: 'Especiales & Control',
        icon: LockerIcon,
        description: 'Armario de seguridad bajo llave para psicotrópicos.',
        useCase: 'Especialidades medicinales controladas por ANMAT/Ministerio que requieren receta duplicada y libro foliado.',
        tagColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
    },
    {
        id: 'bacha',
        prefix: 'BAC',
        exampleCode: 'BAC-01',
        name: 'Bacha',
        zone: 'Especiales & Control',
        icon: ToolCaseIcon,
        description: 'Bacha y gabinete privado de servicios farmacéuticos.',
        useCase: 'Bacha técnica, box de enfermería, colocación de inyectables, toma de presión y vacunatorio.',
        tagColor: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20'
    },

    // 4. Zona Depósito & Trastienda
    {
        id: 'deposito',
        prefix: 'DEP',
        exampleCode: 'DEP-01',
        name: 'Depósito',
        zone: 'Depósito & Trastienda',
        icon: ShelvingUnitIcon,
        description: 'Depósito central interno y trastienda.',
        useCase: 'Almacenamiento de bultos cerrados, mercadería en cuarentena y stock de reserva antes de ingresar al salón.',
        tagColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
    }
];

export function getSectorByPrefix(prefix: string): FarmaplusSectorDef | undefined {
    const clean = prefix.trim().toUpperCase();
    if (clean === 'BOX') return FARMAPLUS_SECTORS.find(s => s.prefix === 'BAC');
    return FARMAPLUS_SECTORS.find(s => s.prefix === clean);
}

const SECTOR_PREFIXES_REGEX = /^(ESP|CAJ|MOS|DEP|BUR|ARC|HELA|VID|GON|ROB|BAC|BOX)[-_\s]?0*(\d{1,3})$/i;

/**
 * Detects whether an input string corresponds to a Farmaplus sector code format (e.g. ESP-01, GON-2, hela_3).
 */
export function isSectorCode(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    return SECTOR_PREFIXES_REGEX.test(input.trim());
}

/**
 * Normalizes an arbitrary sector input to standard Farmaplus format: PREFIX-01 (e.g. esp1 -> ESP-01).
 * Returns null if the input is not a recognized Farmaplus sector code.
 */
export function normalizeSectorCode(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const match = input.trim().match(SECTOR_PREFIXES_REGEX);
    if (!match) return null;
    const prefix = match[1].toUpperCase();
    const num = parseInt(match[2], 10);
    const padded = num < 10 ? `0${num}` : String(num);
    return `${prefix}-${padded}`;
}

export function parseSectorCode(code: string): { sectorDef?: FarmaplusSectorDef; numberPart?: string } {
    if (!code) return {};
    const normalized = normalizeSectorCode(code) || code.trim();
    const parts = normalized.split('-');
    if (parts.length >= 2) {
        const p = parts[0].trim().toUpperCase();
        const def = getSectorByPrefix(p);
        return { sectorDef: def, numberPart: parts.slice(1).join('-') };
    }
    return { sectorDef: getSectorByPrefix(code) };
}

const SECTOR_PREFIX_FULL_NAMES: Record<string, string> = {
    'ESP': 'Espaldar',
    'CAJ': 'Cajonera',
    'CA': 'Cajón',
    'MOS': 'Mostrador',
    'ROB': 'Robot',
    'GON': 'Góndola',
    'GO': 'Góndola',
    'VID': 'Vidriera',
    'BUR': 'Burbuja',
    'HELA': 'Heladera',
    'HE': 'Heladera',
    'ARC': 'Archivados',
    'BAC': 'Bacha',
    'BOX': 'Bacha',
    'DEP': 'Depósito',
    'DE': 'Depósito',
    'EST': 'Estantería',
    'ES': 'Estantería',
};

/**
 * Convierte un código abreviado (ej: "ESP-01", "GO-02", "HELA-1") en su nombre completo oficial (ej: "Espaldar 01", "Góndola 02", "Heladera 01").
 */
export function getFullSectorName(code?: string | null): string {
    if (!code || typeof code !== 'string') return 'Sin sector abierto';
    const trimmed = code.trim();
    if (!trimmed || trimmed.toLowerCase().includes('sin sector')) return 'Sin sector abierto';

    // Formato PREFIJO-NUMERO (ej. ESP-01, GO-2, HELA_03, CA-1)
    const numMatch = trimmed.match(/^([A-Za-z]+)[-_/\s]?0*(\d{1,3})$/);
    if (numMatch) {
        const prefix = numMatch[1].toUpperCase();
        const num = numMatch[2];
        const fullName = SECTOR_PREFIX_FULL_NAMES[prefix];
        if (fullName) {
            const formattedNum = num.length === 1 ? `0${num}` : num;
            return `${fullName} ${formattedNum}`;
        }
    }

    // Formato PREFIJO-ALGO (ej. ESP-A, GON-CENTRAL)
    const dashMatch = trimmed.match(/^([A-Za-z]+)[-_/\s](.+)$/);
    if (dashMatch) {
        const prefix = dashMatch[1].toUpperCase();
        const rest = dashMatch[2].trim();
        const fullName = SECTOR_PREFIX_FULL_NAMES[prefix];
        if (fullName) {
            return `${fullName} ${rest}`;
        }
    }

    // Prefijo exacto
    const upper = trimmed.toUpperCase();
    if (SECTOR_PREFIX_FULL_NAMES[upper]) {
        return SECTOR_PREFIX_FULL_NAMES[upper];
    }

    return trimmed;
}

/**
 * Retorna el ícono oficial de Hugeicons correspondiente a un sector (por código abreviado o por nombre completo).
 */
export function getSectorIcon(code?: string | null): any {
    if (!code || typeof code !== 'string') return null;
    const trimmed = code.trim();
    if (!trimmed || trimmed.toLowerCase().includes('sin sector')) return null;

    // 1. Extraer prefijo si tiene formato PREFIJO-NUMERO (ej. MOS-01, HELA-02, BUR-1)
    const numMatch = trimmed.match(/^([A-Za-z]+)[-_/\s]?0*(\d{1,3})$/);
    if (numMatch) {
        const prefix = numMatch[1].toUpperCase();
        const def = FARMAPLUS_SECTORS.find(s => s.prefix === prefix);
        if (def?.icon) return def.icon;
    }

    // 2. Extraer prefijo si tiene formato PREFIJO-ALGO (ej. ESP-A)
    const dashMatch = trimmed.match(/^([A-Za-z]+)[-_/\s](.+)$/);
    if (dashMatch) {
        const prefix = dashMatch[1].toUpperCase();
        const def = FARMAPLUS_SECTORS.find(s => s.prefix === prefix);
        if (def?.icon) return def.icon;
    }

    // 3. Buscar por coincidencia de nombre (ej. "Mostrador 01", "Burbuja 01", "Heladera 01", "Box 02")
    const normalizeStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanNorm = normalizeStr(trimmed);

    for (const sec of FARMAPLUS_SECTORS) {
        const secNameNorm = normalizeStr(sec.name);
        const secIdNorm = normalizeStr(sec.id);
        const secPrefixNorm = normalizeStr(sec.prefix);
        const firstWord = secNameNorm.split(/[\s/]+/)[0];

        if (cleanNorm.startsWith(firstWord) || 
            cleanNorm.startsWith(secIdNorm) ||
            cleanNorm.startsWith(secPrefixNorm) ||
            (sec.prefix === 'BAC' && (cleanNorm.startsWith('box') || cleanNorm.startsWith('bac'))) ||
            secNameNorm.startsWith(cleanNorm.split(/[\s/]+/)[0])) {
            return sec.icon;
        }
    }

    return null;
}

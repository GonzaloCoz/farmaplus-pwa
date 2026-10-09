import { normalizeString } from './utils';

export interface OfficialBranchInfo {
    branchId: number;
    name: string;
    code: string;
    sigla: string;
    primaryIp: string;
    fallbackIps?: string[];
}

export interface BranchHostConfig {
    branchName: string;
    officialName: string;
    branchId: number;
    primaryIp: string;
    fallbackIps: string[];
    port: number;
    user: string;
    password?: string;
    database: string;
}

/**
 * Determina si el entorno actual es la aplicación nativa de escritorio (Tauri)
 */
function isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

// Mapa de subredes internas de contingencia (solo resuelto en runtime nativo Desktop)
const SUBNET_192_OCTETS: Record<number, number> = {
    2: 42, 4: 22, 5: 43, 6: 14, 7: 25, 8: 27, 9: 24, 10: 26, 11: 17,
    15: 12, 16: 19, 17: 2, 19: 3, 21: 6, 25: 10, 28: 29, 30: 31, 31: 32,
    35: 34, 37: 36, 38: 38, 39: 37, 40: 45, 42: 44, 43: 18, 48: 43, 49: 47
};

const SUBNET_10_OCTETS: Record<number, number> = {
    53: 48, 54: 49, 55: 51, 56: 50, 58: 52, 59: 54, 60: 53, 63: 64, 64: 63
};

/**
 * Resuelve la dirección IP privada exclusivamente en la aplicación de escritorio.
 * En la versión Web (PWA / GitHub Pages) retorna loopback ('127.0.0.1') para prevenir fuga de topología de red.
 */
export function resolveBranchIp(branchId: number): string {
    if (!isTauriEnvironment()) {
        return '127.0.0.1';
    }
    if (branchId === 1) {
        return '172.30.40.63';
    }
    if (SUBNET_192_OCTETS[branchId]) {
        return `192.168.${SUBNET_192_OCTETS[branchId]}.10`;
    }
    if (SUBNET_10_OCTETS[branchId]) {
        return `10.0.${SUBNET_10_OCTETS[branchId]}.10`;
    }
    return `10.0.${branchId}.10`;
}

// Metadatos oficiales de las 71 Sucursales de Farmaplus
const RAW_BRANCH_METADATA = [
    { branchId: 1, name: 'FP ADM (Pruebas)', code: 'S01', sigla: 'FP01' },
    { branchId: 2, name: 'PARQUE PATRICIOS', code: 'S02', sigla: 'FP39' },
    { branchId: 4, name: 'RETIRO II', code: 'S04', sigla: 'FP02' },
    { branchId: 5, name: 'RECOLETA IV', code: 'S05', sigla: 'FP03' },
    { branchId: 6, name: 'RECOLETA II', code: 'S06', sigla: 'FP04' },
    { branchId: 7, name: 'BELGRANO', code: 'S07', sigla: 'FP05' },
    { branchId: 8, name: 'MICROCENTRO II', code: 'S08', sigla: 'FP06' },
    { branchId: 9, name: 'CABALLITO III', code: 'S09', sigla: 'FP07' },
    { branchId: 10, name: 'RECOLETA', code: 'S10', sigla: 'FP08' },
    { branchId: 11, name: 'POMPEYA', code: 'S11', sigla: 'FP09' },
    { branchId: 12, name: 'DEVOTO', code: 'S12', sigla: 'FP10' },
    { branchId: 13, name: 'RECOLETA III', code: 'S13', sigla: 'FP11' },
    { branchId: 14, name: 'LAS CANITAS', code: 'S14', sigla: 'FP12' },
    { branchId: 15, name: 'PALERMO', code: 'S15', sigla: 'FP13' },
    { branchId: 16, name: 'TRIBUNALES', code: 'S16', sigla: 'FP14' },
    { branchId: 17, name: 'RETIRO', code: 'S17', sigla: 'FP15' },
    { branchId: 18, name: 'NUNEZ', code: 'S18', sigla: 'FP16' },
    { branchId: 19, name: 'RECOLETA V', code: 'S19', sigla: 'FP17' },
    { branchId: 20, name: 'CABALLITO', code: 'S20', sigla: 'FP18' },
    { branchId: 21, name: 'CABALLITO II', code: 'S21', sigla: 'FP19' },
    { branchId: 22, name: 'FLORES', code: 'S22', sigla: 'FP20' },
    { branchId: 23, name: 'SAN ISIDRO', code: 'S23', sigla: 'FP21' },
    { branchId: 24, name: 'BECCAR', code: 'S24', sigla: 'FP22' },
    { branchId: 25, name: 'SAN ISIDRO II', code: 'S25', sigla: 'FP23' },
    { branchId: 26, name: 'BELGRANO VI', code: 'S26', sigla: 'FP43' },
    { branchId: 27, name: 'MICROCENTRO', code: 'S27', sigla: 'FP25' },
    { branchId: 28, name: 'BELGRANO V', code: 'S28', sigla: 'FP26' },
    { branchId: 29, name: 'VILLA URQUIZA', code: 'S29', sigla: 'FP27' },
    { branchId: 30, name: 'VILLA DEL PARQUE', code: 'S30', sigla: 'FP28' },
    { branchId: 31, name: 'VILLA URQUIZA II', code: 'S31', sigla: 'FP29' },
    { branchId: 32, name: 'VILLA URQUIZA III', code: 'S32', sigla: 'FP30' },
    { branchId: 34, name: 'LOREAL G. PACIFICO', code: 'S34', sigla: 'FP32' },
    { branchId: 35, name: 'BERAZATEGUI II', code: 'S35', sigla: 'FP33' },
    { branchId: 36, name: 'BERAZATEGUI', code: 'S36', sigla: 'FP34' },
    { branchId: 37, name: 'QUILMES', code: 'S37', sigla: 'FP35' },
    { branchId: 38, name: 'BELGRANO IV', code: 'S38', sigla: 'FP36' },
    { branchId: 39, name: 'BELGRANO III', code: 'S39', sigla: 'FP37' },
    { branchId: 40, name: 'VILLA CRESPO', code: 'S40', sigla: 'FP41' },
    { branchId: 42, name: 'BARRACAS', code: 'S42', sigla: 'FP42' },
    { branchId: 43, name: 'BELGRANO II', code: 'S43', sigla: 'FP24' },
    { branchId: 44, name: 'VILLA BALLESTER', code: 'S44', sigla: 'FP44' },
    { branchId: 45, name: 'VILLA BALLESTER II', code: 'S45', sigla: 'FP45' },
    { branchId: 46, name: 'SAN MIGUEL', code: 'S46', sigla: 'FP46' },
    { branchId: 47, name: 'VILLA DEL PARQUE II', code: 'S47', sigla: 'FP38' },
    { branchId: 48, name: 'PARQUE CENTENARIO', code: 'S48', sigla: 'FP40' },
    { branchId: 49, name: 'PILAR', code: 'S49', sigla: 'FP47' },
    { branchId: 50, name: 'ISDIN G. PACIFICO', code: 'S50', sigla: 'FP48' },
    { branchId: 51, name: 'LOREAL ALTO PALERMO', code: 'S51', sigla: 'FP49' },
    { branchId: 52, name: 'ISDIN PALERMO', code: 'S52', sigla: 'FP50' },
    { branchId: 53, name: 'BELGRANO VII', code: 'S53', sigla: 'FP51' },
    { branchId: 54, name: 'PALERMO II', code: 'S54', sigla: 'FP52' },
    { branchId: 55, name: 'BELGRANO VIII', code: 'S55', sigla: 'FP53' },
    { branchId: 56, name: 'CABALLITO IV', code: 'S56', sigla: 'FP54' },
    { branchId: 58, name: 'VILLA LURO', code: 'S58', sigla: 'FP55' },
    { branchId: 59, name: 'PALERMO III', code: 'S59', sigla: 'FP56' },
    { branchId: 60, name: 'CHACARITA', code: 'S60', sigla: 'FP57' },
    { branchId: 61, name: 'GONZALEZ CATAN', code: 'S61', sigla: 'FP58' },
    { branchId: 62, name: 'MORON', code: 'S62', sigla: 'Suc62' },
    { branchId: 63, name: 'RAMOS MEJIA II', code: 'S63', sigla: 'Suc63' },
    { branchId: 64, name: 'RAMOS MEJIA', code: 'S64', sigla: 'Suc64' },
    { branchId: 65, name: 'BOEDO', code: 'S65', sigla: 'Suc65' },
    { branchId: 66, name: 'DEVOTO II', code: 'S66', sigla: 'Suc66' },
    { branchId: 67, name: 'GONZALEZ CATAN II', code: 'S67', sigla: 'SUC67' },
    { branchId: 68, name: 'GONZALEZ CATAN III', code: 'S68', sigla: 'SUC68' },
    { branchId: 69, name: 'RAMOS MEJIA III', code: 'S69', sigla: 'SUC69' },
    { branchId: 70, name: 'SALADILLO', code: 'S70', sigla: 'SUC70' },
    { branchId: 71, name: 'PADUA', code: 'S71', sigla: 'SUC71' },
    { branchId: 72, name: 'MERCEDES', code: 'S72', sigla: 'SUC72' },
    { branchId: 73, name: 'ESCOBAR', code: 'S73', sigla: 'SUC73' },
    { branchId: 74, name: 'PALERMO IV', code: 'S74', sigla: 'SUC74' },
    { branchId: 75, name: 'DEVOTO III', code: 'S75', sigla: 'SUC75' },
    { branchId: 76, name: 'PILAR II', code: 'S76', sigla: 'SUC76' },
];

export const OFFICIAL_71_BRANCHES: OfficialBranchInfo[] = RAW_BRANCH_METADATA.map((b) => ({
    ...b,
    get primaryIp() {
        return resolveBranchIp(b.branchId);
    },
    get fallbackIps() {
        const ip = this.primaryIp;
        if (!isTauriEnvironment() || ip === '127.0.0.1') {
            return ['127.0.0.1'];
        }
        const fallbacks: string[] = [];
        if (ip.startsWith('10.0.')) {
            const parts = ip.split('.');
            fallbacks.push(`192.168.${parts[2]}.${parts[3]}`);
        } else if (ip.startsWith('192.168.')) {
            const parts = ip.split('.');
            fallbacks.push(`10.0.${parts[2]}.${parts[3]}`);
        }
        return fallbacks;
    }
}));

export const AUDITED_BRANCH_IPS: Record<string, { branchId: number; primaryIp: string; fallbackIps: string[] }> = (() => {
    const map: Record<string, { branchId: number; primaryIp: string; fallbackIps: string[] }> = {};
    OFFICIAL_71_BRANCHES.forEach(b => {
        map[b.name] = {
            branchId: b.branchId,
            get primaryIp() {
                return b.primaryIp;
            },
            get fallbackIps() {
                return b.fallbackIps || ['127.0.0.1'];
            }
        };
    });
    return map;
})();

/**
 * Obtiene la configuración de conexión MySQL para una sucursal determinada
 */
export function getBranchMysqlHostConfig(rawBranchName: string): BranchHostConfig {
    if (!isTauriEnvironment()) {
        return {
            branchName: rawBranchName,
            officialName: rawBranchName,
            branchId: 0,
            primaryIp: '127.0.0.1',
            fallbackIps: ['127.0.0.1'],
            port: 3306,
            user: 'root',
            database: 'plex'
        };
    }

    const clean = normalizeString(rawBranchName || '').toUpperCase();
    
    // 1. Coincidencia directa o normalizada
    for (const b of OFFICIAL_71_BRANCHES) {
        const normName = normalizeString(b.name).toUpperCase();
        if (clean === normName || clean.includes(normName) || normName.includes(clean)) {
            return {
                branchName: rawBranchName,
                officialName: b.name,
                branchId: b.branchId,
                primaryIp: b.primaryIp,
                fallbackIps: b.fallbackIps || ['127.0.0.1'],
                port: 3306,
                user: 'root',
                database: 'plex'
            };
        }
    }

    // 2. Fallback por número si no está en la tabla
    const numMatch = rawBranchName.match(/\d+/);
    const branchNum = numMatch ? parseInt(numMatch[0], 10) : 4;
    const resolvedIp = resolveBranchIp(branchNum);
    
    return {
        branchName: rawBranchName,
        officialName: rawBranchName,
        branchId: branchNum,
        primaryIp: resolvedIp,
        fallbackIps: [`192.168.${branchNum}.10`, '127.0.0.1'],
        port: 3306,
        user: 'root',
        database: 'plex'
    };
}

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
    database: string;
}

// Las 71 Sucursales Oficiales de Farmaplus
export const OFFICIAL_71_BRANCHES: OfficialBranchInfo[] = [
    { branchId: 1, name: 'FP ADM (Pruebas)', code: 'S01', sigla: 'FP01', primaryIp: '172.30.40.63', fallbackIps: ['172.30.40.63', '127.0.0.1'] },
    { branchId: 2, name: 'PARQUE PATRICIOS', code: 'S02', sigla: 'FP39', primaryIp: '192.168.42.10' },
    { branchId: 4, name: 'RETIRO II', code: 'S04', sigla: 'FP02', primaryIp: '192.168.22.10' },
    { branchId: 5, name: 'RECOLETA IV', code: 'S05', sigla: 'FP03', primaryIp: '192.168.43.10' },
    { branchId: 6, name: 'RECOLETA II', code: 'S06', sigla: 'FP04', primaryIp: '192.168.14.10' },
    { branchId: 7, name: 'BELGRANO', code: 'S07', sigla: 'FP05', primaryIp: '192.168.25.10' },
    { branchId: 8, name: 'MICROCENTRO II', code: 'S08', sigla: 'FP06', primaryIp: '192.168.27.10' },
    { branchId: 9, name: 'CABALLITO III', code: 'S09', sigla: 'FP07', primaryIp: '192.168.24.10' },
    { branchId: 10, name: 'RECOLETA', code: 'S10', sigla: 'FP08', primaryIp: '192.168.26.10' },
    { branchId: 11, name: 'POMPEYA', code: 'S11', sigla: 'FP09', primaryIp: '192.168.17.10' },
    { branchId: 12, name: 'DEVOTO', code: 'S12', sigla: 'FP10', primaryIp: '10.0.12.10' },
    { branchId: 13, name: 'RECOLETA III', code: 'S13', sigla: 'FP11', primaryIp: '10.0.13.10' },
    { branchId: 14, name: 'LAS CANITAS', code: 'S14', sigla: 'FP12', primaryIp: '10.0.14.10' },
    { branchId: 15, name: 'PALERMO', code: 'S15', sigla: 'FP13', primaryIp: '192.168.12.10' },
    { branchId: 16, name: 'TRIBUNALES', code: 'S16', sigla: 'FP14', primaryIp: '192.168.19.10' },
    { branchId: 17, name: 'RETIRO', code: 'S17', sigla: 'FP15', primaryIp: '192.168.2.10' },
    { branchId: 18, name: 'NUNEZ', code: 'S18', sigla: 'FP16', primaryIp: '10.0.18.10' },
    { branchId: 19, name: 'RECOLETA V', code: 'S19', sigla: 'FP17', primaryIp: '192.168.3.10' },
    { branchId: 20, name: 'CABALLITO', code: 'S20', sigla: 'FP18', primaryIp: '10.0.20.10' },
    { branchId: 21, name: 'CABALLITO II', code: 'S21', sigla: 'FP19', primaryIp: '192.168.6.10' },
    { branchId: 22, name: 'FLORES', code: 'S22', sigla: 'FP20', primaryIp: '10.0.22.10' },
    { branchId: 23, name: 'SAN ISIDRO', code: 'S23', sigla: 'FP21', primaryIp: '10.0.23.10' },
    { branchId: 24, name: 'BECCAR', code: 'S24', sigla: 'FP22', primaryIp: '10.0.24.10' },
    { branchId: 25, name: 'SAN ISIDRO II', code: 'S25', sigla: 'FP23', primaryIp: '192.168.10.10' },
    { branchId: 26, name: 'BELGRANO VI', code: 'S26', sigla: 'FP43', primaryIp: '10.0.26.10' },
    { branchId: 27, name: 'MICROCENTRO', code: 'S27', sigla: 'FP25', primaryIp: '10.0.27.10' },
    { branchId: 28, name: 'BELGRANO V', code: 'S28', sigla: 'FP26', primaryIp: '192.168.29.10' },
    { branchId: 29, name: 'VILLA URQUIZA', code: 'S29', sigla: 'FP27', primaryIp: '10.0.29.10' },
    { branchId: 30, name: 'VILLA DEL PARQUE', code: 'S30', sigla: 'FP28', primaryIp: '192.168.31.10' },
    { branchId: 31, name: 'VILLA URQUIZA II', code: 'S31', sigla: 'FP29', primaryIp: '192.168.32.10' },
    { branchId: 32, name: 'VILLA URQUIZA III', code: 'S32', sigla: 'FP30', primaryIp: '10.0.32.10' },
    { branchId: 34, name: 'LOREAL G. PACIFICO', code: 'S34', sigla: 'FP32', primaryIp: '10.0.34.10' },
    { branchId: 35, name: 'BERAZATEGUI II', code: 'S35', sigla: 'FP33', primaryIp: '192.168.34.10' },
    { branchId: 36, name: 'BERAZATEGUI', code: 'S36', sigla: 'FP34', primaryIp: '10.0.36.10' },
    { branchId: 37, name: 'QUILMES', code: 'S37', sigla: 'FP35', primaryIp: '192.168.36.10' },
    { branchId: 38, name: 'BELGRANO IV', code: 'S38', sigla: 'FP36', primaryIp: '192.168.38.10' },
    { branchId: 39, name: 'BELGRANO III', code: 'S39', sigla: 'FP37', primaryIp: '192.168.37.10' },
    { branchId: 40, name: 'VILLA CRESPO', code: 'S40', sigla: 'FP41', primaryIp: '192.168.45.10' },
    { branchId: 42, name: 'BARRACAS', code: 'S42', sigla: 'FP42', primaryIp: '192.168.44.10' },
    { branchId: 43, name: 'BELGRANO II', code: 'S43', sigla: 'FP24', primaryIp: '192.168.18.10' },
    { branchId: 44, name: 'VILLA BALLESTER', code: 'S44', sigla: 'FP44', primaryIp: '10.0.44.10' },
    { branchId: 45, name: 'VILLA BALLESTER II', code: 'S45', sigla: 'FP45', primaryIp: '10.0.45.10' },
    { branchId: 46, name: 'SAN MIGUEL', code: 'S46', sigla: 'FP46', primaryIp: '10.0.46.10' },
    { branchId: 47, name: 'VILLA DEL PARQUE II', code: 'S47', sigla: 'FP38', primaryIp: '10.0.47.10' },
    { branchId: 48, name: 'PARQUE CENTENARIO', code: 'S48', sigla: 'FP40', primaryIp: '192.168.43.10' },
    { branchId: 49, name: 'PILAR', code: 'S49', sigla: 'FP47', primaryIp: '192.168.47.10' },
    { branchId: 50, name: 'ISDIN G. PACIFICO', code: 'S50', sigla: 'FP48', primaryIp: '10.0.50.10' },
    { branchId: 51, name: 'LOREAL ALTO PALERMO', code: 'S51', sigla: 'FP49', primaryIp: '10.0.51.10' },
    { branchId: 52, name: 'ISDIN PALERMO', code: 'S52', sigla: 'FP50', primaryIp: '10.0.52.10' },
    { branchId: 53, name: 'BELGRANO VII - DANESA', code: 'S53', sigla: 'FP51', primaryIp: '10.0.48.10' },
    { branchId: 54, name: 'PALERMO II', code: 'S54', sigla: 'FP52', primaryIp: '10.0.49.10' },
    { branchId: 55, name: 'BELGRANO VIII', code: 'S55', sigla: 'FP53', primaryIp: '10.0.51.10' },
    { branchId: 56, name: 'CABALLITO IV', code: 'S56', sigla: 'FP54', primaryIp: '10.0.50.10' },
    { branchId: 58, name: 'VILLA LURO', code: 'S58', sigla: 'FP55', primaryIp: '10.0.52.10' },
    { branchId: 59, name: 'PALERMO III', code: 'S59', sigla: 'FP56', primaryIp: '10.0.54.10' },
    { branchId: 60, name: 'CHACARITA', code: 'S60', sigla: 'FP57', primaryIp: '10.0.53.10' },
    { branchId: 61, name: 'GONZALEZ CATAN', code: 'S61', sigla: 'FP58', primaryIp: '10.0.61.10' },
    { branchId: 62, name: 'MORON', code: 'S62', sigla: 'Suc62', primaryIp: '10.0.62.10' },
    { branchId: 63, name: 'RAMOS MEJIA II', code: 'S63', sigla: 'Suc63', primaryIp: '10.0.64.10' },
    { branchId: 64, name: 'RAMOS MEJIA', code: 'S64', sigla: 'Suc64', primaryIp: '10.0.63.10' },
    { branchId: 65, name: 'BOEDO', code: 'S65', sigla: 'Suc65', primaryIp: '10.0.65.10' },
    { branchId: 66, name: 'DEVOTO II', code: 'S66', sigla: 'Suc66', primaryIp: '10.0.66.10' },
    { branchId: 67, name: 'GONZALEZ CATAN II', code: 'S67', sigla: 'SUC67', primaryIp: '10.0.67.10' },
    { branchId: 68, name: 'GONZALEZ CATAN III', code: 'S68', sigla: 'SUC68', primaryIp: '10.0.68.10' },
    { branchId: 69, name: 'RAMOS MEJIA III', code: 'S69', sigla: 'SUC69', primaryIp: '10.0.69.10' },
    { branchId: 70, name: 'SALADILLO', code: 'S70', sigla: 'SUC70', primaryIp: '10.0.70.10' },
    { branchId: 71, name: 'PADUA', code: 'S71', sigla: 'SUC71', primaryIp: '10.0.71.10' },
    { branchId: 72, name: 'MERCEDES', code: 'S72', sigla: 'SUC72', primaryIp: '10.0.72.10' },
    { branchId: 73, name: 'ESCOBAR', code: 'S73', sigla: 'SUC73', primaryIp: '10.0.73.10' },
    { branchId: 74, name: 'PALERMO IV', code: 'S74', sigla: 'SUC74', primaryIp: '10.0.74.10' },
    { branchId: 75, name: 'DEVOTO III', code: 'S75', sigla: 'SUC75', primaryIp: '10.0.75.10' },
    { branchId: 76, name: 'PILAR II', code: 'S76', sigla: 'SUC76', primaryIp: '10.0.76.10' },
];

export const AUDITED_BRANCH_IPS: Record<string, { branchId: number; primaryIp: string; fallbackIps: string[] }> = (() => {
    const map: Record<string, { branchId: number; primaryIp: string; fallbackIps: string[] }> = {};
    OFFICIAL_71_BRANCHES.forEach(b => {
        const fallbacks: string[] = [];
        if (b.primaryIp.startsWith('10.0.')) {
            const parts = b.primaryIp.split('.');
            fallbacks.push(`192.168.${parts[2]}.${parts[3]}`);
        } else if (b.primaryIp.startsWith('192.168.')) {
            const parts = b.primaryIp.split('.');
            fallbacks.push(`10.0.${parts[2]}.${parts[3]}`);
        }
        map[b.name] = {
            branchId: b.branchId,
            primaryIp: b.primaryIp,
            fallbackIps: fallbacks
        };
    });
    return map;
})();

/**
 * Obtiene la configuración de conexión MySQL para una sucursal determinada
 */
export function getBranchMysqlHostConfig(rawBranchName: string): BranchHostConfig {
    const clean = normalizeString(rawBranchName || '').toUpperCase();
    
    // 1. Coincidencia directa o normalizada
    for (const b of OFFICIAL_71_BRANCHES) {
        const normName = normalizeString(b.name).toUpperCase();
        if (clean === normName || clean.includes(normName) || normName.includes(clean)) {
            const fallbacks: string[] = [];
            if (b.primaryIp.startsWith('10.0.')) {
                const parts = b.primaryIp.split('.');
                fallbacks.push(`192.168.${parts[2]}.${parts[3]}`);
            } else if (b.primaryIp.startsWith('192.168.')) {
                const parts = b.primaryIp.split('.');
                fallbacks.push(`10.0.${parts[2]}.${parts[3]}`);
            }

            return {
                branchName: rawBranchName,
                officialName: b.name,
                branchId: b.branchId,
                primaryIp: b.primaryIp,
                fallbackIps: fallbacks,
                port: 3306,
                user: 'root',
                database: 'plex'
            };
        }
    }

    // 2. Fallback por número si no está en la tabla
    const numMatch = rawBranchName.match(/\d+/);
    const branchNum = numMatch ? parseInt(numMatch[0], 10) : 4;
    
    return {
        branchName: rawBranchName,
        officialName: rawBranchName,
        branchId: branchNum,
        primaryIp: `10.0.${branchNum}.10`,
        fallbackIps: [`192.168.${branchNum}.10`, '127.0.0.1'],
        port: 3306,
        user: 'root',
        database: 'plex'
    };
}

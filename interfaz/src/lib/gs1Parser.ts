/**
 * Parser de códigos GS1 DataMatrix para medicamentos trazables ANMAT.
 * Extrae GTIN (01), Serie (21), Lote (10) y Vencimiento (17).
 * Soporta delimitadores ASCII 29 (\u001d), identificadores de simbología (]d2) y formato con paréntesis.
 */

export interface ParsedGS1 {
    raw: string;
    gtin?: string;
    ean?: string;
    serial?: string;
    lot?: string;
    expiry?: string;
    isValid: boolean;
}

const PAREN_PATTERN = /\((\d{2,4})\)([^\(\)]+)/g;

export function isPossibleDataMatrix(code: string): boolean {
    if (!code) return false;
    const s = code.trim();
    if (s.startsWith(']d2') || s.startsWith(']Q3') || s.startsWith(']C1')) return true;
    if (s.includes('\u001d')) return true;
    if (s.startsWith('(01)') || (s.includes('(01)') && s.includes('(21)'))) return true;
    if (s.startsWith('01') && s.length >= 18 && (s.includes('\u001d') || s.includes('21') || s.includes('17') || s.includes('10'))) {
        return true;
    }
    return false;
}

export function parseGS1DataMatrix(rawInput: string): ParsedGS1 {
    if (!rawInput) {
        return { raw: '', isValid: false };
    }

    let data = rawInput.trim();
    if (data.startsWith(']d2') || data.startsWith(']Q3') || data.startsWith(']C1')) {
        data = data.substring(3);
    }

    let gtin: string | undefined;
    let serial: string | undefined;
    let lot: string | undefined;
    let expiry: string | undefined;

    // Caso 1: Paréntesis explícitos
    if (data.includes('(') && data.includes(')')) {
        const matches = [...data.matchAll(PAREN_PATTERN)];
        for (const m of matches) {
            const ai = m[1];
            const val = m[2];
            if (ai === '01') gtin = val;
            else if (ai === '21') serial = val;
            else if (ai === '10') lot = val;
            else if (ai === '17') expiry = val;
        }
    } else {
        // Caso 2: Stream continuo con delimitadores GS (\u001d)
        let i = 0;
        const n = data.length;
        while (i < n) {
            const c = data[i];
            if (c === '\u001d') {
                i++;
                continue;
            }

            if (i + 2 <= n) {
                const ai2 = data.substring(i, i + 2);
                if (ai2 === '01' && i + 16 <= n) {
                    gtin = data.substring(i + 2, i + 16);
                    i += 16;
                    continue;
                } else if (ai2 === '17' && i + 8 <= n) {
                    expiry = data.substring(i + 2, i + 8);
                    i += 8;
                    continue;
                } else if (ai2 === '11' && i + 8 <= n) {
                    i += 8;
                    continue;
                } else if (ai2 === '10' || ai2 === '21') {
                    const valStart = i + 2;
                    let valEnd = valStart;
                    while (valEnd < n && data[valEnd] !== '\u001d') {
                        if (valEnd - valStart >= 20) break;
                        valEnd++;
                    }
                    const val = data.substring(valStart, valEnd);
                    if (ai2 === '10') {
                        lot = val;
                    } else {
                        serial = val;
                    }
                    i = valEnd;
                    continue;
                }
            }
            i++;
        }
    }

    // Formatear vencimiento YYMMDD -> AAAA-MM-DD
    let formattedExpiry = expiry;
    if (expiry && expiry.length === 6 && /^\d{6}$/.test(expiry)) {
        const yy = parseInt(expiry.substring(0, 2), 10);
        const mm = expiry.substring(2, 4);
        const dd = expiry.substring(4, 6);
        const century = yy < 70 ? '20' : '19';
        formattedExpiry = `${century}${yy < 10 ? '0' + yy : yy}-${mm}-${dd}`;
    }

    // EAN deducido del GTIN-14
    let ean = gtin;
    if (ean && ean.length === 14 && ean.startsWith('0')) {
        ean = ean.substring(1);
    }

    const isValid = !!((gtin && gtin.length >= 8) || (serial && serial.length >= 3));

    return {
        raw: rawInput,
        gtin,
        ean,
        serial,
        lot,
        expiry: formattedExpiry,
        isValid,
    };
}

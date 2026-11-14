import { supabase } from "@/integrations/supabase/client";
import { getSectorByPrefix } from "@/constants/farmaplusSectors";

export type FacesPreset = "none" | "A-B" | "A-C" | "A-D";
export type ScanDirection = "vertical" | "horizontal";

export interface LocationGroupConfig {
    id: string;
    prefix: string; // e.g. GON, ESP, HELA, CAJ, MOS, DEP
    categoryBadge: string; // e.g. PERFUMERÍA, MEDICAMENTOS
    unitCount: number;
    facesPreset: FacesPreset;
    direction: ScanDirection;
    excludedTags?: string[];
}

export interface BranchLocationItem {
    branchName: string;
    locationTag: string;
    qrPayload: string;
    prefix: string;
    unitNumber: number;
    unitTotal: number;
    faceLabel: string | null;
    faceRange: string | null;
    displayTitle: string;
    displaySubtitle: string;
    categoryBadge: string;
    scanDirection: ScanDirection;
    scanInstruction: string;
    isActive: boolean;
}

export interface SessionLocationAuditRow {
    locationTag: string;
    displayTitle: string;
    categoryBadge: string;
    status: "pending" | "open" | "closed";
    openedByUser: string | null;
    openedByDevice: string | null;
    openedAt: string | null;
    closedByUser: string | null;
    closedByDevice: string | null;
    closedAt: string | null;
    skuCount: number;
    totalUnits: number;
}

export const SCAN_INSTRUCTIONS: Record<ScanDirection, string> = {
    vertical: "Recordá contar en sentido VERTICAL: arriba → abajo en esta cara. Terminá el sector antes de pasar al siguiente.",
    horizontal: "Recordá contar en sentido HORIZONTAL: izquierda → derecha en esta cara. Terminá el sector antes de pasar al siguiente.",
};

const FACES_BY_PRESET: Record<FacesPreset, string[]> = {
    none: [],
    "A-B": ["A", "B"],
    "A-C": ["A", "B", "C"],
    "A-D": ["A", "B", "C", "D"],
};

export function normalizeBranchKey(name: string): string {
    return (name || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getFurnitureDisplayName(prefix: string): string {
    const def = getSectorByPrefix(prefix);
    if (!def) return prefix.toUpperCase();
    // "Góndola (GON)" -> "Góndola"
    return def.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function expandLocationGroups(
    branchName: string,
    groups: LocationGroupConfig[]
): BranchLocationItem[] {
    const cleanBranch = (branchName || "SUCURSAL").trim().toUpperCase();
    const result: BranchLocationItem[] = [];
    const seenTags = new Set<string>();

    for (const group of groups) {
        const prefix = group.prefix.trim().toUpperCase();
        const furnitureName = getFurnitureDisplayName(prefix);
        const totalUnits = Math.max(1, Math.min(99, Math.floor(group.unitCount || 1)));
        const faces = FACES_BY_PRESET[group.facesPreset] || [];
        const excluded = new Set((group.excludedTags || []).map((t) => t.toUpperCase()));
        const direction: ScanDirection = group.direction === "horizontal" ? "horizontal" : "vertical";
        const instruction = SCAN_INSTRUCTIONS[direction];
        const badge = (group.categoryBadge || "GENERAL").trim().toUpperCase();

        for (let u = 1; u <= totalUnits; u++) {
            const paddedUnit = u < 10 ? `0${u}` : String(u);

            if (faces.length === 0) {
                const tag = `${prefix}-${paddedUnit}`;
                if (seenTags.has(tag)) continue;
                seenTags.add(tag);

                result.push({
                    branchName: cleanBranch,
                    locationTag: tag,
                    qrPayload: `POS:${tag}`,
                    prefix,
                    unitNumber: u,
                    unitTotal: totalUnits,
                    faceLabel: null,
                    faceRange: null,
                    displayTitle: `${furnitureName} ${u}`,
                    displaySubtitle: `Unidad ${u} de ${totalUnits}`,
                    categoryBadge: badge,
                    scanDirection: direction,
                    scanInstruction: instruction,
                    isActive: !excluded.has(tag),
                });
            } else {
                const faceRange = `${faces[0]}-${faces[faces.length - 1]}`;
                for (const face of faces) {
                    const tag = `${prefix}-${paddedUnit}-${face}`;
                    if (seenTags.has(tag)) continue;
                    seenTags.add(tag);

                    result.push({
                        branchName: cleanBranch,
                        locationTag: tag,
                        qrPayload: `POS:${tag}`,
                        prefix,
                        unitNumber: u,
                        unitTotal: totalUnits,
                        faceLabel: face,
                        faceRange,
                        displayTitle: `${furnitureName} ${u} · ${face}`,
                        displaySubtitle: `Unidad ${u} de ${totalUnits} · Cara ${face} de ${faceRange}`,
                        categoryBadge: badge,
                        scanDirection: direction,
                        scanInstruction: instruction,
                        isActive: !excluded.has(tag),
                    });
                }
            }
        }
    }

    return result;
}

/**
 * Reconstruye grupos editables a partir de las ubicaciones persistidas en Supabase.
 */
export function collapseLocationsToGroups(items: BranchLocationItem[]): LocationGroupConfig[] {
    if (!items || items.length === 0) return [];
    const grouped = new Map<string, {
        prefix: string;
        categoryBadge: string;
        maxUnit: number;
        faceRange: string | null;
        direction: ScanDirection;
        excludedTags: string[];
    }>();

    for (const item of items) {
        const dir: ScanDirection = item.scanInstruction?.includes("HORIZONTAL") ? "horizontal" : "vertical";
        const key = `${item.prefix}__${item.faceRange || "none"}__${item.categoryBadge || "GENERAL"}__${dir}`;
        const current = grouped.get(key) || {
            prefix: item.prefix,
            categoryBadge: item.categoryBadge || "GENERAL",
            maxUnit: item.unitTotal || item.unitNumber || 1,
            faceRange: item.faceRange,
            direction: dir,
            excludedTags: [],
        };
        current.maxUnit = Math.max(current.maxUnit, item.unitTotal || 1, item.unitNumber || 1);
        if (!item.isActive) {
            current.excludedTags.push(item.locationTag);
        }
        grouped.set(key, current);
    }

    let idx = 0;
    return Array.from(grouped.values()).map((g) => {
        let facesPreset: FacesPreset = "none";
        if (g.faceRange === "A-B" || g.faceRange === "A-C" || g.faceRange === "A-D") {
            facesPreset = g.faceRange;
        }
        return {
            id: `grp_${++idx}_${g.prefix}`,
            prefix: g.prefix,
            categoryBadge: g.categoryBadge,
            unitCount: g.maxUnit,
            facesPreset,
            direction: g.direction,
            excludedTags: g.excludedTags,
        };
    });
}

export async function fetchBranchLocations(branchName: string): Promise<BranchLocationItem[]> {
    const cleanBranch = (branchName || "").trim().toUpperCase();
    if (!cleanBranch) return [];

    const { data, error } = await (supabase as any)
        .from("branch_inventory_locations")
        .select("*")
        .eq("branch_name", cleanBranch)
        .order("location_tag", { ascending: true });

    if (error) {
        console.warn("[BranchLocations] Error leyendo ubicaciones:", error.message || error);
        return [];
    }

    return (data || []).map((row: any) => {
        const instruction = row.scan_instruction || SCAN_INSTRUCTIONS.vertical;
        const dir: ScanDirection = instruction.includes("HORIZONTAL") ? "horizontal" : "vertical";
        return {
            branchName: row.branch_name,
            locationTag: row.location_tag,
            qrPayload: `POS:${row.location_tag}`,
            prefix: row.prefix,
            unitNumber: row.unit_number ?? 1,
            unitTotal: row.unit_total ?? 1,
            faceLabel: row.face_label ?? null,
            faceRange: row.face_range ?? null,
            displayTitle: row.display_title,
            displaySubtitle: row.display_subtitle || "",
            categoryBadge: row.category_badge || "GENERAL",
            scanDirection: dir,
            scanInstruction: instruction,
            isActive: row.is_active !== false,
        };
    });
}

export async function saveBranchLocations(
    branchName: string,
    branchId: string | null | undefined,
    locations: BranchLocationItem[],
    userId?: string | null
): Promise<{ ok: boolean; count: number; error?: string }> {
    const cleanBranch = (branchName || "").trim().toUpperCase();
    if (!cleanBranch) {
        return { ok: false, count: 0, error: "Sucursal inválida" };
    }

    // Reemplazo atómico por sucursal: limpiar anteriores e insertar padrón vigente
    const { error: delErr } = await (supabase as any)
        .from("branch_inventory_locations")
        .delete()
        .eq("branch_name", cleanBranch);

    if (delErr) {
        return { ok: false, count: 0, error: delErr.message || "Error limpiando ubicaciones previas" };
    }

    if (locations.length === 0) {
        return { ok: true, count: 0 };
    }

    const rows = locations.map((loc) => ({
        branch_id: branchId || null,
        branch_name: cleanBranch,
        location_tag: loc.locationTag.toUpperCase(),
        prefix: loc.prefix.toUpperCase(),
        unit_number: loc.unitNumber,
        unit_total: loc.unitTotal,
        face_label: loc.faceLabel,
        face_range: loc.faceRange,
        display_title: loc.displayTitle,
        display_subtitle: loc.displaySubtitle,
        category_badge: loc.categoryBadge,
        scan_instruction: loc.scanInstruction,
        is_active: loc.isActive,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
    }));

    const { error: insErr } = await (supabase as any)
        .from("branch_inventory_locations")
        .insert(rows);

    if (insErr) {
        return { ok: false, count: 0, error: insErr.message || "Error guardando ubicaciones" };
    }

    const activeCount = locations.filter((l) => l.isActive).length;
    return { ok: true, count: activeCount };
}

export async function seedSessionLocationsFromBranch(
    sessionId: string,
    branchName: string
): Promise<number> {
    const cleanBranch = (branchName || "").trim().toUpperCase();
    if (!sessionId || !cleanBranch) return 0;

    try {
        const { data, error } = await (supabase as any).rpc("seed_session_locations_from_branch", {
            p_session_id: sessionId,
            p_branch_name: cleanBranch,
        });
        if (!error && data?.success) {
            return Number(data.count || 0);
        }
    } catch {
        // Fallback if RPC not yet applied
    }

    const locs = await fetchBranchLocations(cleanBranch);
    const active = locs.filter((l) => l.isActive);
    if (active.length === 0) return 0;

    const { error: upsertErr } = await (supabase as any)
        .from("precount_location_status")
        .upsert(
            active.map((l) => ({
                session_id: sessionId,
                location_tag: l.locationTag.toUpperCase(),
                status: "pending",
                display_title: l.displayTitle,
                category_badge: l.categoryBadge,
                updated_at: new Date().toISOString(),
            })),
            { onConflict: "session_id,location_tag", ignoreDuplicates: true }
        );

    return upsertErr ? 0 : active.length;
}

export async function fetchSessionLocationsAudit(
    sessionId: string
): Promise<SessionLocationAuditRow[]> {
    if (!sessionId) return [];

    try {
        const { data, error } = await (supabase as any).rpc("get_session_locations_audit", {
            p_session_id: sessionId,
        });
        if (!error && Array.isArray(data)) {
            return data.map((r: any) => ({
                locationTag: r.location_tag,
                displayTitle: r.display_title || r.location_tag,
                categoryBadge: r.category_badge || "",
                status: (r.status || "pending") as "pending" | "open" | "closed",
                openedByUser: r.opened_by_user || null,
                openedByDevice: r.opened_by_device || null,
                openedAt: r.opened_at || null,
                closedByUser: r.closed_by_user || null,
                closedByDevice: r.closed_by_device || null,
                closedAt: r.closed_at || null,
                skuCount: Number(r.sku_count || 0),
                totalUnits: Number(r.total_units || 0),
            }));
        }
    } catch {
        // Fallback below
    }

    const { data: statusRows } = await (supabase as any)
        .from("precount_location_status")
        .select("*")
        .eq("session_id", sessionId)
        .order("location_tag", { ascending: true });

    if (!Array.isArray(statusRows) || statusRows.length === 0) return [];

    return statusRows.map((r: any) => ({
        locationTag: r.location_tag,
        displayTitle: r.display_title || r.location_tag,
        categoryBadge: r.category_badge || "",
        status: (r.status || "pending") as "pending" | "open" | "closed",
        openedByUser: r.opened_by_user || null,
        openedByDevice: r.opened_by_device || null,
        openedAt: r.opened_at || null,
        closedByUser: r.closed_by_user || null,
        closedByDevice: r.closed_by_device || null,
        closedAt: r.closed_at || null,
        skuCount: 0,
        totalUnits: 0,
    }));
}

/**
 * Sube masivamente todas las fotos de productos (`{ean}.jpg`) desde
 * `C:\Proyectos\Farmaplus\plex\Fotos` (recursivo) al bucket `product-images`
 * de Supabase Storage usando concurrencia alta y reanudación automática.
 *
 * Uso:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/upload_product_images_to_supabase.mjs
 *
 * Opcional:
 *   $env:PHOTOS_DIR="C:\Proyectos\Farmaplus\plex\Fotos"
 *   $env:CONCURRENCY="24"
 *   $env:FORCE_REUPLOAD="1"   # Ignora el checkpoint local y re-sube todo
 */

import fs from "node:fs";
import path from "node:path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_BASE_URL = process.env.SUPABASE_URL || "https://supabase.halu.com.ar";
const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
let AUTH_TOKEN =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    "";
const API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";

const BUCKET = "product-images";
const PHOTOS_DIR = path.resolve(process.env.PHOTOS_DIR || "C:\\Proyectos\\Farmaplus\\plex\\Fotos");
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 24));
const CHECKPOINT_FILE = path.resolve("scripts/.product_images_uploaded.txt");
const FORCE_REUPLOAD = process.env.FORCE_REUPLOAD === "1";

const MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
};

function collectImages(dir, outMap = new Map()) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectImages(fullPath, outMap);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!MIME_BY_EXT[ext]) continue;
            const key = entry.name; // plano: {ean}.jpg
            if (!outMap.has(key)) {
                outMap.set(key, { name: key, fullPath, contentType: MIME_BY_EXT[ext] });
            }
        }
    }
    return outMap;
}

async function resolveAuthToken() {
    if (AUTH_TOKEN) return AUTH_TOKEN;
    if (ADMIN_USER && ADMIN_PASS) {
        const email = ADMIN_USER.includes("@") ? ADMIN_USER : `${ADMIN_USER}@farmaplus.system`;
        const res = await fetch(`${SUPABASE_BASE_URL}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password: ADMIN_PASS }),
        });
        const data = await res.json();
        if (!res.ok || !data?.access_token) {
            throw new Error(`No se pudo iniciar sesión como ${email}: ${data?.error_description || data?.msg || res.status}`);
        }
        AUTH_TOKEN = data.access_token;
        console.log(`[OK] Sesión iniciada como admin (${email}).`);
        return AUTH_TOKEN;
    }
    return "";
}

async function ensureBucketExists() {
    const publicProbe = await fetch(`${SUPABASE_BASE_URL}/storage/v1/object/public/${BUCKET}/__probe__`);
    const probeTxt = await publicProbe.text();
    if (!probeTxt.includes("Bucket not found")) {
        return true;
    }

    const res = await fetch(`${SUPABASE_BASE_URL}/storage/v1/bucket/${BUCKET}`, {
        headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${AUTH_TOKEN}`,
        },
    });
    if (res.ok) return true;

    const createRes = await fetch(`${SUPABASE_BASE_URL}/storage/v1/bucket`, {
        method: "POST",
        headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: BUCKET,
            name: BUCKET,
            public: true,
            file_size_limit: 5242880,
            allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
        }),
    });

    if (createRes.ok) {
        console.log(`[OK] Bucket '${BUCKET}' creado como público.`);
        return true;
    }

    const txt = await createRes.text();
    console.error(`[ERROR] No se pudo verificar/crear el bucket '${BUCKET}' (${createRes.status}): ${txt}`);
    return false;
}

async function uploadOne(item, attempt = 1) {
    const bytes = await fs.promises.readFile(item.fullPath);
    const url = `${SUPABASE_BASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(item.name)}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                apikey: API_KEY,
                Authorization: `Bearer ${AUTH_TOKEN}`,
                "Content-Type": item.contentType,
                "Cache-Control": "31536000",
                "x-upsert": "true",
            },
            body: bytes,
        });

        if (res.ok) return { ok: true };
        const errText = await res.text();
        if (attempt < 3 && (res.status >= 500 || res.status === 429)) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
            return uploadOne(item, attempt + 1);
        }
        return { ok: false, status: res.status, error: errText };
    } catch (err) {
        if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
            return uploadOne(item, attempt + 1);
        }
        return { ok: false, status: 0, error: err?.message || String(err) };
    }
}

async function main() {
    await resolveAuthToken();
    if (!AUTH_TOKEN) {
        console.error(
            "Falta credencial para subir. Usá una de estas 2 opciones:\n" +
            '  1) $env:SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"; node scripts/upload_product_images_to_supabase.mjs\n' +
            '  2) $env:ADMIN_USER="gcoz"; $env:ADMIN_PASS="tu_clave"; node scripts/upload_product_images_to_supabase.mjs'
        );
        process.exit(1);
    }

    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`No existe la carpeta de fotos: ${PHOTOS_DIR}`);
        process.exit(1);
    }

    const bucketReady = await ensureBucketExists();
    if (!bucketReady) process.exit(1);

    const allMap = collectImages(PHOTOS_DIR);
    const allItems = Array.from(allMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const alreadyUploaded = new Set();
    if (!FORCE_REUPLOAD && fs.existsSync(CHECKPOINT_FILE)) {
        const lines = fs.readFileSync(CHECKPOINT_FILE, "utf8").split(/\r?\n/);
        for (const line of lines) {
            if (line.trim()) alreadyUploaded.add(line.trim());
        }
    }

    const pending = allItems.filter((it) => !alreadyUploaded.has(it.name));
    console.log(
        `Fotos detectadas: ${allItems.length} | Ya subidas (checkpoint): ${alreadyUploaded.size} | Pendientes: ${pending.length} | Concurrencia: ${CONCURRENCY}`
    );

    if (pending.length === 0) {
        console.log("Todas las fotos ya estaban subidas.");
        return;
    }

    const checkpointStream = fs.createWriteStream(CHECKPOINT_FILE, { flags: FORCE_REUPLOAD ? "w" : "a" });
    const startedAt = Date.now();
    let cursor = 0;
    let ok = 0;
    let fail = 0;
    let firstErrors = [];

    async function worker() {
        while (true) {
            const idx = cursor++;
            if (idx >= pending.length) break;
            const item = pending[idx];
            const res = await uploadOne(item);
            if (res.ok) {
                ok++;
                checkpointStream.write(item.name + "\n");
            } else {
                fail++;
                if (firstErrors.length < 10) {
                    firstErrors.push(`${item.name} -> [${res.status}] ${res.error}`);
                }
            }

            const done = ok + fail;
            if (done % 250 === 0 || done === pending.length) {
                const elapsedSec = Math.max(0.1, (Date.now() - startedAt) / 1000);
                const rate = (done / elapsedSec).toFixed(1);
                const etaSec = Math.round((pending.length - done) / Math.max(0.1, done / elapsedSec));
                console.log(
                    `[${done}/${pending.length}] OK: ${ok} | Errores: ${fail} | ${rate} img/s | ETA: ~${etaSec}s`
                );
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    checkpointStream.end();

    const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\nFinalizado en ${totalSec}s -> Subidas: ${ok}, Fallidas: ${fail}`);
    if (firstErrors.length > 0) {
        console.error("Primeros errores:\n" + firstErrors.join("\n"));
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

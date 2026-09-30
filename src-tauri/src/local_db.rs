use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;
use tauri::Manager;

use crate::mysql_bridge::{fetch_mysql_stock, MysqlConfig};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalProductRecord {
    pub id_producto: String,
    pub troquel: Option<String>,
    pub name: String,
    pub stock: f64,
    pub sale_price: f64,
    pub cost: f64,
    pub category: Option<String>,
    pub laboratory: Option<String>,
    pub barcode: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalProductInput {
    pub id_producto: String,
    pub troquel: Option<String>,
    pub name: String,
    pub stock: f64,
    pub sale_price: f64,
    pub cost: f64,
    pub category: Option<String>,
    pub laboratory: Option<String>,
    pub eans: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalDbStats {
    pub success: bool,
    pub db_path: String,
    pub total_products: usize,
    pub total_barcodes: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncSummary {
    pub success: bool,
    pub message: String,
    pub total_products_synced: usize,
    pub total_barcodes_indexed: usize,
    pub duration_ms: u128,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalLocationStat {
    pub code: String,
    pub units_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalSessionSummary {
    pub session_id: String,
    pub total_units: i64,
    pub total_skus: i64,
    pub locations: Vec<LocalLocationStat>,
    pub last_scan_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalScanResult {
    pub success: bool,
    pub ean: String,
    pub product_name: String,
    pub quantity: i64,
    pub location_tag: String,
    pub location_total_units: i64,
    pub session_total_units: i64,
    pub session_total_skus: i64,
}

/// Obtiene la ruta del directorio de datos de la aplicación (%APPDATA%/com.farmaplus.desktop/data)
pub fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Error resolviendo app_data_dir: {}", e))?;
    let data_dir = base.join("data");
    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Error creando carpeta data: {}", e))?;
    }
    Ok(data_dir)
}

/// Obtiene la ruta del directorio de exportaciones (%APPDATA%/com.farmaplus.desktop/exports)
pub fn get_exports_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Error resolviendo app_data_dir: {}", e))?;
    let exports_dir = base.join("exports");
    if !exports_dir.exists() {
        std::fs::create_dir_all(&exports_dir)
            .map_err(|e| format!("Error creando carpeta exports: {}", e))?;
    }
    Ok(exports_dir)
}

/// Obtiene la ruta al archivo stock_local.db
pub fn get_sqlite_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = get_data_dir(app)?;
    Ok(data_dir.join("stock_local.db"))
}

/// Abre o crea una conexión con la base SQLite local
pub fn open_sqlite_conn(app: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = get_sqlite_path(app)?;
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Error abriendo base SQLite en {:?}: {}", db_path, e))?;

    // Optimizaciones para lecturas ultra-rápidas en disco
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = -64000;
         PRAGMA temp_store = MEMORY;"
    )
    .map_err(|e| format!("Error aplicando PRAGMA a SQLite: {}", e))?;

    Ok(conn)
}

/// Inicializa el esquema de tablas e índices en stock_local.db
#[tauri::command]
pub async fn init_local_stock_db(app: tauri::AppHandle) -> Result<LocalDbStats, String> {
    let db_path = get_sqlite_path(&app)?;
    let conn = open_sqlite_conn(&app)?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS productos (
            idproducto TEXT PRIMARY KEY,
            troquel TEXT,
            descripcion TEXT NOT NULL,
            stock REAL DEFAULT 0,
            precio REAL DEFAULT 0,
            costo REAL DEFAULT 0,
            rubro TEXT,
            laboratorio TEXT
        );

        CREATE TABLE IF NOT EXISTS codigos_barra (
            codbarra TEXT NOT NULL,
            idproducto TEXT NOT NULL,
            PRIMARY KEY(codbarra, idproducto)
        );

        CREATE INDEX IF NOT EXISTS idx_cb ON codigos_barra(codbarra);
        CREATE INDEX IF NOT EXISTS idx_prod ON productos(idproducto);
        CREATE INDEX IF NOT EXISTS idx_desc ON productos(descripcion);
        CREATE INDEX IF NOT EXISTS idx_troq ON productos(troquel);
        CREATE INDEX IF NOT EXISTS idx_lab ON productos(laboratorio);

        CREATE TABLE IF NOT EXISTS scanned_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            ean TEXT NOT NULL,
            id_producto TEXT,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            location_tag TEXT NOT NULL,
            scanned_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_scan_session ON scanned_items(session_id);
        CREATE INDEX IF NOT EXISTS idx_scan_location ON scanned_items(session_id, location_tag);"
    )
    .map_err(|e| format!("Error creando tablas SQLite: {}", e))?;

    let total_products: usize = conn
        .query_row("SELECT COUNT(*) FROM productos", [], |row| row.get(0))
        .unwrap_or(0);

    let total_barcodes: usize = conn
        .query_row("SELECT COUNT(*) FROM codigos_barra", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(LocalDbStats {
        success: true,
        db_path: db_path.to_string_lossy().to_string(),
        total_products,
        total_barcodes,
    })
}

/// Sincroniza desde el servidor MySQL de la sucursal directo hacia stock_local.db en disco
#[tauri::command]
pub async fn sync_mysql_to_local_db(
    app: tauri::AppHandle,
    config: MysqlConfig,
    custom_query: Option<String>,
) -> Result<SyncSummary, String> {
    let start = Instant::now();

    // 1. Obtener los productos desde MySQL
    let mysql_result = fetch_mysql_stock(config, custom_query).await?;
    if !mysql_result.success {
        return Err(mysql_result.message);
    }

    let products = mysql_result.products;

    // 2. Insertar masivamente en SQLite dentro de una sola transacción
    let mut conn = open_sqlite_conn(&app)?;
    let mut total_barcodes = 0;

    {
        let tx = conn
            .transaction()
            .map_err(|e| format!("Error iniciando transacción SQLite: {}", e))?;

        {
            let mut stmt_prod = tx
                .prepare(
                    "INSERT OR REPLACE INTO productos 
                     (idproducto, troquel, descripcion, stock, precio, costo, rubro, laboratorio) 
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                )
                .map_err(|e| format!("Error preparando INSERT productos: {}", e))?;

            let mut stmt_cb = tx
                .prepare("INSERT OR IGNORE INTO codigos_barra (codbarra, idproducto) VALUES (?1, ?2)")
                .map_err(|e| format!("Error preparando INSERT codigos_barra: {}", e))?;

            for p in &products {
                stmt_prod
                    .execute(params![
                        p.id,
                        p.troquel,
                        p.name,
                        p.stock,
                        p.sale_price,
                        p.cost,
                        p.category,
                        p.laboratory
                    ])
                    .map_err(|e| format!("Error insertando producto {}: {}", p.id, e))?;

                let clean_main_ean = p.ean.trim();
                if !clean_main_ean.is_empty() && clean_main_ean != "0" {
                    stmt_cb.execute(params![clean_main_ean, p.id]).ok();
                    total_barcodes += 1;
                }

                for sec_ean in &p.secondary_eans {
                    let clean_sec = sec_ean.trim();
                    if !clean_sec.is_empty() && clean_sec != "0" {
                        stmt_cb.execute(params![clean_sec, p.id]).ok();
                        total_barcodes += 1;
                    }
                }
            }
        }

        tx.commit()
            .map_err(|e| format!("Error confirmando transacción SQLite: {}", e))?;
    }

    let duration_ms = start.elapsed().as_millis();

    Ok(SyncSummary {
        success: true,
        message: format!(
            "Sincronización exitosa: {} productos y {} códigos indexados en {} ms.",
            products.len(),
            total_barcodes,
            duration_ms
        ),
        total_products_synced: products.len(),
        total_barcodes_indexed: total_barcodes,
        duration_ms,
    })
}

/// Importa un lote de productos (por ejemplo desde un archivo Excel procesado) directo a stock_local.db
#[tauri::command]
pub async fn import_catalog_to_local_db(
    app: tauri::AppHandle,
    products: Vec<LocalProductInput>,
) -> Result<SyncSummary, String> {
    let start = Instant::now();
    let mut conn = open_sqlite_conn(&app)?;
    let mut total_barcodes = 0;

    {
        let tx = conn
            .transaction()
            .map_err(|e| format!("Error iniciando transacción SQLite: {}", e))?;

        {
            let mut stmt_prod = tx
                .prepare(
                    "INSERT OR REPLACE INTO productos 
                     (idproducto, troquel, descripcion, stock, precio, costo, rubro, laboratorio) 
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                )
                .map_err(|e| format!("Error preparando INSERT productos: {}", e))?;

            let mut stmt_cb = tx
                .prepare("INSERT OR IGNORE INTO codigos_barra (codbarra, idproducto) VALUES (?1, ?2)")
                .map_err(|e| format!("Error preparando INSERT codigos_barra: {}", e))?;

            for p in &products {
                stmt_prod
                    .execute(params![
                        p.id_producto,
                        p.troquel,
                        p.name,
                        p.stock,
                        p.sale_price,
                        p.cost,
                        p.category,
                        p.laboratory
                    ])
                    .map_err(|e| format!("Error insertando producto {}: {}", p.id_producto, e))?;

                for ean in &p.eans {
                    let clean_ean = ean.trim();
                    if !clean_ean.is_empty() && clean_ean != "0" {
                        stmt_cb.execute(params![clean_ean, p.id_producto]).ok();
                        total_barcodes += 1;
                    }
                }
            }
        }

        tx.commit()
            .map_err(|e| format!("Error confirmando transacción SQLite: {}", e))?;
    }

    let duration_ms = start.elapsed().as_millis();

    Ok(SyncSummary {
        success: true,
        message: format!(
            "Importación de catálogo exitosa: {} productos y {} códigos indexados en {} ms.",
            products.len(),
            total_barcodes,
            duration_ms
        ),
        total_products_synced: products.len(),
        total_barcodes_indexed: total_barcodes,
        duration_ms,
    })
}

/// Búsqueda ultra-rápida por código de barras, troquel o IDProducto (< 1 ms)
#[tauri::command]
pub async fn search_local_barcode(
    app: tauri::AppHandle,
    barcode: String,
) -> Result<Option<LocalProductRecord>, String> {
    let clean_code = barcode.trim();
    if clean_code.is_empty() {
        return Ok(None);
    }

    let conn = open_sqlite_conn(&app)?;

    // 1. Buscar primero en la tabla indexada de códigos de barra
    let found_by_cb = conn.query_row(
        "SELECT p.idproducto, p.troquel, p.descripcion, p.stock, p.precio, p.costo, p.rubro, p.laboratorio, cb.codbarra
         FROM codigos_barra cb
         JOIN productos p ON p.idproducto = cb.idproducto
         WHERE cb.codbarra = ?1
         LIMIT 1",
        params![clean_code],
        |row| {
            Ok(LocalProductRecord {
                id_producto: row.get(0)?,
                troquel: row.get(1)?,
                name: row.get(2)?,
                stock: row.get(3)?,
                sale_price: row.get(4)?,
                cost: row.get(5)?,
                category: row.get(6)?,
                laboratory: row.get(7)?,
                barcode: row.get(8)?,
            })
        },
    );

    if let Ok(record) = found_by_cb {
        return Ok(Some(record));
    }

    // 2. Si no coincide con código de barras, buscar por IDProducto o Troquel
    let found_by_id_or_troq = conn.query_row(
        "SELECT p.idproducto, p.troquel, p.descripcion, p.stock, p.precio, p.costo, p.rubro, p.laboratorio, ?1 as codbarra
         FROM productos p
         WHERE p.idproducto = ?1 OR p.troquel = ?1
         LIMIT 1",
        params![clean_code],
        |row| {
            Ok(LocalProductRecord {
                id_producto: row.get(0)?,
                troquel: row.get(1)?,
                name: row.get(2)?,
                stock: row.get(3)?,
                sale_price: row.get(4)?,
                cost: row.get(5)?,
                category: row.get(6)?,
                laboratory: row.get(7)?,
                barcode: row.get(8)?,
            })
        },
    );

    match found_by_id_or_troq {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Error en consulta de código {}: {}", clean_code, e)),
    }
}

/// Registra un escaneo en la base SQLite local (Persistencia a 0 ms para la PC de salón o admin)
#[tauri::command]
pub async fn record_local_scan(
    app: tauri::AppHandle,
    session_id: String,
    ean: String,
    qty: i64,
    location_tag: Option<String>,
) -> Result<LocalScanResult, String> {
    let clean_ean = ean.trim();
    let tag = location_tag.unwrap_or_else(|| "Góndola Principal".into());
    let now = chrono_now_string();

    // Obtener datos del producto si existe
    let maybe_prod = search_local_barcode(app.clone(), clean_ean.to_string()).await?;
    let (id_prod, prod_name) = match maybe_prod {
        Some(p) => (Some(p.id_producto), p.name),
        None => (None, format!("Producto desconocido ({})", clean_ean)),
    };

    let conn = open_sqlite_conn(&app)?;

    // Insertar en scanned_items
    conn.execute(
        "INSERT INTO scanned_items 
         (session_id, ean, id_producto, product_name, quantity, location_tag, scanned_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![session_id, clean_ean, id_prod, prod_name, qty, tag, now],
    )
    .map_err(|e| format!("Error guardando escaneo local: {}", e))?;

    // Contadores para telemetría
    let location_total_units: i64 = conn
        .query_row(
            "SELECT IFNULL(SUM(quantity), 0) FROM scanned_items WHERE session_id = ?1 AND location_tag = ?2",
            params![session_id, tag],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let session_total_units: i64 = conn
        .query_row(
            "SELECT IFNULL(SUM(quantity), 0) FROM scanned_items WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let session_total_skus: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT ean) FROM scanned_items WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(LocalScanResult {
        success: true,
        ean: clean_ean.to_string(),
        product_name: prod_name,
        quantity: qty,
        location_tag: tag,
        location_total_units,
        session_total_units,
        session_total_skus,
    })
}

/// Devuelve el resumen acumulado de una sesión local para alimentar la telemetría en vivo
#[tauri::command]
pub async fn get_local_session_summary(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<LocalSessionSummary, String> {
    let conn = open_sqlite_conn(&app)?;

    let total_units: i64 = conn
        .query_row(
            "SELECT IFNULL(SUM(quantity), 0) FROM scanned_items WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_skus: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT ean) FROM scanned_items WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let last_scan_at: Option<String> = conn
        .query_row(
            "SELECT scanned_at FROM scanned_items WHERE session_id = ?1 ORDER BY id DESC LIMIT 1",
            params![session_id],
            |row| row.get(0),
        )
        .ok();

    let mut stmt = conn
        .prepare(
            "SELECT location_tag, SUM(quantity) 
             FROM scanned_items 
             WHERE session_id = ?1 
             GROUP BY location_tag 
             ORDER BY MAX(id) ASC",
        )
        .map_err(|e| format!("Error preparando resumen por ubicación: {}", e))?;

    let locations = stmt
        .query_map(params![session_id], |row| {
            Ok(LocalLocationStat {
                code: row.get(0)?,
                units_count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Error ejecutando resumen por ubicación: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(LocalSessionSummary {
        session_id,
        total_units,
        total_skus,
        locations,
        last_scan_at,
    })
}

/// Exporta todos los EANs escaneados en la sesión a un archivo plano (.txt / .csv) en %APPDATA%/exports
#[tauri::command]
pub async fn export_local_session_to_file(
    app: tauri::AppHandle,
    session_id: String,
    filename: Option<String>,
) -> Result<String, String> {
    let exports_dir = get_exports_dir(&app)?;
    let conn = open_sqlite_conn(&app)?;

    let fname = filename.unwrap_or_else(|| {
        let timestamp = chrono_now_compact();
        format!("CONTEO_{}_{}.txt", sanitize_filename(&session_id), timestamp)
    });

    let target_path = exports_dir.join(&fname);

    // Consulta de los productos agrupados por EAN y Ubicación
    let mut stmt = conn
        .prepare(
            "SELECT ean, SUM(quantity) as total_qty, location_tag, product_name, id_producto
             FROM scanned_items 
             WHERE session_id = ?1 
             GROUP BY ean, location_tag 
             ORDER BY location_tag ASC, ean ASC",
        )
        .map_err(|e| format!("Error consultando datos para exportación: {}", e))?;

    let mut lines = Vec::new();
    // Cabecera formato Plex / Colector estándar: EAN,CANTIDAD,UBICACION,IDPRODUCTO,DESCRIPCION
    lines.push("EAN,CANTIDAD,UBICACION,ID_PRODUCTO,DESCRIPCION".to_string());

    let mut rows = stmt
        .query(params![session_id])
        .map_err(|e| format!("Error extrayendo filas para exportación: {}", e))?;

    while let Some(row) = rows.next().map_err(|e| format!("Error leyendo fila: {}", e))? {
        let ean: String = row.get(0).unwrap_or_default();
        let qty: i64 = row.get(1).unwrap_or(0);
        let loc: String = row.get(2).unwrap_or_default();
        let desc: String = row.get(3).unwrap_or_default();
        let id_prod: String = row.get::<_, Option<String>>(4).unwrap_or_default().unwrap_or_default();

        let clean_desc = desc.replace(',', " ");
        lines.push(format!("{},{},{},{},{}", ean, qty, loc, id_prod, clean_desc));
    }

    let content = lines.join("\r\n");
    std::fs::write(&target_path, content.as_bytes())
        .map_err(|e| format!("Error escribiendo archivo exportado en {:?}: {}", target_path, e))?;

    Ok(target_path.to_string_lossy().to_string())
}

// Helpers para fecha/hora sin depender de crates externas complejas
fn chrono_now_string() -> String {
    let now = std::time::SystemTime::now();
    let dt: chrono_lite::DateTime = now.into();
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second
    )
}

fn chrono_now_compact() -> String {
    let now = std::time::SystemTime::now();
    let dt: chrono_lite::DateTime = now.into();
    format!(
        "{:04}{:02}{:02}_{:02}{:02}{:02}",
        dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second
    )
}

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

mod chrono_lite {
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    pub struct DateTime {
        pub year: i32,
        pub month: u32,
        pub day: u32,
        pub hour: u32,
        pub minute: u32,
        pub second: u32,
    }

    impl From<SystemTime> for DateTime {
        fn from(st: SystemTime) -> Self {
            let secs = st.duration_since(UNIX_EPOCH).unwrap_or(Duration::ZERO).as_secs();
            let second = (secs % 60) as u32;
            let mins = secs / 60;
            let minute = (mins % 60) as u32;
            let hours = mins / 60;
            let hour = (hours % 24) as u32;
            let mut days = (hours / 24) as i64;

            // Epoch 1970-01-01
            let mut year = 1970;
            loop {
                let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
                let days_in_year = if leap { 366 } else { 365 };
                if days < days_in_year {
                    break;
                }
                days -= days_in_year;
                year += 1;
            }

            let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
            let month_days = [
                31,
                if leap { 29 } else { 28 },
                31,
                30,
                31,
                30,
                31,
                31,
                30,
                31,
                30,
                31,
            ];

            let mut month = 1;
            for &md in &month_days {
                if days < md {
                    break;
                }
                days -= md;
                month += 1;
            }

            let day = (days + 1) as u32;

            DateTime {
                year,
                month,
                day,
                hour,
                minute,
                second,
            }
        }
    }
}

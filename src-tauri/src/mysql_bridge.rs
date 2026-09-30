use mysql::prelude::*;
use mysql::{OptsBuilder, Pool, Row};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MysqlConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub database: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MysqlTestResult {
    pub success: bool,
    pub message: String,
    pub server_version: Option<String>,
    pub current_database: Option<String>,
    pub tables_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MysqlColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: String,
    pub column_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MysqlProductRecord {
    pub id: String,
    pub name: String,
    pub ean: String,
    pub stock: f64,
    pub cost: f64,
    pub sale_price: f64,
    pub troquel: Option<String>,
    pub category: Option<String>,
    pub laboratory: Option<String>,
    pub secondary_eans: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MysqlStockResult {
    pub success: bool,
    pub message: String,
    pub total_products: usize,
    pub products: Vec<MysqlProductRecord>,
    pub logs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MysqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_rows: usize,
}

pub fn get_candidate_hosts(host: &str) -> Vec<String> {
    let h = host.trim();
    let mut candidates = vec![h.to_string()];
    
    // If 10.0.X.Y -> add 192.168.X.Y
    if h.starts_with("10.0.") {
        let parts: Vec<&str> = h.split('.').collect();
        if parts.len() == 4 {
            let alt = format!("192.168.{}.{}", parts[2], parts[3]);
            if !candidates.contains(&alt) {
                candidates.push(alt);
            }
        }
    }
    // If 192.168.X.Y -> add 10.0.X.Y
    else if h.starts_with("192.168.") {
        let parts: Vec<&str> = h.split('.').collect();
        if parts.len() == 4 {
            let alt = format!("10.0.{}.{}", parts[2], parts[3]);
            if !candidates.contains(&alt) {
                candidates.push(alt);
            }
        }
    } else if h == "localhost" {
        candidates.push("127.0.0.1".to_string());
    } else if h == "127.0.0.1" {
        candidates.push("localhost".to_string());
    }
    
    candidates
}

fn build_opts_for_host(config: &MysqlConfig, host: &str, timeout_ms: u64) -> OptsBuilder {
    let mut builder = OptsBuilder::new();
    builder = builder
        .ip_or_hostname(Some(host))
        .tcp_port(config.port)
        .user(Some(&config.user))
        .db_name(if config.database.trim().is_empty() {
            None
        } else {
            Some(&config.database)
        })
        .tcp_connect_timeout(Some(Duration::from_millis(timeout_ms)))
        .read_timeout(Some(Duration::from_secs(45)))
        .write_timeout(Some(Duration::from_secs(15)));

    if let Some(ref pass) = config.password {
        if !pass.is_empty() {
            builder = builder.pass(Some(pass));
        }
    }

    builder
}

pub fn connect_with_fallback(
    config: &MysqlConfig,
    timeout_ms: u64,
    mut logs: Option<&mut Vec<String>>,
) -> Result<(mysql::PooledConn, String), String> {
    let candidates = get_candidate_hosts(&config.host);
    let mut last_err = String::new();

    for (idx, candidate) in candidates.iter().enumerate() {
        if idx > 0 {
            if let Some(ref mut l) = logs {
                l.push(format!("⚠️ Fallback automático: Intentando IP alternativa '{}'...", candidate));
            }
        }

        let opts = build_opts_for_host(config, candidate, timeout_ms);
        match Pool::new(opts) {
            Ok(pool) => match pool.get_conn() {
                Ok(conn) => {
                    if idx > 0 {
                        if let Some(ref mut l) = logs {
                            l.push(format!("✓ Conexión exitosa mediante fallback a '{}'", candidate));
                        }
                    }
                    return Ok((conn, candidate.clone()));
                }
                Err(e) => {
                    last_err = format!("Error al conectar a {}:{}: {}", candidate, config.port, e);
                }
            },
            Err(e) => {
                last_err = format!("Error de configuración para {}: {}", candidate, e);
            }
        }
    }

    Err(last_err)
}

/// Test connection to MySQL server and query basic metadata with Auto-Fallback
#[tauri::command]
pub async fn test_mysql_connection(config: MysqlConfig) -> Result<MysqlTestResult, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, connected_host) = connect_with_fallback(&config, 5000, None)?;

        let version: Option<String> = conn
            .query_first("SELECT VERSION()")
            .map_err(|e| format!("Error consultando versión: {}", e))?
            .and_then(|r: Row| r.get_opt::<String, _>(0).and_then(|x| x.ok()));

        let current_db: Option<String> = conn
            .query_first("SELECT DATABASE()")
            .map_err(|e| format!("Error consultando base de datos: {}", e))?
            .and_then(|r: Row| r.get_opt::<String, _>(0).and_then(|x| x.ok()));

        let tables: Vec<String> = conn
            .query("SHOW TABLES")
            .unwrap_or_default();

        let fallback_note = if connected_host != config.host {
            format!(" (conectado vía fallback a {})", connected_host)
        } else {
            String::new()
        };

        Ok(MysqlTestResult {
            success: true,
            message: format!(
                "Conexión exitosa a MySQL en {}:{}{} (DB: '{}')",
                connected_host,
                config.port,
                fallback_note,
                current_db.clone().unwrap_or_else(|| "Ninguna".into())
            ),
            server_version: version,
            current_database: current_db,
            tables_count: tables.len(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// List all tables in the connected database with Auto-Fallback
#[tauri::command]
pub async fn list_mysql_tables(config: MysqlConfig) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 2000, None)?;

        let tables: Vec<String> = conn
            .query("SHOW TABLES")
            .map_err(|e| format!("Error al listar tablas: {}", e))?;

        Ok(tables)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Describe columns of a specific table
#[tauri::command]
pub async fn describe_mysql_table(config: MysqlConfig, table_name: String) -> Result<Vec<MysqlColumnInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 2000, None)?;

        // Sanitize table name to prevent basic injection
        let clean_table = table_name.replace(['`', ';', ' '], "");
        let query = format!("DESCRIBE `{}`", clean_table);

        let rows: Vec<Row> = conn
            .query(&query)
            .map_err(|e| format!("Error al describir tabla {}: {}", clean_table, e))?;

        let columns: Vec<MysqlColumnInfo> = rows
            .into_iter()
            .map(|r| MysqlColumnInfo {
                name: r.get_opt::<String, _>(0).and_then(|x| x.ok()).unwrap_or_default(),
                data_type: r.get_opt::<String, _>(1).and_then(|x| x.ok()).unwrap_or_default(),
                is_nullable: r.get_opt::<String, _>(2).and_then(|x| x.ok()).unwrap_or_default(),
                column_key: r.get_opt::<String, _>(3).and_then(|x| x.ok()).unwrap_or_default(),
            })
            .collect();

        Ok(columns)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Execute a read-only SELECT query for testing or inspection
#[tauri::command]
pub async fn execute_mysql_raw_query(
    config: MysqlConfig,
    query: String,
    limit: Option<usize>,
) -> Result<MysqlQueryResult, String> {
    tokio::task::spawn_blocking(move || {
        let trimmed = query.trim();
        let upper = trimmed.to_uppercase();
        if !upper.starts_with("SELECT") && !upper.starts_with("SHOW") && !upper.starts_with("DESCRIBE") && !upper.starts_with("EXPLAIN") {
            return Err("Por seguridad, solo se permiten consultas de lectura (SELECT, SHOW, DESCRIBE).".into());
        }

        let (mut conn, _) = connect_with_fallback(&config, 1500, None)?;

        let final_query = if let Some(lim) = limit {
            if !upper.contains("LIMIT") {
                format!("{} LIMIT {}", trimmed, lim)
            } else {
                trimmed.to_string()
            }
        } else {
            trimmed.to_string()
        };

        let result = conn.query_iter(&final_query).map_err(|e| format!("Error ejecutando consulta: {}", e))?;

        let columns: Vec<String> = result
            .columns()
            .as_ref()
            .iter()
            .map(|c| c.name_str().to_string())
            .collect();

        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();

        for row_res in result {
            let row = row_res.map_err(|e| format!("Error leyendo fila: {}", e))?;
            let mut row_vals = Vec::with_capacity(columns.len());

            for i in 0..columns.len() {
                let val: serde_json::Value = match row.get_opt::<mysql::Value, _>(i) {
                    Some(Ok(mysql::Value::NULL)) => serde_json::Value::Null,
                    Some(Ok(mysql::Value::Bytes(b))) => {
                        let s = String::from_utf8_lossy(&b).to_string();
                        serde_json::Value::String(s)
                    }
                    Some(Ok(mysql::Value::Int(n))) => serde_json::json!(n),
                    Some(Ok(mysql::Value::UInt(n))) => serde_json::json!(n),
                    Some(Ok(mysql::Value::Float(f))) => serde_json::json!(f),
                    Some(Ok(mysql::Value::Double(d))) => serde_json::json!(d),
                    Some(Ok(mysql::Value::Date(y, m, d, hh, mm, ss, _))) => {
                        serde_json::json!(format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", y, m, d, hh, mm, ss))
                    }
                    Some(Ok(mysql::Value::Time(neg, d, h, m, s, _))) => {
                        serde_json::json!(format!("{}{:02}:{:02}:{:02}", if neg { "-" } else { "" }, d * 24 + h as u32, m, s))
                    }
                    _ => serde_json::Value::Null,
                };
                row_vals.push(val);
            }
            rows.push(row_vals);
        }

        let total_rows = rows.len();
        Ok(MysqlQueryResult {
            columns,
            rows,
            total_rows,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Fetch stock and products using an adaptive query or custom SQL
#[tauri::command]
pub async fn fetch_mysql_stock(
    config: MysqlConfig,
    custom_query: Option<String>,
) -> Result<MysqlStockResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut logs = Vec::new();
        logs.push(format!("Conectando a MySQL en {}:{}/{}...", config.host, config.port, config.database));

        let (mut conn, connected_host) = connect_with_fallback(&config, 2500, Some(&mut logs))?;
        if connected_host != config.host {
            logs.push(format!("Conectado a host alternativo: {}", connected_host));
        }

        let sql = if let Some(q) = custom_query {
            if !q.trim().is_empty() {
                logs.push("Ejecutando consulta SQL personalizada...".into());
                q
            } else {
                build_default_stock_query(&mut conn, &mut logs)?
            }
        } else {
            build_default_stock_query(&mut conn, &mut logs)?
        };

        logs.push(format!("SQL: {}", sql));

        let query_result = conn.query_iter(&sql).map_err(|e| format!("Error en consulta de stock: {}", e))?;

        let col_names: Vec<String> = query_result
            .columns()
            .as_ref()
            .iter()
            .map(|c| c.name_str().to_lowercase())
            .collect();

        // Helper closures to find column index by name candidates (Exact matches first, then partial)
        let find_idx = |candidates: &[&str]| -> Option<usize> {
            // 1. Exact match pass
            for cand in candidates {
                if let Some(pos) = col_names.iter().position(|c| c == cand) {
                    return Some(pos);
                }
            }
            // 2. Substring match pass (excluding id_ columns from matching product name)
            for cand in candidates {
                if let Some(pos) = col_names.iter().position(|c| {
                    if *cand == "producto" && (c == "id_producto" || c == "idproducto" || c.starts_with("id")) {
                        false
                    } else {
                        c.contains(cand)
                    }
                }) {
                    return Some(pos);
                }
            }
            None
        };

        let id_idx = find_idx(&["id_producto", "idproducto", "codproducto", "codigo", "cod_art", "id"]);
        let name_idx = find_idx(&["producto", "nombre", "descripcion", "nomproducto", "descrip", "name"]);
        let ean_idx = find_idx(&["ean", "codebar", "codbarra", "codbarras", "codigobarra", "barcode", "cbarra"]);
        let troquel_idx = find_idx(&["troquel", "troq", "nrotfield"]);
        let stock_idx = find_idx(&["stock", "cantidad", "stockactual", "cant", "qty"]);
        let cost_idx = find_idx(&["costo", "cost", "preciocosto", "cost_price"]);
        let price_idx = find_idx(&["precio", "precioventa", "sale_price", "pvp", "price"]);
        let category_idx = find_idx(&["rubro", "category", "categoria", "s_rubro", "subrubro", "familia"]);
        let lab_idx = find_idx(&["laboratorio", "lab", "fabricante", "nomlab"]);

        logs.push(format!("Columnas detectadas en resultado: {:?}", col_names));

        let mut parsed_products: Vec<MysqlProductRecord> = Vec::new();

        for row_res in query_result {
            let row = row_res.map_err(|e| format!("Error leyendo fila de stock: {}", e))?;

            let get_string = |idx_opt: Option<usize>, fallback: &str| -> String {
                idx_opt
                    .and_then(|idx| {
                        row.get_opt::<String, _>(idx)
                            .and_then(|r| r.ok())
                            .or_else(|| row.get_opt::<i64, _>(idx).and_then(|r| r.ok()).map(|n| n.to_string()))
                    })
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| fallback.to_string())
            };

            let get_f64 = |idx_opt: Option<usize>| -> f64 {
                idx_opt
                    .and_then(|idx| {
                        row.get_opt::<f64, _>(idx)
                            .and_then(|r| r.ok())
                            .or_else(|| row.get_opt::<i64, _>(idx).and_then(|r| r.ok()).map(|n| n as f64))
                            .or_else(|| {
                                row.get_opt::<String, _>(idx)
                                     .and_then(|r| r.ok())
                                     .and_then(|s| s.trim().replace(',', ".").parse::<f64>().ok())
                            })
                    })
                    .unwrap_or(0.0)
            };

            let id = get_string(id_idx, "");
            let name = get_string(name_idx, "Sin Nombre");
            let mut ean = get_string(ean_idx, "");
            let troquel = troquel_idx.map(|idx| get_string(Some(idx), "")).filter(|t| !t.is_empty() && t != "0");
            let stock = get_f64(stock_idx);
            let cost = get_f64(cost_idx);
            let sale_price = get_f64(price_idx);
            let category = category_idx.map(|idx| get_string(Some(idx), "")).filter(|c| !c.is_empty());
            let laboratory = lab_idx.map(|idx| get_string(Some(idx), "")).filter(|l| !l.is_empty());

            if id.is_empty() && ean.is_empty() {
                continue;
            }

            if ean.is_empty() {
                ean = id.clone();
            }

            parsed_products.push(MysqlProductRecord {
                id: if id.is_empty() { ean.clone() } else { id },
                name,
                ean,
                stock,
                cost,
                sale_price,
                troquel,
                category,
                laboratory,
                secondary_eans: Vec::new(),
            });
        }

        let total = parsed_products.len();
        logs.push(format!("Catálogo MySQL procesado con éxito: {} productos importados.", total));

        Ok(MysqlStockResult {
            success: true,
            message: format!("Se importaron {} productos exitosamente desde MySQL.", total),
            total_products: total,
            products: parsed_products,
            logs,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Detects probable table structure if no custom query was provided
fn build_default_stock_query(conn: &mut mysql::PooledConn, logs: &mut Vec<String>) -> Result<String, String> {
    let tables: Vec<String> = conn
        .query("SHOW TABLES")
        .map_err(|e| format!("Error buscando tablas: {}", e))?;

    let lower_tables: Vec<String> = tables
        .iter()
        .map(|t| t.to_lowercase())
        .collect();

    // 1. Check if Plex schema exists (productos + stock)
    let has_productos = lower_tables.iter().any(|t| t == "productos");
    let has_stock = lower_tables.iter().any(|t| t == "stock");

    if has_productos && has_stock {
        let has_codebars = lower_tables.iter().any(|t| t == "productoscodebars");
        let has_labs = lower_tables.iter().any(|t| t == "laboratorios");
        let has_rubros = lower_tables.iter().any(|t| t == "rubros");

        logs.push("Esquema estándar Plex detectado (productos + stock). Generando JOIN optimizado...".into());

        let codebars_join = if has_codebars {
            "LEFT JOIN productoscodebars PC ON PC.IDProducto = P.IDProducto"
        } else {
            ""
        };
        let codebars_select = if has_codebars {
            "GROUP_CONCAT(DISTINCT PC.codebar SEPARATOR ', ') AS CodigosBarraAlternativos,"
        } else {
            "'' AS CodigosBarraAlternativos,"
        };

        let labs_join = if has_labs {
            "LEFT JOIN laboratorios L ON L.IDLaboratorio = P.IDLaboratorio"
        } else {
            ""
        };
        let labs_select = if has_labs {
            "L.Nombre AS Laboratorio,"
        } else {
            "'' AS Laboratorio,"
        };

        let rubros_join = if has_rubros {
            "LEFT JOIN rubros R ON R.IDRubro = P.IDRubro"
        } else {
            ""
        };
        let rubros_select = if has_rubros {
            "R.Nombre AS Rubro,"
        } else {
            "'' AS Rubro,"
        };

        let plex_query = format!(
            "SELECT \
                P.IDProducto AS id_producto, \
                P.Codebar AS ean, \
                CONCAT(P.Producto, ' ', IFNULL(P.Presentacion, '')) AS producto, \
                S.Cantidad AS stock, \
                P.Costo AS costo, \
                P.UltimoPrecio AS precio, \
                {} \
                {} \
                {} \
                P.Activo AS activo \
            FROM productos P \
            INNER JOIN stock S ON S.IDProducto = P.IDProducto \
            {} \
            {} \
            {} \
            GROUP BY P.IDProducto \
            ORDER BY P.IDProducto ASC",
            codebars_select, labs_select, rubros_select, codebars_join, labs_join, rubros_join
        );

        return Ok(plex_query);
    }

    // 2. Generic fallback candidate
    let candidate = tables
        .iter()
        .find(|t| {
            let lower = t.to_lowercase();
            lower.contains("producto") || lower.contains("articulo") || lower.contains("stock")
        })
        .cloned();

    if let Some(target_table) = candidate {
        logs.push(format!("Tabla detectada automáticamente: '{}'", target_table));
        Ok(format!("SELECT * FROM `{}` LIMIT 10000", target_table))
    } else if let Some(first) = tables.first() {
        logs.push(format!("Usando primera tabla disponible: '{}'", first));
        Ok(format!("SELECT * FROM `{}` LIMIT 10000", first))
    } else {
        Err("No se encontraron tablas en la base de datos MySQL seleccionada.".into())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePlexInventoryResult {
    pub success: bool,
    pub message: String,
    pub id_inventario: Option<i64>,
}

/// Creates a new inventory session in Plex (table `inventarios`)
#[tauri::command]
pub async fn create_plex_inventory_session(
    config: MysqlConfig,
    description: String,
    user_id: Option<i64>,
    terminal_id: Option<i64>,
) -> Result<CreatePlexInventoryResult, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, active_host) = connect_with_fallback(&config, 3000, None)?;

        let uid = user_id.unwrap_or(1590); // Gonzalo Coz por defecto
        let tid = terminal_id.unwrap_or(168);
        let clean_desc = description.trim().replace('\'', "''");

        let query = format!(
            "INSERT INTO inventarios (Fecha, Hora, Descripcion, IDEstado, IDTerminal, IDUsuario, FechaEstado, TipoAjuste) \
             VALUES (CURDATE(), CURTIME(), '{}', 1, {}, {}, NOW(), NULL)",
            clean_desc,
            tid,
            uid
        );

        conn.query_drop(&query)
            .map_err(|e| format!("Error al insertar inventario en Plex: {}", e))?;

        let last_id = conn.last_insert_id();

        Ok(CreatePlexInventoryResult {
            success: true,
            message: format!("Sesión de inventario #{} creada exitosamente en Plex ({})", last_id, active_host),
            id_inventario: Some(last_id as i64),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlexOpenSession {
    pub id_inventario: i64,
    pub fecha: String,
    pub hora: String,
    pub descripcion: String,
    pub id_estado: i32,
    pub id_terminal: Option<i64>,
    pub id_usuario: Option<i64>,
    pub usuario: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetPlexOpenSessionsResult {
    pub success: bool,
    pub message: String,
    pub sessions: Vec<PlexOpenSession>,
}

/// Retrieves open inventory sessions from Plex (table `inventarios` where IDEstado = 1)
#[tauri::command]
pub async fn get_plex_open_inventory_sessions(
    config: MysqlConfig,
) -> Result<GetPlexOpenSessionsResult, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, active_host) = connect_with_fallback(&config, 3000, None)?;

        let query = "SELECT \
            i.IDInventario, \
            COALESCE(CAST(i.Fecha AS CHAR), '') as Fecha, \
            COALESCE(CAST(i.Hora AS CHAR), '') as Hora, \
            COALESCE(i.Descripcion, '') as Descripcion, \
            i.IDEstado, \
            i.IDTerminal, \
            i.IDUsuario, \
            COALESCE(u.NombreCompleto, '') as usuario \
        FROM inventarios i \
        LEFT JOIN usuarios u ON i.IDUsuario = u.IdUsuario \
        WHERE i.IDEstado = 1 \
        ORDER BY i.IDInventario DESC \
        LIMIT 15";

        let rows = conn.query_map(
            query,
            |(id, fecha, hora, descripcion, estado, term, user_id, usuario): (
                i64,
                Option<String>,
                Option<String>,
                Option<String>,
                i32,
                Option<i64>,
                Option<i64>,
                Option<String>,
            )| {
                PlexOpenSession {
                    id_inventario: id,
                    fecha: fecha.unwrap_or_default(),
                    hora: hora.unwrap_or_default(),
                    descripcion: descripcion.unwrap_or_default(),
                    id_estado: estado,
                    id_terminal: term,
                    id_usuario: user_id,
                    usuario: usuario.unwrap_or_default(),
                }
            },
        ).map_err(|e| format!("Error consultando sesiones abiertas en Plex: {}", e))?;

        Ok(GetPlexOpenSessionsResult {
            success: true,
            message: format!("Se encontraron {} sesiones abiertas en Plex ({})", rows.len(), active_host),
            sessions: rows,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlexBatchItemInput {
    pub id_producto: Option<i64>,
    pub codebar: String,
    pub cantidad: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendPlexApiBatchResult {
    pub success: bool,
    pub message: String,
    pub id_registro: Option<i64>,
    pub total_items: usize,
    pub total_units: i64,
    pub host: String,
}

/// Sends counted inventory items to Plex API load tables (`inventario_ws` and `inventario_ws_det`)
#[tauri::command]
pub async fn send_plex_inventory_api_batch(
    config: MysqlConfig,
    user_id: Option<i64>,
    tipo_inventario: Option<i32>,
    items: Vec<PlexBatchItemInput>,
) -> Result<SendPlexApiBatchResult, String> {
    tokio::task::spawn_blocking(move || {
        if items.is_empty() {
            return Err("No se proporcionaron productos para enviar a Plex.".into());
        }

        let (mut conn, active_host) = connect_with_fallback(&config, 3000, None)?;

        // Agrupar items por código de barra (Codebar)
        use std::collections::HashMap;
        let mut grouped: HashMap<String, (Option<i64>, i64)> = HashMap::new();
        let mut total_units: i64 = 0;

        for it in &items {
            let ean = it.codebar.trim().to_string();
            if ean.is_empty() {
                continue;
            }
            let qty = if it.cantidad > 0 { it.cantidad } else { 1 };
            total_units += qty;

            let entry = grouped.entry(ean).or_insert((it.id_producto, 0));
            entry.1 += qty;
            if entry.0.is_none() && it.id_producto.is_some() {
                entry.0 = it.id_producto;
            }
        }

        if grouped.is_empty() {
            return Err("La lista de productos no contiene códigos de barra válidos.".into());
        }

        // Resolver IdProducto faltantes buscando en productoscodebars y productos
        use mysql::prelude::Queryable;
        let mut resolved_products: HashMap<String, i64> = HashMap::new();
        let missing_eans: Vec<String> = grouped
            .iter()
            .filter(|(_, (id_opt, _))| id_opt.is_none() || id_opt.unwrap_or(0) <= 0)
            .map(|(ean, _)| format!("'{}'", ean.replace('\'', "''")))
            .collect();

        if !missing_eans.is_empty() {
            for chunk in missing_eans.chunks(100) {
                let ean_list = chunk.join(", ");
                let q_cb = format!(
                    "SELECT codebar, IDProducto FROM productoscodebars WHERE codebar IN ({})",
                    ean_list
                );
                if let Ok(rows) = conn.query_map(&q_cb, |(cb, id): (String, i64)| (cb, id)) {
                    for (cb, id) in rows {
                        resolved_products.insert(cb, id);
                    }
                }

                let q_prod = format!(
                    "SELECT Codebar, IdProducto FROM productos WHERE Codebar IN ({})",
                    ean_list
                );
                if let Ok(rows) = conn.query_map(&q_prod, |(cb, id): (String, i64)| (cb, id)) {
                    for (cb, id) in rows {
                        if !resolved_products.contains_key(&cb) {
                            resolved_products.insert(cb, id);
                        }
                    }
                }
            }
        }

        // 1. Insertar cabecera en inventario_ws con Estado = 'PENDIENTE' (requerido por la grilla de Plex)
        let uid = user_id.unwrap_or(1590);
        let tipo_inv_clause = match tipo_inventario {
            Some(t) => t.to_string(),
            _ => "NULL".to_string(),
        };

        let insert_header_query = format!(
            "INSERT INTO inventario_ws (Fecha, Estado, FechaEstado, IdUsuario, IdTipoInventario, idrubro, solo_en_stock) \
             VALUES (NOW(), 'PENDIENTE', NOW(), {}, {}, NULL, 0)",
            uid, tipo_inv_clause
        );

        conn.query_drop(&insert_header_query)
            .map_err(|e| format!("Error al crear lote en inventario_ws: {}", e))?;

        let id_registro = conn.last_insert_id() as i64;

        // 2. Insertar detalle en inventario_ws_det por lotes de 200 items
        let mut orden = 1;
        let mut value_clauses: Vec<String> = Vec::new();

        for (ean, (id_prod_opt, qty)) in &grouped {
            let final_id_prod = match id_prod_opt {
                Some(id) if *id > 0 => *id,
                _ => *resolved_products.get(ean).unwrap_or(&-1),
            };
            let clean_ean = ean.replace('\'', "''");

            value_clauses.push(format!(
                "({}, {}, {}, '{}', {})",
                id_registro, orden, final_id_prod, clean_ean, qty
            ));
            orden += 1;

            if value_clauses.len() >= 200 {
                let bulk_query = format!(
                    "INSERT INTO inventario_ws_det (IDRegistro, Orden, IdProducto, Codebar, Cantidad) VALUES {}",
                    value_clauses.join(", ")
                );
                conn.query_drop(&bulk_query)
                    .map_err(|e| format!("Error al insertar detalle de productos en inventario_ws_det: {}", e))?;
                value_clauses.clear();
            }
        }

        if !value_clauses.is_empty() {
            let bulk_query = format!(
                "INSERT INTO inventario_ws_det (IDRegistro, Orden, IdProducto, Codebar, Cantidad) VALUES {}",
                value_clauses.join(", ")
            );
            conn.query_drop(&bulk_query)
                .map_err(|e| format!("Error al insertar detalle final en inventario_ws_det: {}", e))?;
        }

        let total_items = grouped.len();

        Ok(SendPlexApiBatchResult {
            success: true,
            message: format!(
                "Lote #{} registrado exitosamente en Plex ({}). Listo para cargar desde API.",
                id_registro, active_host
            ),
            id_registro: Some(id_registro),
            total_items,
            total_units,
            host: active_host,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}



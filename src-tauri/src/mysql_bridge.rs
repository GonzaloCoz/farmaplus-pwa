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
    #[serde(default)]
    pub include_catalog_eans: Option<bool>,
    #[serde(default)]
    pub include_hidden_inactive: Option<bool>,
    #[serde(default)]
    pub fallback_hosts: Option<Vec<String>>,
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
    pub subrubro: Option<String>,
    pub laboratory: Option<String>,
    pub secondary_eans: Vec<String>,
    pub is_hidden: bool,
    #[serde(default)]
    pub is_traceable: bool,
    #[serde(default)]
    pub gtin: Option<String>,
    #[serde(default)]
    pub id_producto_padre: Option<String>,
    #[serde(default)]
    pub unidades_padre: Option<f64>,
    #[serde(default)]
    pub parent_ean: Option<String>,
    #[serde(default)]
    pub parent_name: Option<String>,
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
    
    // Solo permitir loopback/localhost como fallback local seguro.
    // Se elimina el fallback cruzado de subredes (10.0.X.Y <-> 192.168.X.Y)
    // para evitar saltos accidentales de sucursales en caso de timeout.
    if h == "localhost" {
        candidates.push("127.0.0.1".to_string());
    } else if h == "127.0.0.1" {
        candidates.push("localhost".to_string());
    }
    
    candidates
}

fn format_mysql_conn_error(err: &mysql::Error, _host: &str, _port: u16) -> String {
    match err {
        mysql::Error::MySqlError(my_err) => match my_err.code {
            1045 | 1044 => "Error de autenticación: Acceso denegado al servidor local de Plex. Verifique las credenciales.".to_string(),
            1049 => "Base de datos desconocida: La base de datos de Plex no existe en el servidor local.".to_string(),
            1130 => "Host no autorizado: El servidor local de Plex no permite conexiones remotas desde este equipo.".to_string(),
            _ => format!("Error en el servidor local de Plex (Código {}).", my_err.code),
        },
        mysql::Error::IoError(io_err) => match io_err.kind() {
            std::io::ErrorKind::TimedOut => {
                "Tiempo de espera agotado al conectar con el servidor local de Plex. Verifique la conexión a la red de la sucursal.".to_string()
            }
            std::io::ErrorKind::ConnectionRefused => {
                "Conexión rechazada: El servicio MySQL de Plex no responde en el servidor local.".to_string()
            }
            std::io::ErrorKind::ConnectionReset => {
                "Conexión reiniciada por el servidor local de Plex o la red interna.".to_string()
            }
            _ => "Error de red al conectar con el servidor local de Plex.".to_string(),
        },
        mysql::Error::DriverError(drv_err) => {
            let msg = format!("{:?}", drv_err);
            if msg.to_lowercase().contains("timeout") {
                "Tiempo de espera agotado al comunicar con el servidor local de Plex.".to_string()
            } else {
                "Error de comunicación del driver con el servidor local de Plex.".to_string()
            }
        }
        _ => "No se pudo establecer conexión con el servidor local de Plex.".to_string(),
    }
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

    if let Some(pass) = config.password.as_deref() {
        if !pass.trim().is_empty() {
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
    let mut candidates = get_candidate_hosts(&config.host);
    if let Some(ref fallbacks) = config.fallback_hosts {
        for fb in fallbacks {
            let trimmed = fb.trim().to_string();
            if !trimmed.is_empty() && !candidates.contains(&trimmed) {
                candidates.push(trimmed);
            }
        }
    }

    let effective_timeout_ms = timeout_ms.max(5000);
    let mut last_err = String::new();
    const MAX_RETRIES: usize = 2; // 1 intento inicial + hasta 2 reintentos rápidos (total 3 intentos)

    for (idx, candidate) in candidates.iter().enumerate() {
        if idx > 0 {
            if let Some(ref mut l) = logs {
                l.push(format!("⚠️ Fallback: Intentando host seguro alternativo '{}'...", candidate));
            }
        }

        let opts = build_opts_for_host(config, candidate, effective_timeout_ms);
        let pool = match Pool::new(opts) {
            Ok(p) => p,
            Err(e) => {
                let err_msg = format_mysql_conn_error(&e, candidate, config.port);
                eprintln!("[MySQL] Error al inicializar pool para {}:{}: {:?}", candidate, config.port, e);
                last_err = err_msg;
                continue;
            }
        };

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                // Breve pausa antes del reintento rápido (250ms, 500ms) para tolerar jitter de VPN
                std::thread::sleep(Duration::from_millis(250 * attempt as u64));
                if let Some(ref mut l) = logs {
                    l.push(format!(
                        "⚠️ Reintentando conexión con '{}' (intento {}/{})...",
                        candidate,
                        attempt + 1,
                        MAX_RETRIES + 1
                    ));
                }
            }

            match pool.get_conn() {
                Ok(conn) => {
                    if idx > 0 || attempt > 0 {
                        if let Some(ref mut l) = logs {
                            l.push(format!("✓ Conexión exitosa a '{}' (intento {})", candidate, attempt + 1));
                        }
                    }
                    return Ok((conn, candidate.clone()));
                }
                Err(e) => {
                    eprintln!("[MySQL] Intento {} a {} falló: {:?}", attempt + 1, candidate, e);
                    let is_fatal_auth_or_db = match &e {
                        mysql::Error::MySqlError(my_err) => {
                            my_err.code == 1045 || my_err.code == 1044 || my_err.code == 1049 || my_err.code == 1130
                        }
                        _ => false,
                    };
                    last_err = format_mysql_conn_error(&e, candidate, config.port);
                    if let Some(ref mut l) = logs {
                        l.push(format!("Fallo en '{}': {}", candidate, last_err));
                    }
                    if is_fatal_auth_or_db {
                        // Error de credenciales o base inexistente: no reintentar
                        break;
                    }
                }
            }
        }
    }

    Err(last_err)
}

/// Test connection to MySQL server and query basic metadata with Auto-Fallback
#[tauri::command]
pub async fn test_mysql_connection(config: MysqlConfig) -> Result<MysqlTestResult, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _connected_host) = connect_with_fallback(&config, 5000, None)?;

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

        Ok(MysqlTestResult {
            success: true,
            message: "Conexión exitosa al servidor de Plex.".to_string(),
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
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;

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
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;

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
        if (!upper.starts_with("SELECT") && !upper.starts_with("SHOW") && !upper.starts_with("DESCRIBE") && !upper.starts_with("EXPLAIN"))
            || trimmed.contains(';')
        {
            return Err("Por seguridad, solo se permiten consultas de lectura de una sola sentencia (SELECT, SHOW, DESCRIBE).".into());
        }

        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;

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
        logs.push(format!("Conectando a MySQL en {}:****/{}...", config.host, config.database));

        let (mut conn, connected_host) = connect_with_fallback(&config, 5000, Some(&mut logs))?;
        if connected_host != config.host {
            logs.push(format!("Conectado a host alternativo: {}", connected_host));
        }

        // Calibrar group_concat_max_len antes de la consulta maestra para que MySQL 5.1.44
        // no trunque la agregación de códigos de barra alternativos (GROUP_CONCAT) al límite por defecto de 1024 bytes.
        if let Err(e) = conn.query_drop("SET SESSION group_concat_max_len = 65535") {
            logs.push(format!("⚠️ Advertencia al fijar group_concat_max_len: {}", e));
        } else {
            logs.push("Configurado SET SESSION group_concat_max_len = 65535 para códigos de barra alternativos.".into());
        }

        let sql = if let Some(q) = custom_query {
            let trimmed = q.trim();
            if !trimmed.is_empty() {
                let upper = trimmed.to_uppercase();
                if !upper.starts_with("SELECT") || trimmed.contains(';') {
                    return Err("Por seguridad, custom_query solo permite sentencias SELECT individuales.".into());
                }
                logs.push("Ejecutando consulta SQL personalizada...".into());
                trimmed.to_string()
            } else {
                build_default_stock_query(
                    &mut conn,
                    &mut logs,
                    config.include_catalog_eans.unwrap_or(false),
                    config.include_hidden_inactive.unwrap_or(false),
                )?
            }
        } else {
            build_default_stock_query(
                &mut conn,
                &mut logs,
                config.include_catalog_eans.unwrap_or(false),
                config.include_hidden_inactive.unwrap_or(false),
            )?
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
        let category_idx = find_idx(&["rubro", "category", "categoria"]);
        let subrubro_idx = find_idx(&["subrubro", "s_rubro", "sub_rubro", "nomsubrubro", "subcategoria"]);
        let lab_idx = find_idx(&["laboratorio", "lab", "fabricante", "nomlab"]);
        let codebars_alt_idx = find_idx(&["codigosbarraalternativos", "codigos_barra_alternativos", "secondary_eans", "cbs_alt"]);
        let visible_idx = find_idx(&["visible", "oculto"]);
        let trazable_idx = find_idx(&["trazable", "is_traceable"]);
        let gtin_idx = find_idx(&["gtin", "codigogtin"]);
        let id_padre_idx = find_idx(&["id_producto_padre", "idproductopadre"]);
        let unidades_padre_idx = find_idx(&["unidades_padre", "unidadespadre"]);
        let parent_ean_idx = find_idx(&["parent_ean"]);
        let parent_name_idx = find_idx(&["parent_name"]);

        logs.push(format!("Columnas detectadas en resultado: {:?}", col_names));

        let mut parsed_products: Vec<MysqlProductRecord> = Vec::new();

        for row_res in query_result {
            let row = row_res.map_err(|e| format!("Error leyendo fila de stock: {}", e))?;

            let get_string = |idx_opt: Option<usize>, fallback: &str| -> String {
                idx_opt
                    .and_then(|idx| row.get_opt::<mysql::Value, _>(idx).and_then(|r| r.ok()))
                    .map(|v| match v {
                        mysql::Value::Bytes(b) => String::from_utf8_lossy(&b).trim().to_string(),
                        mysql::Value::Int(n) => n.to_string(),
                        mysql::Value::UInt(n) => n.to_string(),
                        mysql::Value::Float(f) => f.to_string(),
                        mysql::Value::Double(d) => d.to_string(),
                        _ => fallback.to_string(),
                    })
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| fallback.to_string())
            };

            let get_f64 = |idx_opt: Option<usize>| -> f64 {
                idx_opt
                    .and_then(|idx| row.get_opt::<mysql::Value, _>(idx).and_then(|r| r.ok()))
                    .map(|v| match v {
                        mysql::Value::Float(f) => f as f64,
                        mysql::Value::Double(d) => d,
                        mysql::Value::Int(n) => n as f64,
                        mysql::Value::UInt(n) => n as f64,
                        mysql::Value::Bytes(b) => {
                            String::from_utf8_lossy(&b)
                                .trim()
                                .replace(',', ".")
                                .parse::<f64>()
                                .unwrap_or(0.0)
                        }
                        _ => 0.0,
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
            let subrubro = subrubro_idx.map(|idx| get_string(Some(idx), "")).filter(|s| !s.is_empty());
            let laboratory = lab_idx.map(|idx| get_string(Some(idx), "")).filter(|l| !l.is_empty());
            let raw_alt_eans = codebars_alt_idx.map(|idx| get_string(Some(idx), "")).unwrap_or_default();

            let mut secondary_eans = Vec::new();
            if !raw_alt_eans.is_empty() {
                for part in raw_alt_eans.split(',') {
                    let clean = part.trim().to_string();
                    if !clean.is_empty() && clean != ean && !secondary_eans.contains(&clean) {
                        secondary_eans.push(clean);
                    }
                }
            }

            if id.is_empty() && ean.is_empty() {
                continue;
            }

            if ean.is_empty() {
                ean = id.clone();
            }

            let is_hidden = visible_idx
                .map(|idx| {
                    let v = get_string(Some(idx), "1");
                    v == "0" || v.eq_ignore_ascii_case("false")
                })
                .unwrap_or(false);

            let is_traceable = trazable_idx
                .map(|idx| {
                    let v = get_string(Some(idx), "0");
                    v == "1" || v.eq_ignore_ascii_case("true")
                })
                .unwrap_or(false);

            let gtin = gtin_idx
                .map(|idx| get_string(Some(idx), ""))
                .filter(|g| !g.is_empty() && g != "0");

            let id_producto_padre = id_padre_idx
                .map(|idx| get_string(Some(idx), ""))
                .filter(|v| !v.is_empty() && v != "0");

            let unidades_padre = unidades_padre_idx
                .map(|idx| get_f64(Some(idx)))
                .filter(|v| *v > 1.0);

            let parent_ean = parent_ean_idx
                .map(|idx| get_string(Some(idx), ""))
                .filter(|v| !v.is_empty());

            let parent_name = parent_name_idx
                .map(|idx| get_string(Some(idx), "").trim().to_string())
                .filter(|v| !v.is_empty());

            parsed_products.push(MysqlProductRecord {
                id: if id.is_empty() { ean.clone() } else { id },
                name,
                ean,
                stock,
                cost,
                sale_price,
                troquel,
                category,
                subrubro,
                laboratory,
                secondary_eans,
                is_hidden,
                is_traceable,
                gtin,
                id_producto_padre,
                unidades_padre,
                parent_ean,
                parent_name,
            });
        }

        let total = parsed_products.len();
        let with_stock_count = parsed_products.iter().filter(|p| p.stock > 0.0).count();
        logs.push(format!("Catálogo MySQL procesado con éxito: {} productos importados ({} con stock > 0).", total, with_stock_count));

        Ok(MysqlStockResult {
            success: true,
            message: format!("Se importaron {} productos exitosamente desde MySQL ({} con stock).", total, with_stock_count),
            total_products: total,
            products: parsed_products,
            logs,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Detects probable table structure if no custom query was provided
fn build_default_stock_query(
    conn: &mut mysql::PooledConn,
    logs: &mut Vec<String>,
    include_catalog_eans: bool,
    include_hidden_inactive: bool,
) -> Result<String, String> {
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
        let has_subrubros = lower_tables.iter().any(|t| t == "subrubros");
        let has_padre_cols: bool = conn
            .query_first::<mysql::Row, _>("SHOW COLUMNS FROM productos LIKE 'IdProductoPadre'")
            .map(|r| r.is_some())
            .unwrap_or(false);

        logs.push("Esquema estándar Plex detectado (productos + stock + rubros + subrubros). Generando JOIN optimizado...".into());

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

        let subrubros_join = if has_subrubros {
            "LEFT JOIN subrubros SR ON SR.IDSubRubro = P.IDSubRubro"
        } else {
            ""
        };
        let subrubros_select = if has_subrubros {
            "SR.Nombre AS SubRubro,"
        } else {
            "'' AS SubRubro,"
        };

        let padre_join = if has_padre_cols {
            "LEFT JOIN productos PP ON PP.IDProducto = P.IdProductoPadre"
        } else {
            ""
        };
        let padre_select = if has_padre_cols {
            "IFNULL(P.IdProductoPadre, 0) AS id_producto_padre, \
             IFNULL(P.UnidadesPadre, 0) AS unidades_padre, \
             IFNULL(PP.Codebar, '') AS parent_ean, \
             TRIM(CONCAT(IFNULL(PP.Producto, ''), ' ', IFNULL(PP.Presentacion, ''))) AS parent_name,"
        } else {
            "0 AS id_producto_padre, 0 AS unidades_padre, '' AS parent_ean, '' AS parent_name,"
        };

        if include_hidden_inactive {
            logs.push("Modo ocultos/inactivos activo: Incluyendo productos con Visible=0 o Activo='N'.".into());
        }

        let (stock_join, where_clause) = match (include_catalog_eans, include_hidden_inactive) {
            (true, true) => {
                logs.push("Modo complementario activo: Incluyendo productos (incluso ocultos/inactivos) con EAN sin stock en sucursal.".into());
                (
                    "LEFT JOIN stock S ON S.IDProducto = P.IDProducto",
                    "WHERE (P.servicio = 0 OR P.servicio IS NULL) \
                     AND (S.IDProducto IS NOT NULL OR (P.Codebar IS NOT NULL AND P.Codebar != ''))"
                )
            }
            (true, false) => {
                logs.push("Modo complementario activo: Incluyendo productos activos con EAN sin stock en sucursal.".into());
                (
                    "LEFT JOIN stock S ON S.IDProducto = P.IDProducto",
                    "WHERE (P.Activo = 'S' OR P.Activo = '1') \
                     AND (P.servicio = 0 OR P.servicio IS NULL) \
                     AND ((P.visible = 1 OR P.visible = '1') OR S.IDProducto IS NOT NULL OR (P.Codebar IS NOT NULL AND P.Codebar != ''))"
                )
            }
            (false, true) => (
                "JOIN stock S ON S.IDProducto = P.IDProducto",
                "WHERE (P.servicio = 0 OR P.servicio IS NULL)"
            ),
            (false, false) => (
                "JOIN stock S ON S.IDProducto = P.IDProducto",
                "WHERE (P.Activo = 'S' OR P.Activo = '1') \
                 AND (P.servicio = 0 OR P.servicio IS NULL) \
                 AND (P.visible = 1 OR P.visible = '1')"
            ),
        };

        let plex_query = format!(
            "SELECT \
                P.IDProducto AS id_producto, \
                P.Troquel AS troquel, \
                P.Codebar AS ean, \
                CONCAT(P.Producto, ' ', IFNULL(P.Presentacion, '')) AS producto, \
                IFNULL(S.Cantidad, 0) AS stock, \
                IFNULL(NULLIF(P.costoPPP, 0), P.Costo) AS costo, \
                P.UltimoPrecio AS precio, \
                P.visible AS visible, \
                IFNULL(P.trazable, 0) AS trazable, \
                IFNULL(P.gtin, '') AS gtin, \
                {} \
                {} \
                {} \
                {} \
                {} \
                P.Activo AS activo \
            FROM productos P \
            {} \
            {} \
            {} \
            {} \
            {} \
            {} \
            {} \
            GROUP BY P.IDProducto \
            ORDER BY P.IDProducto ASC",
            codebars_select, labs_select, rubros_select, subrubros_select, padre_select,
            stock_join, codebars_join, labs_join, rubros_join, subrubros_join, padre_join,
            where_clause
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
        let (mut conn, active_host) = connect_with_fallback(&config, 5000, None)?;

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
        let (mut conn, active_host) = connect_with_fallback(&config, 5000, None)?;

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
    pub bypassed_trazables: Vec<i64>,
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

        let (mut conn, active_host) = connect_with_fallback(&config, 5000, None)?;

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

        // 1. Detectar y desactivar temporalmente trazabilidad (trazable = 1) para permitir ingreso en Plex
        let mut bypassed_trazables: Vec<i64> = Vec::new();
        let mut unique_product_ids: Vec<i64> = Vec::new();

        for (ean, (id_prod_opt, _)) in &grouped {
            let final_id_prod = match id_prod_opt {
                Some(id) if *id > 0 => *id,
                _ => *resolved_products.get(ean).unwrap_or(&-1),
            };
            if final_id_prod > 0 && !unique_product_ids.contains(&final_id_prod) {
                unique_product_ids.push(final_id_prod);
            }
        }

        if !unique_product_ids.is_empty() {
            for chunk in unique_product_ids.chunks(100) {
                let id_list = chunk.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(", ");
                let q_check_traza = format!(
                    "SELECT IDProducto FROM productos WHERE IDProducto IN ({}) AND trazable = 1",
                    id_list
                );
                if let Ok(rows) = conn.query_map(&q_check_traza, |id: i64| id) {
                    for id in rows {
                        bypassed_trazables.push(id);
                    }
                }
            }

            if !bypassed_trazables.is_empty() {
                for chunk in bypassed_trazables.chunks(100) {
                    let id_list = chunk.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(", ");
                    let q_uncheck = format!(
                        "UPDATE productos SET trazable = 0 WHERE IDProducto IN ({})",
                        id_list
                    );
                    let _ = conn.query_drop(&q_uncheck);
                }
            }
        }

        // 2. Insertar cabecera en inventario_ws con Estado = 'PENDIENTE' (requerido por la grilla de Plex)
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
            bypassed_trazables,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Restores trazabilidad flag (trazable = 1) for the specified product IDs in Plex
#[tauri::command]
pub async fn restore_plex_trazables(
    config: MysqlConfig,
    product_ids: Vec<i64>,
) -> Result<bool, String> {
    if product_ids.is_empty() {
        return Ok(true);
    }
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;
        for chunk in product_ids.chunks(100) {
            let id_list = chunk.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(", ");
            let q_restore = format!(
                "UPDATE productos SET trazable = 1 WHERE IDProducto IN ({})",
                id_list
            );
            conn.query_drop(&q_restore)
                .map_err(|e| format!("Error restaurando trazabilidad: {}", e))?;
        }
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Checks current status of a batch in inventario_ws ('PENDIENTE', 'INGRESADO', etc.)
#[tauri::command]
pub async fn check_plex_batch_status(
    config: MysqlConfig,
    id_registro: i64,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;
        let q = format!("SELECT Estado FROM inventario_ws WHERE IDRegistro = {}", id_registro);
        let rows: Vec<String> = conn.query_map(&q, |estado: String| estado)
            .map_err(|e| format!("Error consultando estado de lote: {}", e))?;
        
        Ok(rows.into_iter().next().unwrap_or_else(|| "DESCONOCIDO".to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlexAdjustmentStatus {
    pub id_inventario: Option<i64>,
    pub id_estado: Option<i64>,
    pub estado_desc: String,
    pub tipo_ajuste: Option<String>,
    pub is_adjusted: bool,
}

/// Checks whether an inventory session in Plex has been adjusted/reconciled (IDEstado = 4 or TipoAjuste is set)
#[tauri::command]
pub async fn check_plex_inventory_adjustment(
    config: MysqlConfig,
    product_ids: Vec<i64>,
    id_inventario: Option<i64>,
) -> Result<PlexAdjustmentStatus, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;

        let inv_id: Option<i64> = match id_inventario {
            Some(id) if id > 0 => Some(id),
            _ => {
                if !product_ids.is_empty() {
                    let id_list = product_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(", ");
                    let q = format!(
                        "SELECT IDInventario FROM inventariosmovimientos \
                         WHERE TipoMovimiento = 'E' AND IDProducto IN ({}) \
                         ORDER BY IDMovimiento DESC LIMIT 1",
                        id_list
                    );
                    conn.query_map(&q, |id: i64| id)
                        .ok()
                        .and_then(|mut rows| rows.pop())
                } else {
                    None
                }
            }
        };

        if let Some(target_id) = inv_id {
            let q = format!(
                "SELECT i.IDEstado, IFNULL(e.Descripcion, 'DESCONOCIDO'), i.TipoAjuste \
                 FROM inventarios i \
                 LEFT JOIN inventariosestados e ON e.IDEstado = i.IDEstado \
                 WHERE i.IDInventario = {}",
                target_id
            );

            let res: Option<(i64, String, Option<String>)> = conn.query_map(&q, |(estado, desc, tipo): (i64, String, Option<String>)| {
                (estado, desc, tipo)
            })
            .ok()
            .and_then(|mut rows| rows.pop());

            if let Some((estado, desc, tipo)) = res {
                let is_adjusted = estado == 4 || tipo.is_some();
                return Ok(PlexAdjustmentStatus {
                    id_inventario: Some(target_id),
                    id_estado: Some(estado),
                    estado_desc: desc,
                    tipo_ajuste: tipo,
                    is_adjusted,
                });
            }
        }

        Ok(PlexAdjustmentStatus {
            id_inventario: inv_id,
            id_estado: None,
            estado_desc: "NO_INICIADO".to_string(),
            tipo_ajuste: None,
            is_adjusted: false,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlexOperatorVerification {
    pub is_authorized: bool,
    pub id_usuario: Option<i64>,
    pub user_name: String,
    pub full_name: String,
    pub profile: String,
    pub is_admin: bool,
    pub message: String,
}

#[tauri::command]
pub async fn verify_plex_operator(
    config: MysqlConfig,
    user_name: String,
) -> Result<PlexOperatorVerification, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;

        let clean_user = user_name.trim();
        let q = format!(
            "SELECT u.IDUsuario, u.Nombre, u.NombreCompleto, IFNULL(p.Perfil, 'SIN PERFIL'), IFNULL(u.Administrador, 'N') \
             FROM usuarios u \
             LEFT JOIN usuariosperfiles p ON u.IdPerfil = p.IDPerfil \
             WHERE (u.Nombre = '{0}' OR u.NombreCompleto LIKE '%{0}%') AND u.Activo = 'S' \
             LIMIT 1",
            clean_user.replace('\'', "''")
        );

        let row: Option<(i64, String, String, String, String)> = conn
            .query_map(&q, |(id, nom, nom_comp, perf, adm): (i64, String, String, String, String)| {
                (id, nom, nom_comp, perf, adm)
            })
            .ok()
            .and_then(|mut r| r.pop());

        if let Some((id, nom, nom_comp, perf, adm)) = row {
            let perf_upper = perf.to_uppercase();
            let is_admin = adm.to_uppercase() == "S";
            let is_authorized = is_admin
                || perf_upper.contains("ENCARGAD")
                || perf_upper.contains("SUB")
                || perf_upper.contains("INVENTARIO");

            let msg = if is_authorized {
                format!("Operador autorizado: {} ({})", nom_comp, perf)
            } else {
                format!("El usuario {} ({}) no posee rol de Encargado/Subencargado.", nom_comp, perf)
            };

            return Ok(PlexOperatorVerification {
                is_authorized,
                id_usuario: Some(id),
                user_name: nom,
                full_name: nom_comp,
                profile: perf,
                is_admin,
                message: msg,
            });
        }

        Ok(PlexOperatorVerification {
            is_authorized: false,
            id_usuario: None,
            user_name: clean_user.to_string(),
            full_name: String::new(),
            profile: "NO ENCONTRADO".to_string(),
            is_admin: false,
            message: format!("No se encontró un usuario activo con nombre '{}' en la sucursal.", clean_user),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_plex_branch_operators(
    config: MysqlConfig,
) -> Result<Vec<PlexOperatorVerification>, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;

        let q = "SELECT u.IDUsuario, u.Nombre, u.NombreCompleto, IFNULL(p.Perfil, 'SIN PERFIL'), IFNULL(u.Administrador, 'N') \
                 FROM usuarios u \
                 LEFT JOIN usuariosperfiles p ON u.IdPerfil = p.IDPerfil \
                 WHERE u.Activo = 'S' AND (u.Administrador = 'S' OR p.Perfil LIKE '%ENCARGAD%' OR p.Perfil LIKE '%SUB%' OR p.Perfil LIKE '%INVENTARIO%' OR p.Perfil LIKE '%ADM%') \
                 ORDER BY u.NombreCompleto ASC";

        let rows: Vec<(i64, String, String, String, String)> = conn
            .query_map(q, |(id, nom, nom_comp, perf, adm): (i64, String, String, String, String)| {
                (id, nom, nom_comp, perf, adm)
            })
            .map_err(|e| format!("Error cargando operadores de Plex: {}", e))?;

        let operators = rows
            .into_iter()
            .map(|(id, nom, nom_comp, perf, adm)| {
                let is_admin = adm.to_uppercase() == "S";
                PlexOperatorVerification {
                    is_authorized: true,
                    id_usuario: Some(id),
                    user_name: nom,
                    full_name: nom_comp.clone(),
                    profile: perf.clone(),
                    is_admin,
                    message: format!("Operador: {} ({})", nom_comp, perf),
                }
            })
            .collect();

        Ok(operators)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlexAdjustmentItemInput {
    pub id_producto: Option<String>,
    pub ean: String,
    pub quantity: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlexAdjustmentResult {
    pub success: bool,
    pub alta_id: Option<i64>,
    pub baja_id: Option<i64>,
    pub total_altas: usize,
    pub total_bajas: usize,
    pub message: String,
    pub logs: Vec<String>,
}



#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct NextAdjustmentIdsResult {
    pub next_shortage_id: Option<i64>,
    pub next_surplus_id: Option<i64>,
}

#[tauri::command]
pub async fn get_next_plex_adjustment_ids(
    config: MysqlConfig,
    branch_id: i64,
    has_shortage: bool,
    has_surplus: bool,
) -> Result<NextAdjustmentIdsResult, String> {
    tokio::task::spawn_blocking(move || {
        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;

        let query = "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_operaciones'";
        let mut next_id: i64 = conn.query_first::<i64, _>(query)
            .ok()
            .flatten()
            .unwrap_or(0);

        if next_id == 0 {
            next_id = conn.query_first::<i64, _>("SELECT IFNULL(MAX(IDOperacion), 0) + 1 FROM stock_operaciones")
                .ok()
                .flatten()
                .unwrap_or(1);
        }

        let format_id = |op_id: i64| -> i64 {
            if branch_id > 0 {
                branch_id * 10_000_000 + op_id
            } else {
                op_id
            }
        };

        let mut next_shortage_id = None;
        let mut next_surplus_id = None;
        let mut current = next_id;

        if has_shortage {
            next_shortage_id = Some(format_id(current));
            current += 1;
        }

        if has_surplus {
            next_surplus_id = Some(format_id(current));
        }

        Ok(NextAdjustmentIdsResult {
            next_shortage_id,
            next_surplus_id,
        })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn execute_plex_cyclic_adjustments(
    config: MysqlConfig,
    operator_id: i64,
    operator_name: String,
    branch_id: i64,
    lab_name: String,
    shortages: Vec<PlexAdjustmentItemInput>,
    surpluses: Vec<PlexAdjustmentItemInput>,
) -> Result<PlexAdjustmentResult, String> {
    tokio::task::spawn_blocking(move || {
        // Validación antifraude en vivo: comprobar que Plex no esté en pantalla de bloqueo
        if let Ok(session) = crate::plex_session::check_plex_session() {
            if session.running && !session.logged_in {
                return Err("Operación bloqueada: Plex está en pantalla de bloqueo por inactividad. Ingrese con credencial para autorizar.".to_string());
            }
        }

        let (mut conn, _) = connect_with_fallback(&config, 5000, None)?;
        use mysql::prelude::Queryable;

        let mut logs = Vec::new();
        logs.push(format!("Iniciando Ajustes de Stock Plex para {} en Sucursal {}", lab_name, branch_id));

        let obs_alta = "INVENTARIO CICLICO".to_string();
        let obs_baja = "INVENTARIO CICLICO".to_string();

        let mut alta_op_id: Option<i64> = None;
        let mut baja_op_id: Option<i64> = None;

        // 1. PROCESAR BAJAS (Faltantes) - Motivo 1 (Faltante)
        if !shortages.is_empty() {
            let mut tx = conn.start_transaction(mysql::TxOpts::default())
                .map_err(|e| format!("Error iniciando transacción para Bajas: {}", e))?;

            let q_head = format!(
                "INSERT INTO stock_operaciones (FechaHora, IdUsuario, idMotivoOpStock, Observacion) \
                 VALUES (NOW(), {}, 1, '{}')",
                operator_id, obs_baja.replace('\'', "''")
            );
            tx.query_drop(&q_head).map_err(|e| format!("Error en cabecera Bajas: {}", e))?;
            let op_id: i64 = tx.last_insert_id().unwrap_or(0) as i64;
            let id_global = branch_id * 10000000 + op_id;

            let q_glob = format!("UPDATE stock_operaciones SET IDGlobal = {} WHERE IDOperacion = {}", id_global, op_id);
            tx.query_drop(&q_glob).ok();

            for item in &shortages {
                let qty = item.quantity.abs();
                if qty == 0 { continue; }

                let prod_row: Option<(i64, f64, f64, f64)> = if let Some(pid_num) = item.id_producto.as_deref().and_then(|s| s.trim().parse::<i64>().ok()) {
                    tx.exec_first(
                        "SELECT IDProducto, IFNULL(Costo, 0), IFNULL(UltimoCosto, 0), IFNULL(UltimoPrecio, 0) FROM productos WHERE IDProducto = ? LIMIT 1",
                        (pid_num,),
                    ).ok().flatten()
                } else {
                    tx.exec_first(
                        "SELECT IDProducto, IFNULL(Costo, 0), IFNULL(UltimoCosto, 0), IFNULL(UltimoPrecio, 0) FROM productos WHERE Codebar = ? LIMIT 1",
                        (&item.ean,),
                    ).ok().flatten()
                };

                if let Some((prod_id, costo, ult_costo, precio)) = prod_row {
                    let q_det = format!(
                        "INSERT INTO stock_operaciones_detalle \
                         (IDOperacion, IDProducto, NroLote, FechaVencimiento, Serie, Cantidad, Unidades, UnidadesProducto, Costo, UltimoCosto, Precio) \
                         VALUES ({}, {}, '', NULL, '', {}, 0, 1, {}, {}, {})",
                        op_id, prod_id, qty, costo, ult_costo, precio
                    );
                    tx.query_drop(&q_det).map_err(|e| format!("Error en detalle Baja (prod {}): {}", prod_id, e))?;

                    let q_stk = format!(
                        "INSERT INTO stock (IDProducto, Cantidad, Unidades, Minimo, maximo, seguridad) \
                         VALUES ({0}, -{1}, 0, 0, 0, 0) \
                         ON DUPLICATE KEY UPDATE Cantidad = Cantidad - {1}",
                        prod_id, qty
                    );
                    tx.query_drop(&q_stk).map_err(|e| format!("Error actualizando stock Baja (prod {}): {}", prod_id, e))?;

                    let q_mov = format!(
                        "INSERT INTO stockmovimientos \
                         (IDProducto, IDUsuario, Fecha, Hora, TipoMovimiento, Cantidad, Unidades, Referencia, IDOperacionStock) \
                         VALUES ({}, {}, CURDATE(), CURTIME(), 'E', -{}, 0, 'Baja de Stock', {})",
                        prod_id, operator_id, qty, op_id
                    );
                    tx.query_drop(&q_mov).ok();

                    let log_sess = format!("usr={};dll=Stock;ver=12.4.2.1", operator_name.replace('\'', "''"));
                    let q_log = format!(
                        "INSERT INTO log_stock (IDProducto, Cantidad, Unidades, Minimo, Log_Session, Log_Date, Log_Type) \
                         VALUES ({}, (SELECT Cantidad FROM stock WHERE IDProducto = {}), 0, 0, '{}', NOW(), 'UPDATE')",
                        prod_id, prod_id, log_sess
                    );
                    tx.query_drop(&q_log).ok();
                }
            }

            tx.commit().map_err(|e| format!("Error haciendo commit de Bajas: {}", e))?;
            baja_op_id = Some(if branch_id > 0 { id_global } else { op_id });
            logs.push(format!("Bajas registradas con éxito (Operación #{}, IDGlobal {})", op_id, id_global));
        }

        // 2. PROCESAR ALTAS (Sobrantes) - Motivo 9 (Inventario Alta)
        if !surpluses.is_empty() {
            let mut tx = conn.start_transaction(mysql::TxOpts::default())
                .map_err(|e| format!("Error iniciando transacción para Altas: {}", e))?;

            let q_head = format!(
                "INSERT INTO stock_operaciones (FechaHora, IdUsuario, idMotivoOpStock, Observacion) \
                 VALUES (NOW(), {}, 9, '{}')",
                operator_id, obs_alta.replace('\'', "''")
            );
            tx.query_drop(&q_head).map_err(|e| format!("Error en cabecera Altas: {}", e))?;
            let op_id: i64 = tx.last_insert_id().unwrap_or(0) as i64;
            let id_global = branch_id * 10000000 + op_id;

            let q_glob = format!("UPDATE stock_operaciones SET IDGlobal = {} WHERE IDOperacion = {}", id_global, op_id);
            tx.query_drop(&q_glob).ok();

            for item in &surpluses {
                let qty = item.quantity.abs();
                if qty == 0 { continue; }

                let prod_row: Option<(i64, f64, f64, f64)> = if let Some(pid_num) = item.id_producto.as_deref().and_then(|s| s.trim().parse::<i64>().ok()) {
                    tx.exec_first(
                        "SELECT IDProducto, IFNULL(Costo, 0), IFNULL(UltimoCosto, 0), IFNULL(UltimoPrecio, 0) FROM productos WHERE IDProducto = ? LIMIT 1",
                        (pid_num,),
                    ).ok().flatten()
                } else {
                    tx.exec_first(
                        "SELECT IDProducto, IFNULL(Costo, 0), IFNULL(UltimoCosto, 0), IFNULL(UltimoPrecio, 0) FROM productos WHERE Codebar = ? LIMIT 1",
                        (&item.ean,),
                    ).ok().flatten()
                };

                if let Some((prod_id, costo, ult_costo, precio)) = prod_row {
                    let q_det = format!(
                        "INSERT INTO stock_operaciones_detalle \
                         (IDOperacion, IDProducto, NroLote, FechaVencimiento, Serie, Cantidad, Unidades, UnidadesProducto, Costo, UltimoCosto, Precio) \
                         VALUES ({}, {}, '', NULL, '', {}, 0, 1, {}, {}, {})",
                        op_id, prod_id, qty, costo, ult_costo, precio
                    );
                    tx.query_drop(&q_det).map_err(|e| format!("Error en detalle Alta (prod {}): {}", prod_id, e))?;

                    let q_stk = format!(
                        "INSERT INTO stock (IDProducto, Cantidad, Unidades, Minimo, maximo, seguridad) \
                         VALUES ({0}, {1}, 0, 0, 0, 0) \
                         ON DUPLICATE KEY UPDATE Cantidad = Cantidad + {1}",
                        prod_id, qty
                    );
                    tx.query_drop(&q_stk).map_err(|e| format!("Error actualizando stock Alta (prod {}): {}", prod_id, e))?;

                    let q_mov = format!(
                        "INSERT INTO stockmovimientos \
                         (IDProducto, IDUsuario, Fecha, Hora, TipoMovimiento, Cantidad, Unidades, Referencia, IDOperacionStock) \
                         VALUES ({}, {}, CURDATE(), CURTIME(), 'E', {}, 0, 'Alta de Stock', {})",
                        prod_id, operator_id, qty, op_id
                    );
                    tx.query_drop(&q_mov).ok();

                    let log_sess = format!("usr={};dll=Stock;ver=12.4.2.1", operator_name.replace('\'', "''"));
                    let q_log = format!(
                        "INSERT INTO log_stock (IDProducto, Cantidad, Unidades, Minimo, Log_Session, Log_Date, Log_Type) \
                         VALUES ({}, (SELECT Cantidad FROM stock WHERE IDProducto = {}), 0, 0, '{}', NOW(), 'UPDATE')",
                        prod_id, prod_id, log_sess
                    );
                    tx.query_drop(&q_log).ok();
                }
            }

            tx.commit().map_err(|e| format!("Error haciendo commit de Altas: {}", e))?;
            alta_op_id = Some(if branch_id > 0 { id_global } else { op_id });
            logs.push(format!("Altas registradas con éxito (Operación #{}, IDGlobal {})", op_id, id_global));
        }

        Ok(PlexAdjustmentResult {
            success: true,
            alta_id: alta_op_id,
            baja_id: baja_op_id,
            total_altas: surpluses.len(),
            total_bajas: shortages.len(),
            message: format!("Ajustes impactados en Plex correctamente (Altas: {}, Bajas: {}).", surpluses.len(), shortages.len()),
            logs,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_candidate_hosts_prevents_cross_subnet_switching() {
        // Sucursal 4 Retiro II (10.0.4.10) NUNCA debe incluir 192.168.4.10 (Sucursal 22 Flores)
        let candidates_suc_4 = get_candidate_hosts("10.0.4.10");
        assert_eq!(candidates_suc_4, vec!["10.0.4.10"]);
        assert!(!candidates_suc_4.contains(&"192.168.4.10".to_string()));

        // Sucursal 22 Flores (192.168.22.10) tampoco debe saltar a 10.0.22.10
        let candidates_suc_22 = get_candidate_hosts("192.168.22.10");
        assert_eq!(candidates_suc_22, vec!["192.168.22.10"]);
        assert!(!candidates_suc_22.contains(&"10.0.22.10".to_string()));
    }

    #[test]
    fn test_candidate_hosts_localhost_fallback() {
        let localhost = get_candidate_hosts("localhost");
        assert_eq!(localhost, vec!["localhost", "127.0.0.1"]);

        let loopback = get_candidate_hosts("127.0.0.1");
        assert_eq!(loopback, vec!["127.0.0.1", "localhost"]);
    }
}



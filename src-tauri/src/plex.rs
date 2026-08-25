use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlexProduct {
    pub idproducto: String,
    pub producto: String,
    pub stock: i64,
    pub codebars: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlexFetchResult {
    pub success: bool,
    pub message: String,
    pub total_products: usize,
    pub total_codebars: usize,
    pub products: Vec<PlexProduct>,
    pub logs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlexExportRecord {
    pub idproducto: String,
    pub codebar: String,
    pub cantidad: i64,
}

/// Test connection to Plex TCP server on host:port
#[tauri::command]
pub async fn test_plex_connection(host: String, port: u16) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let addr_str = format!("{}:{}", host, port);
        let addrs: Vec<SocketAddr> = addr_str
            .to_socket_addrs()
            .map_err(|e| format!("Error al resolver {}: {}", addr_str, e))?
            .collect();

        if addrs.is_empty() {
            return Err(format!("No se pudo resolver {}", addr_str));
        }

        match TcpStream::connect_timeout(&addrs[0], Duration::from_millis(3000)) {
            Ok(_) => Ok(format!("Conexión exitosa a {}:{} (VPN / Red OK)", host, port)),
            Err(e) => Err(format!("Sin conexión a {}:{}: {}", host, port, e)),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Fetch catalog products directly from Plex TCP server
#[tauri::command]
pub async fn fetch_plex_stock(host: String, port: u16) -> Result<PlexFetchResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut logs = Vec::new();
        logs.push(format!("Iniciando consulta directa de stock a {}:{}", host, port));

        let addr_str = format!("{}:{}", host, port);
        let addrs: Vec<SocketAddr> = addr_str
            .to_socket_addrs()
            .map_err(|e| format!("Error al resolver {}: {}", addr_str, e))?
            .collect();

        if addrs.is_empty() {
            return Err(format!("No se pudo resolver {}", addr_str));
        }

        let variants = ["N", "S", "0"];
        let mut last_error = String::new();

        for (idx, variant) in variants.iter().enumerate() {
            logs.push(format!("Intento {}/{}: Solicitando catálogo completo (soloenstock='{}')...", idx + 1, variants.len(), variant));

            let mut stream = match TcpStream::connect_timeout(&addrs[0], Duration::from_millis(5000)) {
                Ok(s) => s,
                Err(e) => {
                    let err_msg = format!("Fallo al conectar a {}:{}: {}", host, port, e);
                    logs.push(err_msg.clone());
                    last_error = err_msg;
                    continue;
                }
            };

            if let Err(e) = stream.set_read_timeout(Some(Duration::from_secs(90))) {
                logs.push(format!("Advertencia timeout lectura: {}", e));
            }
            if let Err(e) = stream.set_write_timeout(Some(Duration::from_secs(15))) {
                logs.push(format!("Advertencia timeout escritura: {}", e));
            }

            let request_payload = serde_json::json!({
                "request": {
                    "type": "GET_PRODUCTOS",
                    "content": {
                        "soloenstock": variant,
                        "codrubro": "0",
                        "codlab": "0",
                        "desdeletra": "A",
                        "hastaletra": "Z",
                        "inactivos": "S",
                        "incluirinactivos": "S",
                        "bajas": "S",
                        "incluirbajas": "S",
                        "ocultos": "S",
                        "activos": "T",
                        "estado": "T",
                        "todos": "S"
                    }
                }
            });

            let frame = format!("<JN>{}\r\n", request_payload.to_string());
            logs.push("Enviando petición TCP a Plex...".to_string());

            if let Err(e) = stream.write_all(frame.as_bytes()) {
                logs.push(format!("Error enviando petición: {}", e));
                last_error = e.to_string();
                continue;
            }
            let _ = stream.flush();

            logs.push("Esperando flujo de respuesta del servidor...".to_string());

            let mut reader = BufReader::new(stream);
            let mut raw_line = String::new();

            match reader.read_line(&mut raw_line) {
                Ok(0) => {
                    logs.push("El servidor devolvió 0 bytes.".to_string());
                    last_error = "Servidor devolvió 0 bytes".to_string();
                    continue;
                }
                Ok(bytes) => {
                    let mb = (bytes as f64) / (1024.0 * 1024.0);
                    logs.push(format!("Catálogo recibido: {} bytes ({:.2} MB)", bytes, mb));
                }
                Err(e) => {
                    logs.push(format!("Error leyendo stream: {}", e));
                    last_error = e.to_string();
                    continue;
                }
            }

            // Extract JSON between '{' and '}'
            let start_idx = raw_line.find('{');
            let end_idx = raw_line.rfind('}');

            let json_str = match (start_idx, end_idx) {
                (Some(s), Some(e)) if s < e => &raw_line[s..=e],
                _ => {
                    logs.push("No se encontró estructura JSON válida en la respuesta.".to_string());
                    last_error = "Respuesta sin JSON válido".to_string();
                    continue;
                }
            };

            logs.push("Parseando JSON de productos...".to_string());

            let root_val: serde_json::Value = match serde_json::from_str(json_str) {
                Ok(v) => v,
                Err(e) => {
                    logs.push(format!("Error parseando JSON: {}", e));
                    last_error = e.to_string();
                    continue;
                }
            };

            let productos_arr = root_val
                .get("response")
                .and_then(|r| r.get("content"))
                .and_then(|c| c.get("productos"))
                .and_then(|p| p.as_array());

            let productos_arr = match productos_arr {
                Some(arr) if !arr.is_empty() => arr,
                _ => {
                    logs.push("Listado de productos vacío en esta variante.".to_string());
                    last_error = "Array de productos vacío".to_string();
                    continue;
                }
            };

            logs.push(format!("¡Procesando {} productos recibidos!", productos_arr.len()));

            let mut parsed_products: Vec<PlexProduct> = Vec::with_capacity(productos_arr.len());
            let mut total_codebars_count = 0;

            for p_val in productos_arr {
                let idproducto = p_val.get("codproducto")
                    .or_else(|| p_val.get("idproducto"))
                    .or_else(|| p_val.get("id"))
                    .or_else(|| p_val.get("codigo"))
                    .and_then(|v| v.as_str().or_else(|| v.as_i64().map(|n| Box::leak(n.to_string().into_boxed_str()) as &str)))
                    .unwrap_or("")
                    .trim()
                    .to_string();

                if idproducto.is_empty() {
                    continue;
                }

                let producto_nom = p_val.get("producto")
                    .or_else(|| p_val.get("descripcion"))
                    .or_else(|| p_val.get("nombre"))
                    .or_else(|| p_val.get("nomproducto"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Sin Nombre")
                    .trim()
                    .to_string();

                let stock = p_val.get("stock")
                    .or_else(|| p_val.get("cantidad"))
                    .or_else(|| p_val.get("stockactual"))
                    .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())))
                    .unwrap_or(0);

                let mut codebars_set: HashSet<String> = HashSet::new();

                // 1. Parse codebars array
                if let Some(cb_arr) = p_val.get("codebars").and_then(|v| v.as_array()) {
                    for item in cb_arr {
                        if let Some(s) = item.as_str() {
                            let clean = s.trim();
                            if !clean.is_empty() {
                                codebars_set.insert(clean.to_string());
                            }
                        } else if let Some(obj) = item.as_object() {
                            if let Some(cb_val) = obj.get("codebar").or_else(|| obj.get("code")).and_then(|v| v.as_str()) {
                                let clean = cb_val.trim();
                                if !clean.is_empty() {
                                    codebars_set.insert(clean.to_string());
                                }
                            }
                        }
                    }
                }

                // 2. Fallback candidate keys
                let candidate_keys = [
                    "codebar", "codebars", "codbarra", "codbarras", "codigobarra",
                    "codigobarras", "barcode", "ean", "ean13", "cbarra", "cbarras"
                ];

                for key in &candidate_keys {
                    if let Some(val_str) = p_val.get(*key).and_then(|v| v.as_str()) {
                        let trimmed = val_str.trim();
                        if !trimmed.is_empty() && !trimmed.starts_with('{') && !trimmed.starts_with('[') {
                            if trimmed.contains(',') {
                                for part in trimmed.split(',') {
                                    let clean_part = part.trim();
                                    if !clean_part.is_empty() {
                                        codebars_set.insert(clean_part.to_string());
                                    }
                                }
                            } else {
                                codebars_set.insert(trimmed.to_string());
                            }
                        }
                    }
                }

                // 3. Fallback to ID itself
                codebars_set.insert(idproducto.clone());

                let mut codebars: Vec<String> = codebars_set.into_iter().collect();
                codebars.sort();
                total_codebars_count += codebars.len();

                parsed_products.push(PlexProduct {
                    idproducto,
                    producto: producto_nom,
                    stock,
                    codebars,
                });
            }

            let total_prods = parsed_products.len();
            logs.push(format!("Importación finalizada con éxito: {} productos ({} códigos EAN).", total_prods, total_codebars_count));

            return Ok(PlexFetchResult {
                success: true,
                message: format!("Stock importado exitosamente desde Plex: {} productos.", total_prods),
                total_products: total_prods,
                total_codebars: total_codebars_count,
                products: parsed_products,
                logs,
            });
        }

        Err(format!("No se pudo importar stock de Plex. Último error: {}", last_error))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Export inventory count back to Plex TCP server
#[tauri::command]
pub async fn export_plex_inventory(host: String, port: u16, records: Vec<PlexExportRecord>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        if records.is_empty() {
            return Err("No hay registros para exportar.".to_string());
        }

        let addr_str = format!("{}:{}", host, port);
        let addrs: Vec<SocketAddr> = addr_str
            .to_socket_addrs()
            .map_err(|e| format!("Error al resolver {}: {}", addr_str, e))?
            .collect();

        if addrs.is_empty() {
            return Err(format!("No se pudo resolver {}", addr_str));
        }

        let mut stream = TcpStream::connect_timeout(&addrs[0], Duration::from_millis(5000))
            .map_err(|e| format!("No se pudo conectar a {}:{}: {}", host, port, e))?;

        let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(15)));

        let prods_json: Vec<serde_json::Value> = records
            .iter()
            .map(|r| {
                serde_json::json!({
                    "idproducto": r.idproducto,
                    "codebar": r.codebar,
                    "cantidad": r.cantidad
                })
            })
            .collect();

        let payload = serde_json::json!({
            "request": {
                "type": "INFORMAR_INVENTARIO",
                "content": {
                    "productos": prods_json
                }
            }
        });

        let frame = format!("<JN>{}\r\n", payload.to_string());
        stream.write_all(frame.as_bytes())
            .map_err(|e| format!("Error enviando inventario: {}", e))?;
        let _ = stream.flush();

        let mut reader = BufReader::new(stream);
        let mut response = String::new();
        let _ = reader.read_line(&mut response);

        Ok(format!("Inventario exportado a Plex exitosamente ({} productos). Respuesta: {}", records.len(), response.trim()))
    })
    .await
    .map_err(|e| e.to_string())?
}

use std::collections::HashSet;
use std::time::Duration;

use almacen::{ArticuloPadron, CodigoBarra};
use comun::{ErrorNucleo, SucursalId};
use mysql::prelude::Queryable;
use mysql::{OptsBuilder, Pool, PooledConn, Row, TxOpts, Value};
use serde::{Deserialize, Serialize};

use crate::red::candidatos_anfitrion;
use crate::sesion::EstadoTerminalLocal;

/// Factor multiplicador canonico por sucursal para componer `IDGlobal` en Plex.
pub const FACTOR_ID_GLOBAL: u64 = 10_000_000;

/// Configuracion de sesion MySQL requerida antes de consultar codigos alternativos agrupados.
pub const CONFIG_SESSION_GROUP_CONCAT: &str = "SET SESSION group_concat_max_len = 65535;";

const MOTIVO_BASE_CICLICO: &str = "INVENTARIO CICLICO";

const CONSULTA_PADRON_ACTIVOS: &str = "\
SELECT \
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
    GROUP_CONCAT(DISTINCT PC.codebar SEPARATOR ', ') AS CodigosBarraAlternativos, \
    L.Nombre AS Laboratorio, \
    R.Nombre AS Rubro, \
    SR.Nombre AS SubRubro, \
    IFNULL(P.IdProductoPadre, 0) AS id_producto_padre, \
    IFNULL(P.UnidadesPadre, 0) AS unidades_padre, \
    IFNULL(PP.Codebar, '') AS parent_ean, \
    TRIM(CONCAT(IFNULL(PP.Producto, ''), ' ', IFNULL(PP.Presentacion, ''))) AS parent_name, \
    P.Activo AS activo \
FROM productos P \
JOIN stock S ON S.IDProducto = P.IDProducto \
LEFT JOIN productoscodebars PC ON PC.IDProducto = P.IDProducto \
LEFT JOIN laboratorios L ON L.IDLaboratorio = P.IDLaboratorio \
LEFT JOIN rubros R ON R.IDRubro = P.IDRubro \
LEFT JOIN subrubros SR ON SR.IDSubRubro = P.IDSubRubro \
LEFT JOIN productos PP ON PP.IDProducto = P.IdProductoPadre \
WHERE (P.Activo = 'S' OR P.Activo = '1') \
  AND (P.servicio = 0 OR P.servicio IS NULL) \
  AND (P.visible = 1 OR P.visible = '1') \
GROUP BY P.IDProducto \
ORDER BY P.IDProducto ASC";

const CONSULTA_PADRON_COMPLETO: &str = "\
SELECT \
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
    GROUP_CONCAT(DISTINCT PC.codebar SEPARATOR ', ') AS CodigosBarraAlternativos, \
    L.Nombre AS Laboratorio, \
    R.Nombre AS Rubro, \
    SR.Nombre AS SubRubro, \
    IFNULL(P.IdProductoPadre, 0) AS id_producto_padre, \
    IFNULL(P.UnidadesPadre, 0) AS unidades_padre, \
    IFNULL(PP.Codebar, '') AS parent_ean, \
    TRIM(CONCAT(IFNULL(PP.Producto, ''), ' ', IFNULL(PP.Presentacion, ''))) AS parent_name, \
    P.Activo AS activo \
FROM productos P \
JOIN stock S ON S.IDProducto = P.IDProducto \
LEFT JOIN productoscodebars PC ON PC.IDProducto = P.IDProducto \
LEFT JOIN laboratorios L ON L.IDLaboratorio = P.IDLaboratorio \
LEFT JOIN rubros R ON R.IDRubro = P.IDRubro \
LEFT JOIN subrubros SR ON SR.IDSubRubro = P.IDSubRubro \
LEFT JOIN productos PP ON PP.IDProducto = P.IdProductoPadre \
WHERE (P.servicio = 0 OR P.servicio IS NULL) \
GROUP BY P.IDProducto \
ORDER BY P.IDProducto ASC";

/// Motivo de ajuste de inventario reconocido por el esquema local de Plex.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum MotivoAjusteLocal {
    BajaFaltante = 1,
    AltaSobrante = 9,
}

impl MotivoAjusteLocal {
    /// Codigo numerico esperado por `stock_operaciones.idMotivoOpStock`.
    pub fn codigo_plex(self) -> u8 {
        self as u8
    }

    /// Referencia escrita en `stockmovimientos.Referencia`.
    pub fn referencia_movimiento(self) -> &'static str {
        match self {
            Self::BajaFaltante => "Baja de Stock",
            Self::AltaSobrante => "Alta de Stock",
        }
    }
}

/// Renglon individual validado para impactar un ajuste de inventario local.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RenglonAjusteLocal {
    pub producto_id: Option<String>,
    pub codigo: String,
    pub cantidad: f64,
    pub motivo: MotivoAjusteLocal,
}

/// Lote autorizado e idempotente listo para ejecutarse contra la base local de sucursal.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LoteAjusteLocal {
    pub sucursal_id: SucursalId,
    pub id_idempotencia: String,
    pub huella_idempotencia: String,
    pub observacion: String,
    pub operador: Option<String>,
    pub terminal: Option<String>,
    pub bajas: Vec<RenglonAjusteLocal>,
    pub altas: Vec<RenglonAjusteLocal>,
}

impl LoteAjusteLocal {
    /// Cantidad total de renglones incluidos entre bajas y altas.
    pub fn total_renglones(&self) -> usize {
        self.bajas.len() + self.altas.len()
    }
}

/// Parametros tipados de conexion hacia la base MySQL de la sucursal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfiguracionMysql {
    pub anfitrion: String,
    pub puerto: u16,
    pub usuario: String,
    pub credencial: Option<String>,
    pub base_datos: String,
    pub tiempo_espera_ms: u64,
}

/// Resultado consolidado luego de aplicar o verificar un lote de ajuste en Plex.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResultadoAjusteLocal {
    pub id_operacion_baja: Option<u64>,
    pub id_operacion_alta: Option<u64>,
    pub id_global_baja: Option<u64>,
    pub id_global_alta: Option<u64>,
    pub total_bajas: usize,
    pub total_altas: usize,
    pub anfitrion_conectado: String,
    pub ya_existia_idempotente: bool,
}

/// Cabecera de envio interfarmacia leida en solo lectura desde `onze_center.envios`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EnvioInterfarmaciaCrudo {
    pub id_envio: u64,
    pub id_envio_global: u64,
    pub fecha_envio: String,
    pub fecha_recepcion: Option<String>,
    pub descripcion: String,
    pub suc_origen: i32,
    pub origen_nombre: String,
    pub suc_destino: i32,
    pub destino_nombre: String,
    pub id_estado: i32,
    pub operador_envio: String,
    pub operador_recepcion: Option<String>,
}

/// Linea de producto de un envio interfarmacia leida desde `onze_center.envioslineas`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineaInterfarmaciaCruda {
    pub id_envio_global: u64,
    pub orden: i32,
    pub id_producto: u64,
    pub ean: String,
    pub producto: String,
    pub laboratorio: String,
    pub rubro: String,
    pub cantidad_enviada: f64,
    pub cantidad_recibida: Option<f64>,
    pub costo_ppp: f64,
    pub lote_vto: Option<String>,
    pub lote_fecha_vto: Option<String>,
}

/// Paquete completo de envios interfarmacias + lineas devuelto al frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResultadoInterfarmaciasMysql {
    pub envios: Vec<EnvioInterfarmaciaCrudo>,
    pub lineas: Vec<LineaInterfarmaciaCruda>,
}

/// Calcula el `IDGlobal` de Plex para una sucursal y numero de operacion local.
pub fn calcular_id_global(sucursal_id: SucursalId, id_operacion: u64) -> u64 {
    u64::from(sucursal_id.0)
        .saturating_mul(FACTOR_ID_GLOBAL)
        .saturating_add(id_operacion)
}

fn extraer_huella_idempotencia(id_idempotencia: &str) -> String {
    id_idempotencia
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(8)
        .collect()
}

/// Estampa la huella corta de idempotencia `[ID:xxxxxxxx]` sobre la observacion de Plex.
pub fn estampar_observacion_idempotente(motivo_base: &str, id_idempotencia: &str) -> String {
    let base = motivo_base.trim();
    let huella = extraer_huella_idempotencia(id_idempotencia);
    if huella.is_empty() {
        return base.to_owned();
    }
    if contiene_huella_idempotencia(base, id_idempotencia) {
        return base.to_owned();
    }
    if base.is_empty() {
        format!("[ID:{}]", huella)
    } else {
        format!("{} [ID:{}]", base, huella)
    }
}

/// Verifica si una observacion de `stock_operaciones` ya contiene la huella `[ID:xxxxxxxx]`.
pub fn contiene_huella_idempotencia(observacion: &str, id_idempotencia: &str) -> bool {
    let huella = extraer_huella_idempotencia(id_idempotencia);
    if huella.is_empty() {
        return false;
    }
    let marcador = format!("[id:{}]", huella.to_ascii_lowercase());
    observacion.to_ascii_lowercase().contains(&marcador)
}

/// Devuelve la consulta SQL parametrizada de lectura del padron de sucursal.
///
/// Antes de ejecutar esta consulta sobre la conexion se debe aplicar `CONFIG_SESSION_GROUP_CONCAT`.
pub fn consulta_padron_sucursal(incluir_ocultos: bool) -> &'static str {
    if incluir_ocultos {
        CONSULTA_PADRON_COMPLETO
    } else {
        CONSULTA_PADRON_ACTIVOS
    }
}

/// Construye y valida un lote de ajuste exigiendo sesion local activa en Plex y cantidades finitas positivas.
pub fn construir_lote_ajuste(
    sucursal_id: SucursalId,
    id_idempotencia: &str,
    renglones: &[RenglonAjusteLocal],
    estado_terminal: &EstadoTerminalLocal,
) -> Result<LoteAjusteLocal, ErrorNucleo> {
    if !estado_terminal.sesion_iniciada {
        return Err(ErrorNucleo::NoAutorizado);
    }

    let id_limpio = id_idempotencia.trim();
    let huella = extraer_huella_idempotencia(id_limpio);
    if id_limpio.is_empty() || huella.is_empty() || renglones.is_empty() {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut bajas = Vec::new();
    let mut altas = Vec::new();

    for renglon in renglones {
        if !renglon.cantidad.is_finite() || renglon.cantidad <= 0.0 {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        let producto_limpio = renglon
            .producto_id
            .as_deref()
            .map(str::trim)
            .filter(|valor| !valor.is_empty())
            .map(str::to_owned);
        let codigo_limpio = renglon.codigo.trim().to_owned();

        if producto_limpio.is_none() && codigo_limpio.is_empty() {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        let normalizado = RenglonAjusteLocal {
            producto_id: producto_limpio,
            codigo: codigo_limpio,
            cantidad: renglon.cantidad,
            motivo: renglon.motivo,
        };

        match normalizado.motivo {
            MotivoAjusteLocal::BajaFaltante => bajas.push(normalizado),
            MotivoAjusteLocal::AltaSobrante => altas.push(normalizado),
        }
    }

    Ok(LoteAjusteLocal {
        sucursal_id,
        id_idempotencia: id_limpio.to_owned(),
        huella_idempotencia: huella,
        observacion: estampar_observacion_idempotente(MOTIVO_BASE_CICLICO, id_limpio),
        operador: estado_terminal.operador.clone(),
        terminal: estado_terminal.terminal.clone(),
        bajas,
        altas,
    })
}

fn construir_opciones_mysql(config: &ConfiguracionMysql, anfitrion: &str) -> OptsBuilder {
    let espera_ms = config.tiempo_espera_ms.max(5_000);
    let mut builder = OptsBuilder::new()
        .ip_or_hostname(Some(anfitrion))
        .tcp_port(config.puerto)
        .user(Some(config.usuario.as_str()))
        .db_name(if config.base_datos.trim().is_empty() {
            None
        } else {
            Some(config.base_datos.as_str())
        })
        .tcp_connect_timeout(Some(Duration::from_millis(espera_ms)))
        .read_timeout(Some(Duration::from_secs(45)))
        .write_timeout(Some(Duration::from_secs(15)));

    if let Some(cred) = config.credencial.as_deref() {
        if !cred.trim().is_empty() {
            builder = builder.pass(Some(cred));
        }
    }

    builder
}

fn clasificar_error_mysql(err: &mysql::Error) -> (ErrorNucleo, bool) {
    match err {
        mysql::Error::MySqlError(detalle) => match detalle.code {
            1044 | 1045 | 1130 => (ErrorNucleo::NoAutorizado, true),
            1049 => (ErrorNucleo::SinConexion, true),
            _ => (ErrorNucleo::SinConexion, false),
        },
        _ => (ErrorNucleo::SinConexion, false),
    }
}

/// Abre una conexion MySQL hacia la sucursal usando unicamente el fallback local `localhost <-> 127.0.0.1`.
pub fn conectar_mysql_sucursal(
    config: &ConfiguracionMysql,
) -> Result<(PooledConn, String), ErrorNucleo> {
    let candidatos = candidatos_anfitrion(&config.anfitrion);
    if candidatos.is_empty() {
        return Err(ErrorNucleo::SinConexion);
    }

    let mut ultimo_error = ErrorNucleo::SinConexion;
    const MAX_REINTENTOS: usize = 2;

    for anfitrion in candidatos {
        let opciones = construir_opciones_mysql(config, &anfitrion);
        let pool = match Pool::new(opciones) {
            Ok(p) => p,
            Err(err) => {
                let (mapeado, _) = clasificar_error_mysql(&err);
                ultimo_error = mapeado;
                continue;
            }
        };

        for intento in 0..=MAX_REINTENTOS {
            if intento > 0 {
                std::thread::sleep(Duration::from_millis(250 * intento as u64));
            }
            match pool.get_conn() {
                Ok(conn) => return Ok((conn, anfitrion)),
                Err(err) => {
                    let (mapeado, fatal) = clasificar_error_mysql(&err);
                    ultimo_error = mapeado;
                    if fatal {
                        break;
                    }
                }
            }
        }
    }

    Err(ultimo_error)
}

/// Descarga el padron de productos desde MySQL de sucursal aplicando `group_concat_max_len = 65535`.
pub fn cargar_padron_desde_mysql(
    config: &ConfiguracionMysql,
    sucursal_id: SucursalId,
    incluir_ocultos: bool,
    actualizado_en: &str,
) -> Result<Vec<ArticuloPadron>, ErrorNucleo> {
    let (mut conn, _) = conectar_mysql_sucursal(config)?;
    conn.query_drop(CONFIG_SESSION_GROUP_CONCAT)
        .map_err(|_| ErrorNucleo::SinConexion)?;

    let consulta = consulta_padron_sucursal(incluir_ocultos);
    let resultado = conn
        .query_iter(consulta)
        .map_err(|_| ErrorNucleo::SinConexion)?;

    let mut articulos = Vec::new();
    for fila_res in resultado {
        let fila = fila_res.map_err(|_| ErrorNucleo::SinConexion)?;
        if let Some(articulo) = mapear_fila_padron(&fila, sucursal_id, actualizado_en) {
            articulos.push(articulo);
        }
    }

    Ok(articulos)
}

/// Descarga en solo lectura los envios interfarmacias y sus lineas desde `onze_center` a partir de `desde_fecha` (`YYYY-MM-DD`).
pub fn cargar_interfarmacias_desde_mysql(
    config: &ConfiguracionMysql,
    desde_fecha: &str,
) -> Result<ResultadoInterfarmaciasMysql, ErrorNucleo> {
    let (mut conn, _) = conectar_mysql_sucursal(config)?;
    let _ = conn.query_drop("SET NAMES utf8mb4");

    let sql_envios = "\
        SELECT \
            e.IDEnvio AS id_envio, \
            e.IDEnvioGlobal AS id_envio_global, \
            TRIM(CONCAT(IFNULL(DATE_FORMAT(e.FechaEnvio, '%Y-%m-%d'), ''), ' ', IFNULL(TIME_FORMAT(e.HoraEnvio, '%H:%i'), '00:00'))) AS fecha_envio, \
            CASE WHEN e.FechaRecepcion IS NULL THEN '' ELSE TRIM(CONCAT(DATE_FORMAT(e.FechaRecepcion, '%Y-%m-%d'), ' ', IFNULL(TIME_FORMAT(e.HoraRecepcion, '%H:%i'), '00:00'))) END AS fecha_recepcion, \
            IFNULL(e.Descripcion, '') AS descripcion, \
            IFNULL(e.SucOrigen, 0) AS suc_origen, \
            IFNULL(so.NombreFantasia, '') AS origen_nombre, \
            IFNULL(e.SucDestino, 0) AS suc_destino, \
            IFNULL(sd.NombreFantasia, '') AS destino_nombre, \
            IFNULL(e.IDEstado, 9) AS id_estado, \
            IFNULL(oe.Operador, '') AS operador_envio, \
            IFNULL(orx.Operador, '') AS operador_recepcion \
        FROM envios e \
        LEFT JOIN sucursales so ON so.Sucursal = e.SucOrigen \
        LEFT JOIN sucursales sd ON sd.Sucursal = e.SucDestino \
        LEFT JOIN operadores oe ON oe.IDOperador = e.IDOperador \
        LEFT JOIN operadores orx ON orx.IDOperador = e.IDOperadorRecepcion \
        WHERE e.FechaEnvio >= ? \
        ORDER BY e.FechaEnvio DESC, e.IDEnvio DESC";

    let filas_envios: Vec<Row> = conn
        .exec(sql_envios, (desde_fecha,))
        .map_err(|_| ErrorNucleo::SinConexion)?;

    let mut envios = Vec::with_capacity(filas_envios.len());
    for fila in &filas_envios {
        let id_envio_global = leer_texto(fila, "id_envio_global").parse::<u64>().unwrap_or(0);
        if id_envio_global == 0 {
            continue;
        }
        envios.push(EnvioInterfarmaciaCrudo {
            id_envio: leer_texto(fila, "id_envio").parse::<u64>().unwrap_or(0),
            id_envio_global,
            fecha_envio: leer_texto(fila, "fecha_envio"),
            fecha_recepcion: leer_texto_opcional(fila, "fecha_recepcion"),
            descripcion: leer_texto(fila, "descripcion"),
            suc_origen: leer_texto(fila, "suc_origen").parse::<i32>().unwrap_or(0),
            origen_nombre: leer_texto(fila, "origen_nombre"),
            suc_destino: leer_texto(fila, "suc_destino").parse::<i32>().unwrap_or(0),
            destino_nombre: leer_texto(fila, "destino_nombre"),
            id_estado: leer_texto(fila, "id_estado").parse::<i32>().unwrap_or(9),
            operador_envio: leer_texto(fila, "operador_envio"),
            operador_recepcion: leer_texto_opcional(fila, "operador_recepcion"),
        });
    }

    let sql_lineas = "\
        SELECT \
            e.IDEnvioGlobal AS id_envio_global, \
            IFNULL(el.Orden, 0) AS orden, \
            IFNULL(el.IDProducto, 0) AS id_producto, \
            IFNULL(m.codebar, '') AS ean, \
            TRIM(CONCAT(IFNULL(m.Producto, ''), ' ', IFNULL(m.Presentaci, ''))) AS producto, \
            IFNULL(l.Laborato, '') AS laboratorio, \
            IFNULL(r.Rubro, '') AS rubro, \
            IFNULL(el.Cantidad, 0) AS cant_env, \
            el.CantidadRecibida AS cant_rec, \
            IFNULL(el.CostoPPP, 0) AS costo_ppp, \
            IFNULL(el.LoteVto, '') AS lote_vto, \
            IFNULL(DATE_FORMAT(el.LoteFechaVto, '%Y-%m-%d'), '') AS lote_fecha_vto \
        FROM envioslineas el \
        JOIN envios e ON e.IDEnvio = el.IDEnvio \
        LEFT JOIN medicamentos m ON m.CodPlex = el.IDProducto \
        LEFT JOIN laboratorios l ON l.CodLab = m.CodLab \
        LEFT JOIN rubros r ON r.CodRubro = m.CodRubro \
        WHERE e.FechaEnvio >= ? \
        ORDER BY e.IDEnvioGlobal, el.Orden";

    let filas_lineas: Vec<Row> = conn
        .exec(sql_lineas, (desde_fecha,))
        .map_err(|_| ErrorNucleo::SinConexion)?;

    let mut lineas = Vec::with_capacity(filas_lineas.len());
    for fila in &filas_lineas {
        let id_envio_global = leer_texto(fila, "id_envio_global").parse::<u64>().unwrap_or(0);
        if id_envio_global == 0 {
            continue;
        }
        let cant_rec = match fila.get_opt::<Value, _>("cant_rec") {
            Some(Ok(Value::NULL)) | None => None,
            _ => Some(leer_decimal(fila, "cant_rec")),
        };
        lineas.push(LineaInterfarmaciaCruda {
            id_envio_global,
            orden: leer_texto(fila, "orden").parse::<i32>().unwrap_or(0),
            id_producto: leer_texto(fila, "id_producto").parse::<u64>().unwrap_or(0),
            ean: leer_texto(fila, "ean"),
            producto: leer_texto(fila, "producto"),
            laboratorio: leer_texto(fila, "laboratorio"),
            rubro: leer_texto(fila, "rubro"),
            cantidad_enviada: leer_decimal(fila, "cant_env"),
            cantidad_recibida: cant_rec,
            costo_ppp: leer_decimal(fila, "costo_ppp"),
            lote_vto: leer_texto_opcional(fila, "lote_vto"),
            lote_fecha_vto: leer_texto_opcional(fila, "lote_fecha_vto"),
        });
    }

    Ok(ResultadoInterfarmaciasMysql { envios, lineas })
}

/// Impacta el lote de ajuste sobre las 5 tablas de Plex verificando idempotencia previa por huella.
pub fn ejecutar_lote_ajuste_mysql(
    config: &ConfiguracionMysql,
    operador_id: i64,
    operador_nombre: &str,
    lote: &LoteAjusteLocal,
) -> Result<ResultadoAjusteLocal, ErrorNucleo> {
    let (mut conn, anfitrion_conectado) = conectar_mysql_sucursal(config)?;

    let patron_huella = format!("%[ID:{}]%", lote.huella_idempotencia);
    let previas: Vec<(u64, Option<u64>, u8, String)> = conn
        .exec(
            "SELECT IDOperacion, IDGlobal, idMotivoOpStock, IFNULL(Observacion, '') \
             FROM stock_operaciones \
             WHERE Observacion LIKE ? \
             ORDER BY IDOperacion DESC \
             LIMIT 20",
            (&patron_huella,),
        )
        .map_err(|_| ErrorNucleo::SinConexion)?;

    let mut id_op_baja = None;
    let mut id_glob_baja = None;
    let mut id_op_alta = None;
    let mut id_glob_alta = None;
    let mut ya_existia = false;

    for (op_id, global_opt, motivo_num, observacion) in previas {
        if !contiene_huella_idempotencia(&observacion, &lote.id_idempotencia) {
            continue;
        }
        let global_resuelto =
            global_opt.unwrap_or_else(|| calcular_id_global(lote.sucursal_id, op_id));
        if motivo_num == MotivoAjusteLocal::BajaFaltante.codigo_plex() && id_op_baja.is_none() {
            id_op_baja = Some(op_id);
            id_glob_baja = Some(global_resuelto);
            ya_existia = true;
        } else if motivo_num == MotivoAjusteLocal::AltaSobrante.codigo_plex()
            && id_op_alta.is_none()
        {
            id_op_alta = Some(op_id);
            id_glob_alta = Some(global_resuelto);
            ya_existia = true;
        }
    }

    if !lote.bajas.is_empty() && id_op_baja.is_none() {
        let (op_id, glob_id) = aplicar_grupo_ajuste_mysql(
            &mut conn,
            lote.sucursal_id,
            operador_id,
            operador_nombre,
            MotivoAjusteLocal::BajaFaltante,
            &lote.observacion,
            &lote.bajas,
        )?;
        id_op_baja = Some(op_id);
        id_glob_baja = Some(glob_id);
    }

    if !lote.altas.is_empty() && id_op_alta.is_none() {
        let (op_id, glob_id) = aplicar_grupo_ajuste_mysql(
            &mut conn,
            lote.sucursal_id,
            operador_id,
            operador_nombre,
            MotivoAjusteLocal::AltaSobrante,
            &lote.observacion,
            &lote.altas,
        )?;
        id_op_alta = Some(op_id);
        id_glob_alta = Some(glob_id);
    }

    Ok(ResultadoAjusteLocal {
        id_operacion_baja: id_op_baja,
        id_operacion_alta: id_op_alta,
        id_global_baja: id_glob_baja,
        id_global_alta: id_glob_alta,
        total_bajas: lote.bajas.len(),
        total_altas: lote.altas.len(),
        anfitrion_conectado,
        ya_existia_idempotente: ya_existia,
    })
}

/// Parsea el arreglo JSON opcional de `producto_id` suspendidos y filtra entradas vacias.
pub fn parsear_productos_suspendidos(json: Option<&str>) -> Result<Vec<String>, ErrorNucleo> {
    let Some(crudo) = json else {
        return Ok(Vec::new());
    };
    let limpio = crudo.trim();
    if limpio.is_empty() {
        return Ok(Vec::new());
    }
    if !limpio.starts_with('[') || !limpio.ends_with(']') {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let interior = limpio[1..limpio.len() - 1].trim();
    if interior.is_empty() {
        return Ok(Vec::new());
    }

    let mut productos = Vec::new();
    let bytes = interior.as_bytes();
    let mut pos = 0;

    loop {
        while pos < bytes.len() && bytes[pos].is_ascii_whitespace() {
            pos += 1;
        }
        if pos >= bytes.len() || bytes[pos] != b'"' {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        let (valor, siguiente) = parsear_cadena_json(&interior[pos..])?;
        pos += siguiente;

        let valor_limpio = valor.trim();
        if !valor_limpio.is_empty() {
            productos.push(valor_limpio.to_owned());
        }

        while pos < bytes.len() && bytes[pos].is_ascii_whitespace() {
            pos += 1;
        }
        if pos >= bytes.len() {
            break;
        }
        if bytes[pos] != b',' {
            return Err(ErrorNucleo::IntegridadInvalida);
        }
        pos += 1;
    }

    Ok(productos)
}

fn parsear_cadena_json(entrada: &str) -> Result<(String, usize), ErrorNucleo> {
    let mut chars = entrada.char_indices();
    let Some((_, '"')) = chars.next() else {
        return Err(ErrorNucleo::IntegridadInvalida);
    };

    let mut salida = String::new();
    while let Some((idx, ch)) = chars.next() {
        match ch {
            '"' => return Ok((salida, idx + 1)),
            '\\' => {
                let Some((_, esc)) = chars.next() else {
                    return Err(ErrorNucleo::IntegridadInvalida);
                };
                match esc {
                    '"' => salida.push('"'),
                    '\\' => salida.push('\\'),
                    '/' => salida.push('/'),
                    'b' => salida.push('\u{0008}'),
                    'f' => salida.push('\u{000C}'),
                    'n' => salida.push('\n'),
                    'r' => salida.push('\r'),
                    't' => salida.push('\t'),
                    'u' => {
                        let mut hex = String::with_capacity(4);
                        for _ in 0..4 {
                            let Some((_, h)) = chars.next() else {
                                return Err(ErrorNucleo::IntegridadInvalida);
                            };
                            hex.push(h);
                        }
                        let codigo = u32::from_str_radix(&hex, 16)
                            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
                        let decodificado =
                            char::from_u32(codigo).ok_or(ErrorNucleo::IntegridadInvalida)?;
                        salida.push(decodificado);
                    }
                    _ => return Err(ErrorNucleo::IntegridadInvalida),
                }
            }
            c if c.is_control() => return Err(ErrorNucleo::IntegridadInvalida),
            c => salida.push(c),
        }
    }

    Err(ErrorNucleo::IntegridadInvalida)
}

/// Restaura `trazable = 1` en MySQL para los productos suspendidos durante un ajuste interrumpido.
pub fn restaurar_trazables_mysql(
    conn: &mut mysql::Conn,
    producto_ids: &[String],
) -> Result<usize, ErrorNucleo> {
    let mut restaurados = 0usize;
    for producto_id in producto_ids {
        let id_limpio = producto_id.trim();
        if id_limpio.is_empty() {
            continue;
        }
        conn.exec_drop(
            "UPDATE productos SET trazable = 1 WHERE IDProducto = ?",
            (id_limpio,),
        )
        .map_err(|_| ErrorNucleo::SinConexion)?;
        let afectadas = usize::try_from(conn.affected_rows()).unwrap_or(usize::MAX);
        restaurados = restaurados.saturating_add(afectadas);
    }
    Ok(restaurados)
}

/// Consulta en MySQL si ya existe una operacion estampada con la huella `[ID:<id_idempotencia>]`.
pub fn verificar_ajuste_aplicado_mysql(
    conn: &mut mysql::Conn,
    id_idempotencia: &str,
) -> Result<Option<u64>, ErrorNucleo> {
    let huella = extraer_huella_idempotencia(id_idempotencia);
    if huella.is_empty() {
        return Err(ErrorNucleo::IntegridadInvalida);
    }
    let patron = format!("%[ID:{}]%", huella);
    let id_operacion: Option<u64> = conn
        .exec_first(
            "SELECT IDOperacion FROM stock_operaciones WHERE Observacion LIKE ? LIMIT 1",
            (&patron,),
        )
        .map_err(|_| ErrorNucleo::SinConexion)?;
    Ok(id_operacion)
}

fn aplicar_grupo_ajuste_mysql(
    conn: &mut PooledConn,
    sucursal_id: SucursalId,
    operador_id: i64,
    operador_nombre: &str,
    motivo: MotivoAjusteLocal,
    observacion: &str,
    renglones: &[RenglonAjusteLocal],
) -> Result<(u64, u64), ErrorNucleo> {
    let mut tx = conn
        .start_transaction(TxOpts::default())
        .map_err(|_| ErrorNucleo::SinConexion)?;

    // 1. Cabecera en `stock_operaciones` y estampado de `IDGlobal`.
    tx.exec_drop(
        "INSERT INTO stock_operaciones (FechaHora, IdUsuario, idMotivoOpStock, Observacion) \
         VALUES (NOW(), ?, ?, ?)",
        (operador_id, motivo.codigo_plex(), observacion),
    )
    .map_err(|_| ErrorNucleo::SinConexion)?;

    let id_operacion = tx.last_insert_id().ok_or(ErrorNucleo::SinConexion)?;
    let id_global = calcular_id_global(sucursal_id, id_operacion);

    tx.exec_drop(
        "UPDATE stock_operaciones SET IDGlobal = ? WHERE IDOperacion = ?",
        (id_global, id_operacion),
    )
    .map_err(|_| ErrorNucleo::SinConexion)?;

    let sesion_log = format!("usr={};dll=Stock;ver=12.4.2.1", operador_nombre.trim());

    for renglon in renglones {
        let producto_row: Option<(i64, f64, f64, f64)> = if let Some(pid_num) = renglon
            .producto_id
            .as_deref()
            .and_then(|s| s.trim().parse::<i64>().ok())
        {
            tx.exec_first(
                "SELECT IDProducto, IFNULL(Costo, 0), IFNULL(UltimoCosto, 0), IFNULL(UltimoPrecio, 0) \
                 FROM productos WHERE IDProducto = ? LIMIT 1",
                (pid_num,),
            )
            .map_err(|_| ErrorNucleo::SinConexion)?
        } else {
            tx.exec_first(
                "SELECT IDProducto, IFNULL(Costo, 0), IFNULL(UltimoCosto, 0), IFNULL(UltimoPrecio, 0) \
                 FROM productos WHERE Codebar = ? LIMIT 1",
                (&renglon.codigo,),
            )
            .map_err(|_| ErrorNucleo::SinConexion)?
        };

        let Some((prod_id, costo, ultimo_costo, precio)) = producto_row else {
            continue;
        };

        let magnitud = renglon.cantidad;
        let delta = match motivo {
            MotivoAjusteLocal::BajaFaltante => -magnitud,
            MotivoAjusteLocal::AltaSobrante => magnitud,
        };

        // 2. Detalle en `stock_operaciones_detalle`.
        tx.exec_drop(
            "INSERT INTO stock_operaciones_detalle \
             (IDOperacion, IDProducto, NroLote, FechaVencimiento, Serie, Cantidad, Unidades, UnidadesProducto, Costo, UltimoCosto, Precio) \
             VALUES (?, ?, '', NULL, '', ?, 0, 1, ?, ?, ?)",
            (id_operacion, prod_id, magnitud, costo, ultimo_costo, precio),
        )
        .map_err(|_| ErrorNucleo::SinConexion)?;

        // 3. Actualizacion transaccional en `stock`.
        let stock_actual: Option<f64> = tx
            .exec_first(
                "SELECT Cantidad FROM stock WHERE IDProducto = ? FOR UPDATE",
                (prod_id,),
            )
            .map_err(|_| ErrorNucleo::SinConexion)?;

        if stock_actual.is_some() {
            tx.exec_drop(
                "UPDATE stock SET Cantidad = Cantidad + ? WHERE IDProducto = ?",
                (delta, prod_id),
            )
            .map_err(|_| ErrorNucleo::SinConexion)?;
        } else {
            tx.exec_drop(
                "INSERT INTO stock (IDProducto, Cantidad, Unidades, Minimo, maximo, seguridad) \
                 VALUES (?, ?, 0, 0, 0, 0)",
                (prod_id, delta),
            )
            .map_err(|_| ErrorNucleo::SinConexion)?;
        }

        // 4. Registro de movimiento en `stockmovimientos`.
        tx.exec_drop(
            "INSERT INTO stockmovimientos \
             (IDProducto, IDUsuario, Fecha, Hora, TipoMovimiento, Cantidad, Unidades, Referencia, IDOperacionStock) \
             VALUES (?, ?, CURDATE(), CURTIME(), 'E', ?, 0, ?, ?)",
            (
                prod_id,
                operador_id,
                delta,
                motivo.referencia_movimiento(),
                id_operacion,
            ),
        )
        .map_err(|_| ErrorNucleo::SinConexion)?;

        // 5. Auditoria en `log_stock`.
        tx.exec_drop(
            "INSERT INTO log_stock (IDProducto, Cantidad, Unidades, Minimo, Log_Session, Log_Date, Log_Type) \
             VALUES (?, (SELECT Cantidad FROM stock WHERE IDProducto = ?), 0, 0, ?, NOW(), 'UPDATE')",
            (prod_id, prod_id, &sesion_log),
        )
        .map_err(|_| ErrorNucleo::SinConexion)?;
    }

    tx.commit().map_err(|_| ErrorNucleo::SinConexion)?;
    Ok((id_operacion, id_global))
}

fn mapear_fila_padron(
    fila: &Row,
    sucursal_id: SucursalId,
    actualizado_en: &str,
) -> Option<ArticuloPadron> {
    let id_producto = leer_texto(fila, "id_producto");
    let ean_principal = leer_texto(fila, "ean");
    if id_producto.is_empty() && ean_principal.is_empty() {
        return None;
    }

    let producto_id = if id_producto.is_empty() {
        ean_principal.clone()
    } else {
        id_producto
    };
    let ean_efectivo = if ean_principal.is_empty() {
        producto_id.clone()
    } else {
        ean_principal
    };

    let descripcion_cruda = leer_texto(fila, "producto");
    let descripcion = if descripcion_cruda.is_empty() {
        String::from("Sin Nombre")
    } else {
        descripcion_cruda
    };

    let troquel = leer_texto_opcional(fila, "troquel").filter(|t| t != "0");
    let existencia = leer_decimal(fila, "stock");
    let costo = leer_decimal(fila, "costo");
    let precio = leer_decimal(fila, "precio");

    let visible_txt = leer_texto(fila, "visible");
    let oculto = visible_txt == "0" || visible_txt.eq_ignore_ascii_case("false");

    let trazable_txt = leer_texto(fila, "trazable");
    let trazable = trazable_txt == "1" || trazable_txt.eq_ignore_ascii_case("true");

    let gtin = leer_texto_opcional(fila, "gtin").filter(|g| g != "0");
    let laboratorio = leer_texto_opcional(fila, "Laboratorio");
    let rubro = leer_texto_opcional(fila, "Rubro");
    let subrubro = leer_texto_opcional(fila, "SubRubro");
    let padre_id = leer_texto_opcional(fila, "id_producto_padre").filter(|p| p != "0");
    let unidades_raw = leer_decimal(fila, "unidades_padre");
    let unidades_padre = if unidades_raw.is_finite() && unidades_raw > 1.0 {
        unidades_raw.round() as i64
    } else {
        1
    };

    let mut codigos_barra = Vec::new();
    let mut vistos = HashSet::new();
    if vistos.insert(ean_efectivo.clone()) {
        codigos_barra.push(CodigoBarra {
            codigo: ean_efectivo,
            es_principal: true,
        });
    }

    let alternativos = leer_texto(fila, "CodigosBarraAlternativos");
    for parte in alternativos.split(',') {
        let limpio = parte.trim();
        if !limpio.is_empty() && vistos.insert(limpio.to_owned()) {
            codigos_barra.push(CodigoBarra {
                codigo: limpio.to_owned(),
                es_principal: false,
            });
        }
    }

    Some(ArticuloPadron {
        producto_id,
        sucursal_id,
        troquel,
        descripcion,
        laboratorio,
        rubro,
        subrubro,
        existencia,
        costo,
        precio,
        oculto,
        trazable,
        gtin,
        padre_id,
        unidades_padre,
        actualizado_en: actualizado_en.to_owned(),
        codigos_barra,
    })
}

fn leer_texto(fila: &Row, columna: &str) -> String {
    match fila.get_opt::<Value, _>(columna) {
        Some(Ok(Value::Bytes(bytes))) => String::from_utf8_lossy(&bytes).trim().to_owned(),
        Some(Ok(Value::Int(n))) => n.to_string(),
        Some(Ok(Value::UInt(n))) => n.to_string(),
        Some(Ok(Value::Float(f))) => f.to_string(),
        Some(Ok(Value::Double(d))) => d.to_string(),
        _ => String::new(),
    }
}

fn leer_texto_opcional(fila: &Row, columna: &str) -> Option<String> {
    let texto = leer_texto(fila, columna);
    if texto.is_empty() {
        None
    } else {
        Some(texto)
    }
}

fn leer_decimal(fila: &Row, columna: &str) -> f64 {
    match fila.get_opt::<Value, _>(columna) {
        Some(Ok(Value::Float(f))) => f64::from(f),
        Some(Ok(Value::Double(d))) => d,
        Some(Ok(Value::Int(n))) => n as f64,
        Some(Ok(Value::UInt(n))) => n as f64,
        Some(Ok(Value::Bytes(bytes))) => String::from_utf8_lossy(&bytes)
            .trim()
            .replace(',', ".")
            .parse::<f64>()
            .unwrap_or(0.0),
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sesion_activa() -> EstadoTerminalLocal {
        EstadoTerminalLocal {
            en_ejecucion: true,
            sesion_iniciada: true,
            operador: Some(String::from("GCOZ")),
            pantalla: Some(String::from("Plex 25 Activo")),
            pid: Some(4321),
            terminal: Some(String::from("168")),
        }
    }

    fn renglon_muestra(motivo: MotivoAjusteLocal, cantidad: f64) -> RenglonAjusteLocal {
        RenglonAjusteLocal {
            producto_id: Some(String::from("10500")),
            codigo: String::from("7790001000012"),
            cantidad,
            motivo,
        }
    }

    #[test]
    fn calcular_id_global_combina_sucursal_y_operacion() {
        assert_eq!(calcular_id_global(SucursalId(4), 125), 40_000_125);
        assert_eq!(calcular_id_global(SucursalId(17), 1), 170_000_001);
        assert_eq!(calcular_id_global(SucursalId(108), 999_999), 1_080_999_999);
    }

    #[test]
    fn estampar_y_verificar_huella_idempotencia() {
        let id_uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        let obs = estampar_observacion_idempotente("INVENTARIO CICLICO", id_uuid);
        assert_eq!(obs, "INVENTARIO CICLICO [ID:a1b2c3d4]");
        assert!(contiene_huella_idempotencia(&obs, id_uuid));
        assert!(contiene_huella_idempotencia(
            "INVENTARIO CICLICO [ID:A1B2C3D4]",
            id_uuid
        ));
        assert!(!contiene_huella_idempotencia(
            "INVENTARIO CICLICO [ID:ffffffff]",
            id_uuid
        ));
        assert!(!contiene_huella_idempotencia("INVENTARIO CICLICO", "---"));

        // Re-estampar la misma huella es idempotente y no duplica la etiqueta.
        assert_eq!(estampar_observacion_idempotente(&obs, id_uuid), obs);
    }

    #[test]
    fn consulta_padron_incluye_configuracion_y_padre_hijo() {
        assert_eq!(
            CONFIG_SESSION_GROUP_CONCAT,
            "SET SESSION group_concat_max_len = 65535;"
        );

        let activos = consulta_padron_sucursal(false);
        assert!(activos.contains("LEFT JOIN productos PP ON PP.IDProducto = P.IdProductoPadre"));
        assert!(activos.contains("GROUP_CONCAT(DISTINCT PC.codebar"));
        assert!(activos.contains("P.Activo = 'S'"));
        assert!(activos.contains("P.visible = 1"));

        let todos = consulta_padron_sucursal(true);
        assert!(todos.contains("LEFT JOIN productos PP ON PP.IDProducto = P.IdProductoPadre"));
        assert!(!todos.contains("P.visible = 1"));
    }

    #[test]
    fn construir_lote_ajuste_rechaza_terminal_bloqueada_o_sin_sesion() {
        let renglones = [renglon_muestra(MotivoAjusteLocal::BajaFaltante, 2.0)];

        let bloqueada = EstadoTerminalLocal {
            en_ejecucion: true,
            sesion_iniciada: false,
            operador: None,
            pantalla: Some(String::from("Pase su credencial por el lector...")),
            pid: Some(4321),
            terminal: Some(String::from("168")),
        };
        assert!(matches!(
            construir_lote_ajuste(
                SucursalId(17),
                "a1b2c3d4-1111-2222-3333-444455556666",
                &renglones,
                &bloqueada
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let apagada = EstadoTerminalLocal {
            en_ejecucion: false,
            sesion_iniciada: false,
            operador: None,
            pantalla: None,
            pid: None,
            terminal: None,
        };
        assert!(matches!(
            construir_lote_ajuste(
                SucursalId(17),
                "a1b2c3d4-1111-2222-3333-444455556666",
                &renglones,
                &apagada
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));
    }

    #[test]
    fn construir_lote_ajuste_valida_cantidades_finitas_y_separa_bajas_y_altas() {
        let sesion = sesion_activa();
        let id_idem = "9f8e7d6c-5555-4444-3333-222211110000";

        for invalida in [0.0, -1.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            let malos = [renglon_muestra(MotivoAjusteLocal::AltaSobrante, invalida)];
            assert!(matches!(
                construir_lote_ajuste(SucursalId(4), id_idem, &malos, &sesion),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
        }

        assert!(matches!(
            construir_lote_ajuste(SucursalId(4), id_idem, &[], &sesion),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let validos = [
            renglon_muestra(MotivoAjusteLocal::BajaFaltante, 3.0),
            RenglonAjusteLocal {
                producto_id: Some(String::from("20800")),
                codigo: String::from("7790001000099"),
                cantidad: 5.0,
                motivo: MotivoAjusteLocal::AltaSobrante,
            },
        ];

        let lote = construir_lote_ajuste(SucursalId(4), id_idem, &validos, &sesion)
            .expect("lote valido con sesion iniciada");
        assert_eq!(lote.sucursal_id, SucursalId(4));
        assert_eq!(lote.huella_idempotencia, "9f8e7d6c");
        assert_eq!(lote.observacion, "INVENTARIO CICLICO [ID:9f8e7d6c]");
        assert_eq!(lote.bajas.len(), 1);
        assert_eq!(lote.altas.len(), 1);
        assert_eq!(lote.total_renglones(), 2);
        assert_eq!(MotivoAjusteLocal::BajaFaltante.codigo_plex(), 1);
        assert_eq!(MotivoAjusteLocal::AltaSobrante.codigo_plex(), 9);
    }

    #[test]
    fn parsear_productos_suspendidos_filtra_vacios_y_rechaza_json_invalido() {
        assert_eq!(
            parsear_productos_suspendidos(None).expect("none"),
            Vec::<String>::new()
        );
        assert_eq!(
            parsear_productos_suspendidos(Some("  ")).expect("vacio"),
            Vec::<String>::new()
        );
        assert_eq!(
            parsear_productos_suspendidos(Some("[]")).expect("arreglo vacio"),
            Vec::<String>::new()
        );
        assert_eq!(
            parsear_productos_suspendidos(Some(r#"["10500", "", "  ", "20800"]"#))
                .expect("lista valida"),
            vec![String::from("10500"), String::from("20800")]
        );

        for invalido in ["{}", r#"["10500", 123]"#, r#"["10500""#, r#"["10500",]"#] {
            assert!(matches!(
                parsear_productos_suspendidos(Some(invalido)),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
        }
    }
}

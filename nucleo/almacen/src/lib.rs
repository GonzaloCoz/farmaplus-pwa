use std::collections::hash_map::RandomState;
use std::hash::BuildHasher;
use std::path::Path;

use comun::{ErrorNucleo, SucursalId};
use rusqlite::{params, Connection, OptionalExtension, Row, TransactionBehavior};
use serde::{Deserialize, Serialize};

macro_rules! consulta_articulo {
    ($columna:literal) => {
        concat!(
            "SELECT producto_id, sucursal_id, troquel, descripcion, laboratorio, rubro, subrubro,
                    existencia, costo, precio, oculto, trazable, gtin, padre_id, unidades_padre, actualizado_en
             FROM articulos WHERE ",
            $columna,
            " = ?1 LIMIT 1"
        )
    };
}

const HASH_GENESIS: &str = "GENESIS";

/// Codigo de barra asociado a un articulo del padron local.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CodigoBarra {
    pub codigo: String,
    pub es_principal: bool,
}

/// Articulo del padron de farmacia junto con todos sus codigos de barra asociados.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ArticuloPadron {
    pub producto_id: String,
    pub sucursal_id: SucursalId,
    pub troquel: Option<String>,
    pub descripcion: String,
    pub laboratorio: Option<String>,
    pub rubro: Option<String>,
    pub subrubro: Option<String>,
    pub existencia: f64,
    pub costo: f64,
    pub precio: f64,
    pub oculto: bool,
    pub trazable: bool,
    pub gtin: Option<String>,
    pub padre_id: Option<String>,
    pub unidades_padre: i64,
    pub actualizado_en: String,
    pub codigos_barra: Vec<CodigoBarra>,
}

/// Lectura capturada desde colector movil o mostrador para inventario ciclico.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LecturaColector {
    pub id: String,
    pub sesion_id: String,
    pub sucursal_id: SucursalId,
    pub codigo: String,
    pub producto_id: Option<String>,
    pub descripcion: String,
    pub cantidad: i64,
    pub ubicacion: String,
    pub terminal_id: String,
    pub creado_en: String,
}

/// Serie trazable ANMAT GS1 capturada durante una sesion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SerieTrazable {
    pub id: String,
    pub sesion_id: String,
    pub producto_id: String,
    pub gtin: String,
    pub serie: String,
    pub lote: Option<String>,
    pub vencimiento: Option<String>,
    pub sin_matriz: bool,
}

/// Registro previo de intencion para asegurar recuperacion ante cortes de energia.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistroIntencion {
    pub identificador_unico: String,
    pub sucursal_id: SucursalId,
    pub operacion: String,
    pub trazables_suspendidos: Option<String>,
    pub estado: String,
    pub creado_en: String,
}

/// Datos de entrada para registrar un cierre en el libro mayor y en la bandeja de salida.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DatosAsientoMayor {
    pub id: String,
    pub id_idempotencia: String,
    pub sucursal_id: SucursalId,
    pub laboratorio: String,
    pub ronda: i64,
    pub folio_remoto: Option<String>,
    pub operacion_baja_id: Option<String>,
    pub operacion_alta_id: Option<String>,
    pub diferencia_neta: f64,
    pub estado: String,
    pub destino_salida: String,
}

/// Asiento inmutable encadenado con BLAKE3 en el libro mayor local.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AsientoMayor {
    pub id: String,
    pub id_idempotencia: String,
    pub sucursal_id: SucursalId,
    pub laboratorio: String,
    pub ronda: i64,
    pub folio_remoto: Option<String>,
    pub operacion_baja_id: Option<String>,
    pub operacion_alta_id: Option<String>,
    pub diferencia_neta: f64,
    pub hash_previo: String,
    pub hash_actual: String,
    pub estado: String,
    pub creado_en: String,
}

/// Mensaje pendiente o en curso dentro de la bandeja de salida transaccional.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MensajeSalida {
    pub id: String,
    pub id_idempotencia: String,
    pub sucursal_id: SucursalId,
    pub destino: String,
    pub carga_json: String,
    pub estado: String,
    pub intentos: i64,
    pub proximo_intento_ms: i64,
    pub creado_en: String,
}

/// Almacen local unificado de sucursal sobre SQLite WAL.
pub struct AlmacenLocal {
    conexion: Connection,
}

impl AlmacenLocal {
    /// Abre o crea la base local en disco aplicando los PRAGMA estandar y recuperando envios interrumpidos.
    pub fn abrir(ruta: &Path) -> Result<Self, ErrorNucleo> {
        if let Some(directorio_padre) = ruta.parent() {
            if !directorio_padre.as_os_str().is_empty() {
                std::fs::create_dir_all(directorio_padre).map_err(|_| ErrorNucleo::AlmacenLocal)?;
            }
        }
        let conexion = Connection::open(ruta).map_err(mapear_error_sqlite)?;
        Self::inicializar(conexion)
    }

    /// Abre una base aislada en memoria para pruebas unitarias.
    pub fn abrir_en_memoria() -> Result<Self, ErrorNucleo> {
        let conexion = Connection::open_in_memory().map_err(mapear_error_sqlite)?;
        Self::inicializar(conexion)
    }

    fn inicializar(conexion: Connection) -> Result<Self, ErrorNucleo> {
        let pragmas = "
            PRAGMA busy_timeout = 5000;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA cache_size = -32000;
            PRAGMA temp_store = MEMORY;
        ";

        conexion
            .execute_batch(pragmas)
            .map_err(mapear_error_sqlite)?;
        conexion
            .execute_batch(include_str!("esquema.sql"))
            .map_err(mapear_error_sqlite)?;

        // Recupera filas interrumpidas en mitad de un envio previo al cierre de la aplicacion.
        conexion
            .execute(
                "UPDATE bandeja_salida SET estado = 'pendiente' WHERE estado = 'enviando'",
                [],
            )
            .map_err(mapear_error_sqlite)?;

        Ok(Self { conexion })
    }

    /// Importa o actualiza un lote de articulos y todos sus codigos de barra en una sola transaccion.
    pub fn importar_padron_lote(
        &mut self,
        articulos: &[ArticuloPadron],
    ) -> Result<usize, ErrorNucleo> {
        if articulos.is_empty() {
            return Ok(0);
        }

        let tx = self
            .conexion
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(mapear_error_sqlite)?;

        {
            let mut stmt_articulo = tx
                .prepare_cached(
                    "INSERT INTO articulos (
                        producto_id, sucursal_id, troquel, descripcion, laboratorio,
                        rubro, subrubro, existencia, costo, precio,
                        oculto, trazable, gtin, padre_id, unidades_padre, actualizado_en
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                    ON CONFLICT(producto_id) DO UPDATE SET
                        sucursal_id = excluded.sucursal_id,
                        troquel = excluded.troquel,
                        descripcion = excluded.descripcion,
                        laboratorio = excluded.laboratorio,
                        rubro = excluded.rubro,
                        subrubro = excluded.subrubro,
                        existencia = excluded.existencia,
                        costo = excluded.costo,
                        precio = excluded.precio,
                        oculto = excluded.oculto,
                        trazable = excluded.trazable,
                        gtin = excluded.gtin,
                        padre_id = excluded.padre_id,
                        unidades_padre = excluded.unidades_padre,
                        actualizado_en = excluded.actualizado_en",
                )
                .map_err(mapear_error_sqlite)?;

            let mut stmt_limpiar_codigos = tx
                .prepare_cached("DELETE FROM codigos_barra WHERE producto_id = ?1")
                .map_err(mapear_error_sqlite)?;

            let mut stmt_codigo = tx
                .prepare_cached(
                    "INSERT OR REPLACE INTO codigos_barra (codigo, producto_id, es_principal)
                     VALUES (?1, ?2, ?3)",
                )
                .map_err(mapear_error_sqlite)?;

            for articulo in articulos {
                stmt_articulo
                    .execute(params![
                        articulo.producto_id,
                        i64::from(articulo.sucursal_id.0),
                        articulo.troquel,
                        articulo.descripcion,
                        articulo.laboratorio,
                        articulo.rubro,
                        articulo.subrubro,
                        articulo.existencia,
                        articulo.costo,
                        articulo.precio,
                        i64::from(articulo.oculto),
                        i64::from(articulo.trazable),
                        articulo.gtin,
                        articulo.padre_id,
                        articulo.unidades_padre,
                        articulo.actualizado_en,
                    ])
                    .map_err(mapear_error_sqlite)?;

                stmt_limpiar_codigos
                    .execute(params![articulo.producto_id])
                    .map_err(mapear_error_sqlite)?;

                for barra in &articulo.codigos_barra {
                    stmt_codigo
                        .execute(params![
                            barra.codigo,
                            articulo.producto_id,
                            i64::from(barra.es_principal),
                        ])
                        .map_err(mapear_error_sqlite)?;
                }
            }
        }

        tx.commit().map_err(mapear_error_sqlite)?;
        Ok(articulos.len())
    }

    /// Busca un articulo primero en codigos_barra y luego por producto_id, troquel o gtin.
    pub fn buscar_por_codigo(&self, codigo: &str) -> Result<Option<ArticuloPadron>, ErrorNucleo> {
        if codigo.is_empty() {
            return Ok(None);
        }

        let producto_por_barra: Option<String> = self
            .conexion
            .prepare_cached(
                "SELECT producto_id
                 FROM codigos_barra
                 WHERE codigo = ?1
                 ORDER BY es_principal DESC, producto_id ASC
                 LIMIT 1",
            )
            .map_err(mapear_error_sqlite)?
            .query_row(params![codigo], |fila| fila.get(0))
            .optional()
            .map_err(mapear_error_sqlite)?;

        if let Some(producto_id) = producto_por_barra {
            if let Some(articulo) = self.cargar_articulo_por_id(&producto_id)? {
                return Ok(Some(articulo));
            }
        }

        const CONSULTAS_DIRECTAS: [&str; 3] = [
            consulta_articulo!("producto_id"),
            consulta_articulo!("troquel"),
            consulta_articulo!("gtin"),
        ];

        for sql in CONSULTAS_DIRECTAS {
            let encontrado = self
                .conexion
                .prepare_cached(sql)
                .map_err(mapear_error_sqlite)?
                .query_row(params![codigo], leer_fila_articulo)
                .optional()
                .map_err(mapear_error_sqlite)?;

            if let Some(mut articulo) = encontrado {
                articulo.codigos_barra = self.cargar_codigos_articulo(&articulo.producto_id)?;
                return Ok(Some(articulo));
            }
        }

        Ok(None)
    }

    fn cargar_articulo_por_id(
        &self,
        producto_id: &str,
    ) -> Result<Option<ArticuloPadron>, ErrorNucleo> {
        let encontrado = self
            .conexion
            .prepare_cached(consulta_articulo!("producto_id"))
            .map_err(mapear_error_sqlite)?
            .query_row(params![producto_id], leer_fila_articulo)
            .optional()
            .map_err(mapear_error_sqlite)?;

        match encontrado {
            Some(mut articulo) => {
                articulo.codigos_barra = self.cargar_codigos_articulo(&articulo.producto_id)?;
                Ok(Some(articulo))
            }
            None => Ok(None),
        }
    }

    fn cargar_codigos_articulo(&self, producto_id: &str) -> Result<Vec<CodigoBarra>, ErrorNucleo> {
        let mut stmt = self
            .conexion
            .prepare_cached(
                "SELECT codigo, es_principal
                 FROM codigos_barra
                 WHERE producto_id = ?1
                 ORDER BY es_principal DESC, codigo ASC",
            )
            .map_err(mapear_error_sqlite)?;

        let filas = stmt
            .query_map(params![producto_id], |fila| {
                let codigo: String = fila.get(0)?;
                let principal: i64 = fila.get(1)?;
                Ok(CodigoBarra {
                    codigo,
                    es_principal: principal != 0,
                })
            })
            .map_err(mapear_error_sqlite)?;

        filas
            .collect::<Result<Vec<_>, _>>()
            .map_err(mapear_error_sqlite)
    }

    /// Registra una lectura de colector en la base local.
    pub fn registrar_lectura_colector(
        &mut self,
        lectura: &LecturaColector,
    ) -> Result<(), ErrorNucleo> {
        self.conexion
            .prepare_cached(
                "INSERT INTO lecturas_colector (
                    id, sesion_id, sucursal_id, codigo, producto_id,
                    descripcion, cantidad, ubicacion, terminal_id, creado_en
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            )
            .map_err(mapear_error_sqlite)?
            .execute(params![
                lectura.id,
                lectura.sesion_id,
                i64::from(lectura.sucursal_id.0),
                lectura.codigo,
                lectura.producto_id,
                lectura.descripcion,
                lectura.cantidad,
                lectura.ubicacion,
                lectura.terminal_id,
                lectura.creado_en,
            ])
            .map_err(mapear_error_sqlite)?;
        Ok(())
    }

    /// Registra una serie trazable ANMAT evitando duplicados por sesion, gtin y serie.
    pub fn registrar_serie_trazable(&mut self, serie: &SerieTrazable) -> Result<(), ErrorNucleo> {
        self.conexion
            .prepare_cached(
                "INSERT INTO series_trazables (
                    id, sesion_id, producto_id, gtin, serie, lote, vencimiento, sin_matriz
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )
            .map_err(mapear_error_sqlite)?
            .execute(params![
                serie.id,
                serie.sesion_id,
                serie.producto_id,
                serie.gtin,
                serie.serie,
                serie.lote,
                serie.vencimiento,
                i64::from(serie.sin_matriz),
            ])
            .map_err(mapear_error_sqlite)?;
        Ok(())
    }

    /// Inserta o actualiza el registro de intencion previo a mutar el sistema externo local.
    pub fn guardar_intencion(&mut self, intencion: &RegistroIntencion) -> Result<(), ErrorNucleo> {
        self.conexion
            .prepare_cached(
                "INSERT INTO registro_intencion (
                    identificador_unico, sucursal_id, operacion, trazables_suspendidos, estado, creado_en
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(identificador_unico) DO UPDATE SET
                    trazables_suspendidos = excluded.trazables_suspendidos,
                    estado = excluded.estado",
            )
            .map_err(mapear_error_sqlite)?
            .execute(params![
                intencion.identificador_unico,
                i64::from(intencion.sucursal_id.0),
                intencion.operacion,
                intencion.trazables_suspendidos,
                intencion.estado,
                intencion.creado_en,
            ])
            .map_err(mapear_error_sqlite)?;
        Ok(())
    }

    /// Lista intenciones pendientes de la sucursal validando el arreglo JSON `trazables_suspendidos`.
    pub fn listar_intenciones_pendientes(
        &self,
        sucursal_id: SucursalId,
    ) -> Result<Vec<RegistroIntencion>, ErrorNucleo> {
        let mut consulta = self
            .conexion
            .prepare_cached(
                "SELECT identificador_unico, sucursal_id, operacion, trazables_suspendidos, estado, creado_en
                 FROM registro_intencion
                 WHERE sucursal_id = ?1 AND estado != 'completada'
                 ORDER BY creado_en ASC, rowid ASC",
            )
            .map_err(mapear_error_sqlite)?;

        let filas = consulta
            .query_map(params![i64::from(sucursal_id.0)], |fila| {
                let sucursal_raw: i64 = fila.get(1)?;
                let sucursal_u16 = u16::try_from(sucursal_raw).map_err(|err| {
                    rusqlite::Error::FromSqlConversionFailure(
                        1,
                        rusqlite::types::Type::Integer,
                        Box::new(err),
                    )
                })?;

                Ok(RegistroIntencion {
                    identificador_unico: fila.get(0)?,
                    sucursal_id: SucursalId(sucursal_u16),
                    operacion: fila.get(2)?,
                    trazables_suspendidos: fila.get(3)?,
                    estado: fila.get(4)?,
                    creado_en: fila.get(5)?,
                })
            })
            .map_err(mapear_error_sqlite)?;

        let mut pendientes = Vec::new();
        for fila in filas {
            let mut registro = fila.map_err(mapear_error_sqlite)?;
            if let Some(ref crudo) = registro.trazables_suspendidos {
                let limpio = crudo.trim();
                if limpio.is_empty() {
                    registro.trazables_suspendidos = None;
                } else {
                    let lista: Vec<String> =
                        serde_json::from_str(limpio).map_err(|_| ErrorNucleo::IntegridadInvalida)?;
                    let filtrados: Vec<String> = lista
                        .into_iter()
                        .map(|item| item.trim().to_owned())
                        .filter(|item| !item.is_empty())
                        .collect();
                    registro.trazables_suspendidos = if filtrados.is_empty() {
                        None
                    } else {
                        Some(
                            serde_json::to_string(&filtrados)
                                .map_err(|_| ErrorNucleo::IntegridadInvalida)?,
                        )
                    };
                }
            }
            pendientes.push(registro);
        }

        Ok(pendientes)
    }

    /// Actualiza el estado de una intencion registrada tras completar o resolver su recuperacion.
    pub fn marcar_intencion_resuelta(
        &mut self,
        identificador_unico: &str,
        estado: &str,
    ) -> Result<(), ErrorNucleo> {
        let id_limpio = identificador_unico.trim();
        let estado_limpio = estado.trim();
        if id_limpio.is_empty() || estado_limpio.is_empty() {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        let afectadas = self
            .conexion
            .prepare_cached(
                "UPDATE registro_intencion
                 SET estado = ?1
                 WHERE identificador_unico = ?2",
            )
            .map_err(mapear_error_sqlite)?
            .execute(params![estado_limpio, id_limpio])
            .map_err(mapear_error_sqlite)?;

        if afectadas == 0 {
            return Err(ErrorNucleo::AlmacenLocal);
        }

        Ok(())
    }

    /// Inserta atomicamente un asiento encadenado en libro_mayor y su mensaje en bandeja_salida.
    pub fn registrar_cierre_transaccional(
        &mut self,
        asiento: DatosAsientoMayor,
        carga_salida: &str,
        creado_en: &str,
    ) -> Result<AsientoMayor, ErrorNucleo> {
        if !asiento.diferencia_neta.is_finite() {
            return Err(ErrorNucleo::IntegridadInvalida);
        }
        let diferencia_neta = normalizar_cero(asiento.diferencia_neta);

        let tx = self
            .conexion
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(mapear_error_sqlite)?;

        let ultimo_hash: Option<String> = tx
            .prepare_cached("SELECT hash_actual FROM libro_mayor ORDER BY rowid DESC LIMIT 1")
            .map_err(mapear_error_sqlite)?
            .query_row([], |fila| fila.get(0))
            .optional()
            .map_err(mapear_error_sqlite)?;

        let hash_previo = ultimo_hash.unwrap_or_else(|| String::from(HASH_GENESIS));
        let hash_actual = calcular_hash_mayor(
            &hash_previo,
            &asiento.id_idempotencia,
            asiento.sucursal_id,
            &asiento.laboratorio,
            asiento.ronda,
            diferencia_neta,
        );

        tx.prepare_cached(
            "INSERT INTO libro_mayor (
                id, id_idempotencia, sucursal_id, laboratorio, ronda,
                folio_remoto, operacion_baja_id, operacion_alta_id,
                diferencia_neta, hash_previo, hash_actual, estado, creado_en
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        )
        .map_err(mapear_error_sqlite)?
        .execute(params![
            asiento.id,
            asiento.id_idempotencia,
            i64::from(asiento.sucursal_id.0),
            asiento.laboratorio,
            asiento.ronda,
            asiento.folio_remoto,
            asiento.operacion_baja_id,
            asiento.operacion_alta_id,
            diferencia_neta,
            hash_previo,
            hash_actual,
            asiento.estado,
            creado_en,
        ])
        .map_err(mapear_error_sqlite)?;

        let salida_id = format!("sal-{}", asiento.id);
        tx.prepare_cached(
            "INSERT INTO bandeja_salida (
                id, id_idempotencia, sucursal_id, destino, carga_json,
                estado, intentos, proximo_intento_ms, creado_en
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'pendiente', 0, 0, ?6)",
        )
        .map_err(mapear_error_sqlite)?
        .execute(params![
            salida_id,
            asiento.id_idempotencia,
            i64::from(asiento.sucursal_id.0),
            asiento.destino_salida,
            carga_salida,
            creado_en,
        ])
        .map_err(mapear_error_sqlite)?;

        tx.commit().map_err(mapear_error_sqlite)?;

        Ok(AsientoMayor {
            id: asiento.id,
            id_idempotencia: asiento.id_idempotencia,
            sucursal_id: asiento.sucursal_id,
            laboratorio: asiento.laboratorio,
            ronda: asiento.ronda,
            folio_remoto: asiento.folio_remoto,
            operacion_baja_id: asiento.operacion_baja_id,
            operacion_alta_id: asiento.operacion_alta_id,
            diferencia_neta,
            hash_previo,
            hash_actual,
            estado: asiento.estado,
            creado_en: creado_en.to_owned(),
        })
    }

    /// Recorre libro_mayor en orden de insercion verificando la integridad BLAKE3 de toda la cadena.
    pub fn verificar_cadena_mayor(&self) -> Result<bool, ErrorNucleo> {
        let mut stmt = self
            .conexion
            .prepare_cached(
                "SELECT id_idempotencia, sucursal_id, laboratorio, ronda, diferencia_neta, hash_previo, hash_actual
                 FROM libro_mayor
                 ORDER BY rowid ASC",
            )
            .map_err(mapear_error_sqlite)?;

        let mut filas = stmt.query([]).map_err(mapear_error_sqlite)?;
        let mut esperado_previo = String::from(HASH_GENESIS);

        while let Some(fila) = filas.next().map_err(mapear_error_sqlite)? {
            let id_idempotencia: String = fila.get(0).map_err(mapear_error_sqlite)?;
            let sucursal_raw: i64 = fila.get(1).map_err(mapear_error_sqlite)?;
            let laboratorio: String = fila.get(2).map_err(mapear_error_sqlite)?;
            let ronda: i64 = fila.get(3).map_err(mapear_error_sqlite)?;
            let diferencia_neta: f64 = fila.get(4).map_err(mapear_error_sqlite)?;
            let hash_previo: String = fila.get(5).map_err(mapear_error_sqlite)?;
            let hash_actual: String = fila.get(6).map_err(mapear_error_sqlite)?;

            if hash_previo != esperado_previo || !diferencia_neta.is_finite() {
                return Ok(false);
            }

            let Ok(sucursal_id) = sucursal_desde_i64(sucursal_raw) else {
                return Ok(false);
            };

            let hash_recalculado = calcular_hash_mayor(
                &esperado_previo,
                &id_idempotencia,
                sucursal_id,
                &laboratorio,
                ronda,
                normalizar_cero(diferencia_neta),
            );

            if hash_actual != hash_recalculado {
                return Ok(false);
            }

            esperado_previo = hash_actual;
        }

        Ok(true)
    }

    /// Reclama atomicamente un lote de mensajes pendientes habilitados a la fecha actual.
    pub fn reclamar_lote_salida(
        &mut self,
        limite: usize,
        ahora_ms: i64,
    ) -> Result<Vec<MensajeSalida>, ErrorNucleo> {
        if limite == 0 {
            return Ok(Vec::new());
        }

        let limite_sql = i64::try_from(limite).unwrap_or(i64::MAX);
        let tx = self
            .conexion
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(mapear_error_sqlite)?;

        let mut reclamados = {
            let mut stmt_sel = tx
                .prepare_cached(
                    "SELECT id, id_idempotencia, sucursal_id, destino, carga_json,
                            estado, intentos, proximo_intento_ms, creado_en
                     FROM bandeja_salida
                     WHERE estado = 'pendiente' AND proximo_intento_ms <= ?1
                     ORDER BY proximo_intento_ms ASC, rowid ASC
                     LIMIT ?2",
                )
                .map_err(mapear_error_sqlite)?;

            let filas = stmt_sel
                .query_map(params![ahora_ms, limite_sql], leer_fila_salida)
                .map_err(mapear_error_sqlite)?;

            let mut lista = Vec::new();
            for item in filas {
                lista.push(item.map_err(mapear_error_sqlite)?);
            }
            lista
        };

        {
            let mut stmt_upd = tx
                .prepare_cached("UPDATE bandeja_salida SET estado = 'enviando' WHERE id = ?1")
                .map_err(mapear_error_sqlite)?;

            for mensaje in &mut reclamados {
                stmt_upd
                    .execute(params![mensaje.id])
                    .map_err(mapear_error_sqlite)?;
                mensaje.estado = String::from("enviando");
            }
        }

        tx.commit().map_err(mapear_error_sqlite)?;
        Ok(reclamados)
    }

    /// Marca como enviados los mensajes de bandeja_salida cuyos identificadores fueron confirmados.
    pub fn confirmar_lote_enviado(&mut self, ids: &[String]) -> Result<(), ErrorNucleo> {
        if ids.is_empty() {
            return Ok(());
        }

        let tx = self
            .conexion
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(mapear_error_sqlite)?;

        {
            let mut stmt = tx
                .prepare_cached("UPDATE bandeja_salida SET estado = 'enviado' WHERE id = ?1")
                .map_err(mapear_error_sqlite)?;

            for id in ids {
                stmt.execute(params![id]).map_err(mapear_error_sqlite)?;
            }
        }

        tx.commit().map_err(mapear_error_sqlite)?;
        Ok(())
    }

    /// Devuelve mensajes fallidos a pendiente incrementando intentos y aplicando espera exponencial con desfasaje aleatorio.
    ///
    /// Retorna la demora aleatoria aplicada en milisegundos para cada mensaje (`[0, min(techo_ms, base_ms * 2^intento)]`).
    pub fn registrar_fallo_con_desfasaje(
        &mut self,
        ids: &[String],
        ahora_ms: i64,
        base_ms: i64,
        techo_ms: i64,
    ) -> Result<Vec<i64>, ErrorNucleo> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let tx = self
            .conexion
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(mapear_error_sqlite)?;

        let mut demoras = Vec::with_capacity(ids.len());

        {
            let mut stmt_sel = tx
                .prepare_cached("SELECT intentos FROM bandeja_salida WHERE id = ?1")
                .map_err(mapear_error_sqlite)?;

            let mut stmt_upd = tx
                .prepare_cached(
                    "UPDATE bandeja_salida
                     SET estado = 'pendiente', intentos = ?1, proximo_intento_ms = ?2
                     WHERE id = ?3",
                )
                .map_err(mapear_error_sqlite)?;

            for id in ids {
                let intentos_actuales: i64 = stmt_sel
                    .query_row(params![id], |fila| fila.get(0))
                    .optional()
                    .map_err(mapear_error_sqlite)?
                    .ok_or(ErrorNucleo::AlmacenLocal)?;

                let tope = calcular_tope_espera(base_ms, techo_ms, intentos_actuales);
                let demora_ms = generar_desfasaje(tope, id, ahora_ms, intentos_actuales);
                let proximo_intento_ms = ahora_ms.saturating_add(demora_ms);
                let siguiente_intento = intentos_actuales.saturating_add(1);

                stmt_upd
                    .execute(params![siguiente_intento, proximo_intento_ms, id])
                    .map_err(mapear_error_sqlite)?;

                demoras.push(demora_ms);
            }
        }

        tx.commit().map_err(mapear_error_sqlite)?;
        Ok(demoras)
    }

    /// Busca articulos del padron paginando con tope estricto de 500 resultados para cuidar memoria en UI.
    pub fn buscar_articulos_paginados(
        &self,
        filtro: &str,
        limite: usize,
    ) -> Result<Vec<ArticuloPadron>, ErrorNucleo> {
        if limite == 0 {
            return Ok(Vec::new());
        }

        let tope_sql = i64::try_from(limite.clamp(1, 500)).unwrap_or(500);
        let filtro_limpio = filtro.trim();

        let mut articulos = if filtro_limpio.is_empty() {
            let mut stmt = self
                .conexion
                .prepare_cached(
                    "SELECT producto_id, sucursal_id, troquel, descripcion, laboratorio, rubro, subrubro,
                            existencia, costo, precio, oculto, trazable, gtin, padre_id, unidades_padre, actualizado_en
                     FROM articulos
                     ORDER BY descripcion ASC, producto_id ASC
                     LIMIT ?1",
                )
                .map_err(mapear_error_sqlite)?;

            let filas = stmt
                .query_map(params![tope_sql], leer_fila_articulo)
                .map_err(mapear_error_sqlite)?;
            filas
                .collect::<Result<Vec<_>, _>>()
                .map_err(mapear_error_sqlite)?
        } else {
            let patron = format!("%{}%", escapar_like_sqlite(filtro_limpio));
            let mut stmt = self
                .conexion
                .prepare_cached(
                    "SELECT DISTINCT a.producto_id, a.sucursal_id, a.troquel, a.descripcion, a.laboratorio,
                            a.rubro, a.subrubro, a.existencia, a.costo, a.precio, a.oculto, a.trazable,
                            a.gtin, a.padre_id, a.unidades_padre, a.actualizado_en
                     FROM articulos a
                     LEFT JOIN codigos_barra cb ON cb.producto_id = a.producto_id
                     WHERE a.producto_id = ?1
                        OR a.troquel = ?1
                        OR a.gtin = ?1
                        OR cb.codigo = ?1
                        OR a.descripcion LIKE ?2 ESCAPE '\\'
                        OR IFNULL(a.laboratorio, '') LIKE ?2 ESCAPE '\\'
                        OR IFNULL(cb.codigo, '') LIKE ?2 ESCAPE '\\'
                     ORDER BY a.descripcion ASC, a.producto_id ASC
                     LIMIT ?3",
                )
                .map_err(mapear_error_sqlite)?;

            let filas = stmt
                .query_map(params![filtro_limpio, patron, tope_sql], leer_fila_articulo)
                .map_err(mapear_error_sqlite)?;
            filas
                .collect::<Result<Vec<_>, _>>()
                .map_err(mapear_error_sqlite)?
        };

        for articulo in &mut articulos {
            articulo.codigos_barra = self.cargar_codigos_articulo(&articulo.producto_id)?;
        }

        Ok(articulos)
    }

    /// Cuenta los mensajes pendientes en `bandeja_salida` sin reclamar ni mutar filas.
    pub fn contar_pendientes_salida(&self) -> Result<usize, ErrorNucleo> {
        let total: i64 = self
            .conexion
            .prepare_cached("SELECT COUNT(*) FROM bandeja_salida WHERE estado = 'pendiente'")
            .map_err(mapear_error_sqlite)?
            .query_row([], |fila| fila.get(0))
            .map_err(mapear_error_sqlite)?;
        usize::try_from(total.max(0)).map_err(|_| ErrorNucleo::AlmacenLocal)
    }

    /// Lista todas las lecturas de colector registradas para una sesion en orden de insercion.
    pub fn listar_lecturas_sesion(&self, sesion_id: &str) -> Result<Vec<LecturaColector>, ErrorNucleo> {
        let mut stmt = self
            .conexion
            .prepare_cached(
                "SELECT id, sesion_id, sucursal_id, codigo, producto_id,
                        descripcion, cantidad, ubicacion, terminal_id, creado_en
                 FROM lecturas_colector
                 WHERE sesion_id = ?1
                 ORDER BY rowid ASC",
            )
            .map_err(mapear_error_sqlite)?;

        let filas = stmt
            .query_map(params![sesion_id], leer_fila_lectura)
            .map_err(mapear_error_sqlite)?;
        filas
            .collect::<Result<Vec<_>, _>>()
            .map_err(mapear_error_sqlite)
    }

    /// Lista los asientos mas recientes del libro mayor para la sucursal indicada (tope 500).
    pub fn listar_asientos_mayor(
        &self,
        sucursal_id: SucursalId,
        limite: usize,
    ) -> Result<Vec<AsientoMayor>, ErrorNucleo> {
        if limite == 0 {
            return Ok(Vec::new());
        }

        let tope_sql = i64::try_from(limite.clamp(1, 500)).unwrap_or(500);
        let mut stmt = self
            .conexion
            .prepare_cached(
                "SELECT id, id_idempotencia, sucursal_id, laboratorio, ronda, folio_remoto,
                        operacion_baja_id, operacion_alta_id, diferencia_neta,
                        hash_previo, hash_actual, estado, creado_en
                 FROM libro_mayor
                 WHERE sucursal_id = ?1
                 ORDER BY rowid DESC
                 LIMIT ?2",
            )
            .map_err(mapear_error_sqlite)?;

        let filas = stmt
            .query_map(params![i64::from(sucursal_id.0), tope_sql], leer_fila_mayor)
            .map_err(mapear_error_sqlite)?;
        filas
            .collect::<Result<Vec<_>, _>>()
            .map_err(mapear_error_sqlite)
    }
}

fn escapar_like_sqlite(texto: &str) -> String {
    let mut salida = String::with_capacity(texto.len());
    for caracter in texto.chars() {
        match caracter {
            '\\' | '%' | '_' => {
                salida.push('\\');
                salida.push(caracter);
            }
            _ => salida.push(caracter),
        }
    }
    salida
}

fn leer_fila_lectura(fila: &Row<'_>) -> rusqlite::Result<LecturaColector> {
    let sucursal_raw: i64 = fila.get(2)?;
    let sucursal_u16 = u16::try_from(sucursal_raw).map_err(|err| {
        rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Integer, Box::new(err))
    })?;

    Ok(LecturaColector {
        id: fila.get(0)?,
        sesion_id: fila.get(1)?,
        sucursal_id: SucursalId(sucursal_u16),
        codigo: fila.get(3)?,
        producto_id: fila.get(4)?,
        descripcion: fila.get(5)?,
        cantidad: fila.get(6)?,
        ubicacion: fila.get(7)?,
        terminal_id: fila.get(8)?,
        creado_en: fila.get(9)?,
    })
}

fn leer_fila_mayor(fila: &Row<'_>) -> rusqlite::Result<AsientoMayor> {
    let sucursal_raw: i64 = fila.get(2)?;
    let sucursal_u16 = u16::try_from(sucursal_raw).map_err(|err| {
        rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Integer, Box::new(err))
    })?;

    Ok(AsientoMayor {
        id: fila.get(0)?,
        id_idempotencia: fila.get(1)?,
        sucursal_id: SucursalId(sucursal_u16),
        laboratorio: fila.get(3)?,
        ronda: fila.get(4)?,
        folio_remoto: fila.get(5)?,
        operacion_baja_id: fila.get(6)?,
        operacion_alta_id: fila.get(7)?,
        diferencia_neta: fila.get(8)?,
        hash_previo: fila.get(9)?,
        hash_actual: fila.get(10)?,
        estado: fila.get(11)?,
        creado_en: fila.get(12)?,
    })
}

fn leer_fila_articulo(fila: &Row<'_>) -> rusqlite::Result<ArticuloPadron> {
    let sucursal_raw: i64 = fila.get(1)?;
    let sucursal_u16 = u16::try_from(sucursal_raw).map_err(|err| {
        rusqlite::Error::FromSqlConversionFailure(1, rusqlite::types::Type::Integer, Box::new(err))
    })?;
    let oculto_raw: i64 = fila.get(10)?;
    let trazable_raw: i64 = fila.get(11)?;

    Ok(ArticuloPadron {
        producto_id: fila.get(0)?,
        sucursal_id: SucursalId(sucursal_u16),
        troquel: fila.get(2)?,
        descripcion: fila.get(3)?,
        laboratorio: fila.get(4)?,
        rubro: fila.get(5)?,
        subrubro: fila.get(6)?,
        existencia: fila.get(7)?,
        costo: fila.get(8)?,
        precio: fila.get(9)?,
        oculto: oculto_raw != 0,
        trazable: trazable_raw != 0,
        gtin: fila.get(12)?,
        padre_id: fila.get(13)?,
        unidades_padre: fila.get(14)?,
        actualizado_en: fila.get(15)?,
        codigos_barra: Vec::new(),
    })
}

fn leer_fila_salida(fila: &Row<'_>) -> rusqlite::Result<MensajeSalida> {
    let sucursal_raw: i64 = fila.get(2)?;
    let sucursal_u16 = u16::try_from(sucursal_raw).map_err(|err| {
        rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Integer, Box::new(err))
    })?;

    Ok(MensajeSalida {
        id: fila.get(0)?,
        id_idempotencia: fila.get(1)?,
        sucursal_id: SucursalId(sucursal_u16),
        destino: fila.get(3)?,
        carga_json: fila.get(4)?,
        estado: fila.get(5)?,
        intentos: fila.get(6)?,
        proximo_intento_ms: fila.get(7)?,
        creado_en: fila.get(8)?,
    })
}

fn sucursal_desde_i64(valor: i64) -> Result<SucursalId, ErrorNucleo> {
    u16::try_from(valor)
        .map(SucursalId)
        .map_err(|_| ErrorNucleo::AlmacenLocal)
}

fn mapear_error_sqlite(_err: rusqlite::Error) -> ErrorNucleo {
    ErrorNucleo::AlmacenLocal
}

fn normalizar_cero(valor: f64) -> f64 {
    if valor == 0.0 {
        0.0
    } else {
        valor
    }
}

/// Calcula el hash BLAKE3 hex de un asiento del libro mayor sobre la cadena canonica delimitada por '|'.
pub fn calcular_hash_mayor(
    hash_previo: &str,
    id_idempotencia: &str,
    sucursal_id: SucursalId,
    laboratorio: &str,
    ronda: i64,
    diferencia_neta: f64,
) -> String {
    let valor_normalizado = normalizar_cero(diferencia_neta);
    let mut hasher = blake3::Hasher::new();
    hasher.update(hash_previo.as_bytes());
    hasher.update(b"|");
    hasher.update(id_idempotencia.as_bytes());
    hasher.update(b"|");
    hasher.update(sucursal_id.0.to_string().as_bytes());
    hasher.update(b"|");
    hasher.update(laboratorio.as_bytes());
    hasher.update(b"|");
    hasher.update(ronda.to_string().as_bytes());
    hasher.update(b"|");
    hasher.update(valor_normalizado.to_bits().to_string().as_bytes());
    hasher.finalize().to_hex().to_string()
}

/// Calcula el limite superior acotado `min(techo_ms, base_ms * 2^intento)` sin desbordamientos.
pub fn calcular_tope_espera(base_ms: i64, techo_ms: i64, intento: i64) -> i64 {
    let base = base_ms.max(0);
    let techo = techo_ms.max(0);
    if base == 0 || techo == 0 {
        return 0;
    }
    let exponente = u32::try_from(intento.max(0)).unwrap_or(62).min(62);
    let multiplicador = 1_i64.checked_shl(exponente).unwrap_or(i64::MAX);
    base.saturating_mul(multiplicador).min(techo)
}

fn generar_desfasaje(tope_ms: i64, id: &str, ahora_ms: i64, intentos: i64) -> i64 {
    if tope_ms <= 0 {
        return 0;
    }
    let generador = RandomState::new();
    let entropia = generador.hash_one((id, ahora_ms, intentos));
    let modulo = (tope_ms as u64).saturating_add(1);
    (entropia % modulo) as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::Instant;

    static CONTADOR_PRUEBAS: AtomicU64 = AtomicU64::new(1);

    struct ArchivoPrueba {
        ruta: PathBuf,
    }

    impl ArchivoPrueba {
        fn crear(etiqueta: &str) -> Self {
            let dir = std::env::current_exe()
                .expect("ruta de ejecutable de prueba")
                .parent()
                .expect("directorio de deps")
                .to_path_buf();
            let seq = CONTADOR_PRUEBAS.fetch_add(1, Ordering::Relaxed);
            let pid = std::process::id();
            let ruta = dir.join(format!("prueba_{}_{}_{}.db", etiqueta, pid, seq));
            Self { ruta }
        }
    }

    impl Drop for ArchivoPrueba {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.ruta);
            let wal = PathBuf::from(format!("{}-wal", self.ruta.display()));
            let shm = PathBuf::from(format!("{}-shm", self.ruta.display()));
            let _ = std::fs::remove_file(wal);
            let _ = std::fs::remove_file(shm);
        }
    }

    fn articulo_muestra(indice: usize) -> ArticuloPadron {
        ArticuloPadron {
            producto_id: format!("PROD-{:05}", indice),
            sucursal_id: SucursalId(5),
            troquel: Some(format!("TRQ-{:05}", indice)),
            descripcion: format!("AMOXICILINA 500MG CAJA {}", indice),
            laboratorio: Some(String::from("ROEMMERS")),
            rubro: Some(String::from("MEDICAMENTOS")),
            subrubro: Some(String::from("ANTIBIOTICOS")),
            existencia: 12.0,
            costo: 1500.5,
            precio: 2990.0,
            oculto: false,
            trazable: indice % 2 == 0,
            gtin: Some(format!("07790001{:06}", indice)),
            padre_id: None,
            unidades_padre: 1,
            actualizado_en: String::from("2026-11-16T12:00:00Z"),
            codigos_barra: vec![
                CodigoBarra {
                    codigo: format!("7790001{:06}", indice),
                    es_principal: true,
                },
                CodigoBarra {
                    codigo: format!("ALT-{:05}", indice),
                    es_principal: false,
                },
            ],
        }
    }

    #[test]
    fn pragmas_perfil_estandar() {
        let archivo_estandar = ArchivoPrueba::crear("estandar");
        let almacen_estandar =
            AlmacenLocal::abrir(&archivo_estandar.ruta).expect("abrir estandar");
        let modo: String = almacen_estandar
            .conexion
            .query_row("PRAGMA journal_mode", [], |f| f.get(0))
            .expect("journal_mode");
        let cache_estandar: i64 = almacen_estandar
            .conexion
            .query_row("PRAGMA cache_size", [], |f| f.get(0))
            .expect("cache_size estandar");
        let tienda_estandar: i64 = almacen_estandar
            .conexion
            .query_row("PRAGMA temp_store", [], |f| f.get(0))
            .expect("temp_store estandar");
        assert_eq!(modo.to_lowercase(), "wal");
        assert_eq!(cache_estandar, -32000);
        assert_eq!(tienda_estandar, 2);
    }

    #[test]
    fn importar_padron_y_buscar_por_multiples_criterios_en_menos_de_un_ms() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir memoria");
        let lote: Vec<ArticuloPadron> = (0..2000).map(articulo_muestra).collect();
        let insertados = almacen.importar_padron_lote(&lote).expect("importar lote");
        assert_eq!(insertados, 2000);

        // Calienta el cache de sentencias preparadas antes de medir latencia de lectura.
        for codigo in ["ALT-01234", "TRQ-01999", "07790001000500", "PROD-00001"] {
            let _ = almacen.buscar_por_codigo(codigo).expect("calentamiento");
        }

        let consultas = [
            ("ALT-01234", "PROD-01234"),
            ("TRQ-01999", "PROD-01999"),
            ("07790001000500", "PROD-00500"),
            ("PROD-00001", "PROD-00001"),
        ];

        for (codigo, esperado) in consultas {
            let iteraciones = 50_u128;
            let inicio = Instant::now();
            for _ in 0..iteraciones {
                let hallado = almacen
                    .buscar_por_codigo(codigo)
                    .expect("buscar codigo")
                    .expect("articulo existente");
                assert_eq!(hallado.producto_id, esperado);
                assert_eq!(hallado.codigos_barra.len(), 2);
            }
            let promedio_us = inicio.elapsed().as_micros() / iteraciones;
            assert!(
                promedio_us < 1000,
                "la busqueda promedio de {} tardo {} us (>= 1 ms)",
                codigo,
                promedio_us
            );
        }

        assert!(almacen
            .buscar_por_codigo("INEXISTENTE-999")
            .expect("busqueda inexistente")
            .is_none());
    }

    #[test]
    fn libro_mayor_encadenado_detecta_alteracion_sql_directa() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir memoria");

        let primero = almacen
            .registrar_cierre_transaccional(
                DatosAsientoMayor {
                    id: String::from("asiento-1"),
                    id_idempotencia: String::from("01930000-0000-7000-8000-000000000001"),
                    sucursal_id: SucursalId(5),
                    laboratorio: String::from("BAGO"),
                    ronda: 1,
                    folio_remoto: Some(String::from("FOL-101")),
                    operacion_baja_id: Some(String::from("OPB-1")),
                    operacion_alta_id: None,
                    diferencia_neta: -1540.25,
                    estado: String::from("registrado"),
                    destino_salida: String::from("cierre_ciclico"),
                },
                r#"{"folio":"FOL-101"}"#,
                "2026-11-16T12:10:00Z",
            )
            .expect("primer cierre");

        let segundo = almacen
            .registrar_cierre_transaccional(
                DatosAsientoMayor {
                    id: String::from("asiento-2"),
                    id_idempotencia: String::from("01930000-0000-7000-8000-000000000002"),
                    sucursal_id: SucursalId(5),
                    laboratorio: String::from("ROEMMERS"),
                    ronda: 2,
                    folio_remoto: Some(String::from("FOL-102")),
                    operacion_baja_id: None,
                    operacion_alta_id: Some(String::from("OPA-2")),
                    diferencia_neta: 820.0,
                    estado: String::from("registrado"),
                    destino_salida: String::from("cierre_ciclico"),
                },
                r#"{"folio":"FOL-102"}"#,
                "2026-11-16T12:15:00Z",
            )
            .expect("segundo cierre");

        assert_eq!(primero.hash_previo, HASH_GENESIS);
        assert_eq!(segundo.hash_previo, primero.hash_actual);
        assert!(almacen
            .verificar_cadena_mayor()
            .expect("verificar cadena valida"));

        // Alteracion directa por SQL sobre la base local debe invalidar toda la verificacion.
        almacen
            .conexion
            .execute(
                "UPDATE libro_mayor SET diferencia_neta = 0.0 WHERE id = 'asiento-1'",
                [],
            )
            .expect("alteracion directa");

        assert!(!almacen
            .verificar_cadena_mayor()
            .expect("verificar cadena alterada"));
    }

    #[test]
    fn bandeja_salida_recupera_enviando_al_reabrir_y_aplica_desfasaje_acotado() {
        let archivo = ArchivoPrueba::crear("bandeja");
        let id_salida;

        {
            let mut almacen =
                AlmacenLocal::abrir(&archivo.ruta).expect("abrir disco");
            almacen
                .registrar_cierre_transaccional(
                    DatosAsientoMayor {
                        id: String::from("asiento-disco-1"),
                        id_idempotencia: String::from("01930000-0000-7000-8000-000000000010"),
                        sucursal_id: SucursalId(12),
                        laboratorio: String::from("BAYER"),
                        ronda: 1,
                        folio_remoto: None,
                        operacion_baja_id: None,
                        operacion_alta_id: None,
                        diferencia_neta: 0.0,
                        estado: String::from("registrado"),
                        destino_salida: String::from("cierre_ciclico"),
                    },
                    r#"{"sucursal":12}"#,
                    "2026-11-16T13:00:00Z",
                )
                .expect("registrar cierre");

            let lote = almacen
                .reclamar_lote_salida(10, 1_000)
                .expect("reclamar lote");
            assert_eq!(lote.len(), 1);
            assert_eq!(lote[0].estado, "enviando");
            id_salida = lote[0].id.clone();

            // Se simula caida de proceso dejando la fila en estado 'enviando'.
        }

        // Al reabrir debe pasar de 'enviando' a 'pendiente' automaticamente.
        let mut almacen_reabierto =
            AlmacenLocal::abrir(&archivo.ruta).expect("reabrir disco");
        let recuperados = almacen_reabierto
            .reclamar_lote_salida(10, 1_000)
            .expect("reclamar tras recuperacion");
        assert_eq!(recuperados.len(), 1);
        assert_eq!(recuperados[0].id, id_salida);
        assert_eq!(recuperados[0].estado, "enviando");

        // Falla con Full Jitter acotado: intento 0 -> [0, min(5000, 200)] = [0, 200]
        let ahora = 10_000;
        let demoras = almacen_reabierto
            .registrar_fallo_con_desfasaje(std::slice::from_ref(&id_salida), ahora, 200, 5_000)
            .expect("registrar fallo 1");
        assert_eq!(demoras.len(), 1);
        assert!((0..=200).contains(&demoras[0]));

        // Antes del proximo_intento_ms no se reclama (salvo si demora == 0).
        if demoras[0] > 0 {
            let antes = almacen_reabierto
                .reclamar_lote_salida(10, ahora + demoras[0] - 1)
                .expect("reclamar antes de tiempo");
            assert!(antes.is_empty());
        }

        // Al alcanzar proximo_intento_ms vuelve a reclamarse con intentos = 1.
        let reintento = almacen_reabierto
            .reclamar_lote_salida(10, ahora + demoras[0])
            .expect("reclamar reintento");
        assert_eq!(reintento.len(), 1);
        assert_eq!(reintento[0].intentos, 1);

        // Varias iteraciones hasta superar el techo verifican acotamiento estricto a techo_ms.
        let mut t = ahora + demoras[0];
        for intento in 1..=10 {
            let tope_esperado = calcular_tope_espera(200, 5_000, intento);
            assert!(tope_esperado <= 5_000);
            let ds = almacen_reabierto
                .registrar_fallo_con_desfasaje(std::slice::from_ref(&id_salida), t, 200, 5_000)
                .expect("registrar fallo sucesivo");
            assert!((0..=tope_esperado).contains(&ds[0]));
            t += ds[0];
            let lote_it = almacen_reabierto
                .reclamar_lote_salida(10, t)
                .expect("reclamar");
            assert_eq!(lote_it.len(), 1);
            assert_eq!(lote_it[0].intentos, intento + 1);
        }

        // Confirmacion final saca el mensaje de la cola pendiente.
        almacen_reabierto
            .confirmar_lote_enviado(std::slice::from_ref(&id_salida))
            .expect("confirmar enviado");
        let vacio = almacen_reabierto
            .reclamar_lote_salida(10, t + 1_000_000)
            .expect("cola vacia");
        assert!(vacio.is_empty());
    }

    #[test]
    fn colector_series_trazables_e_intencion_respetan_restricciones() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir memoria");

        almacen
            .registrar_lectura_colector(&LecturaColector {
                id: String::from("lec-1"),
                sesion_id: String::from("ses-1"),
                sucursal_id: SucursalId(5),
                codigo: String::from("7790001000001"),
                producto_id: Some(String::from("PROD-00001")),
                descripcion: String::from("AMOXICILINA 500MG"),
                cantidad: 3,
                ubicacion: String::from("EST-A1"),
                terminal_id: String::from("ZEBRA-01"),
                creado_en: String::from("2026-11-16T14:00:00Z"),
            })
            .expect("registrar lectura");

        let serie = SerieTrazable {
            id: String::from("ser-1"),
            sesion_id: String::from("ses-1"),
            producto_id: String::from("PROD-00001"),
            gtin: String::from("07790001000001"),
            serie: String::from("SN123456"),
            lote: Some(String::from("LOTE-A")),
            vencimiento: Some(String::from("2028-05-01")),
            sin_matriz: false,
        };
        almacen
            .registrar_serie_trazable(&serie)
            .expect("primera serie");

        // Misma combinacion (sesion_id, gtin, serie) debe rechazarse por restriccion UNIQUE.
        let duplicada = SerieTrazable {
            id: String::from("ser-2"),
            ..serie
        };
        assert!(matches!(
            almacen.registrar_serie_trazable(&duplicada),
            Err(ErrorNucleo::AlmacenLocal)
        ));

        almacen
            .guardar_intencion(&RegistroIntencion {
                identificador_unico: String::from("01930000-0000-7000-8000-000000000099"),
                sucursal_id: SucursalId(5),
                operacion: String::from("ajuste_baja"),
                trazables_suspendidos: Some(String::from(r#"["SN123456"]"#)),
                estado: String::from("iniciada"),
                creado_en: String::from("2026-11-16T14:01:00Z"),
            })
            .expect("guardar intencion inicial");

        almacen
            .guardar_intencion(&RegistroIntencion {
                identificador_unico: String::from("01930000-0000-7000-8000-000000000099"),
                sucursal_id: SucursalId(5),
                operacion: String::from("ajuste_baja"),
                trazables_suspendidos: None,
                estado: String::from("completada"),
                creado_en: String::from("2026-11-16T14:01:05Z"),
            })
            .expect("actualizar intencion");
    }

    #[test]
    fn consultas_solo_lectura_y_paginacion_tope_500() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir memoria");
        let lote: Vec<ArticuloPadron> = (0..620).map(articulo_muestra).collect();
        almacen.importar_padron_lote(&lote).expect("importar");

        // Incluso solicitando 1500, el almacen nunca supera 500 filas.
        let pagina = almacen
            .buscar_articulos_paginados("", 1500)
            .expect("paginar sin filtro");
        assert_eq!(pagina.len(), 500);

        // El filtro LIKE escapa caracteres especiales sin devolver todo el padron.
        let vacio_comodines = almacen
            .buscar_articulos_paginados("100%", 50)
            .expect("filtro escapado");
        assert!(vacio_comodines.is_empty());

        let filtrados = almacen
            .buscar_articulos_paginados("ALT-00042", 20)
            .expect("buscar por codigo alternativo");
        assert_eq!(filtrados.len(), 1);
        assert_eq!(filtrados[0].producto_id, "PROD-00042");

        almacen
            .registrar_lectura_colector(&LecturaColector {
                id: String::from("lec-10"),
                sesion_id: String::from("ses-alfa"),
                sucursal_id: SucursalId(5),
                codigo: String::from("7790001000042"),
                producto_id: Some(String::from("PROD-00042")),
                descripcion: String::from("AMOXICILINA"),
                cantidad: 4,
                ubicacion: String::from("POS:GON-01-A"),
                terminal_id: String::from("ZEBRA-02"),
                creado_en: String::from("2026-11-16T14:10:00Z"),
            })
            .expect("lectura");
        assert_eq!(
            almacen.listar_lecturas_sesion("ses-alfa").expect("listar").len(),
            1
        );

        assert_eq!(almacen.contar_pendientes_salida().expect("contar"), 0);
        almacen
            .registrar_cierre_transaccional(
                DatosAsientoMayor {
                    id: String::from("asiento-r1"),
                    id_idempotencia: String::from("idem-r1"),
                    sucursal_id: SucursalId(5),
                    laboratorio: String::from("ROEMMERS"),
                    ronda: 1,
                    folio_remoto: Some(String::from("HV00005-001")),
                    operacion_baja_id: None,
                    operacion_alta_id: None,
                    diferencia_neta: -500.0,
                    estado: String::from("registrado"),
                    destino_salida: String::from("cierre_ciclico"),
                },
                "{}",
                "2026-11-16T14:15:00Z",
            )
            .expect("asiento");
        assert_eq!(almacen.contar_pendientes_salida().expect("contar"), 1);
        let asientos = almacen
            .listar_asientos_mayor(SucursalId(5), 50)
            .expect("listar mayor");
        assert_eq!(asientos.len(), 1);
        assert_eq!(asientos[0].laboratorio, "ROEMMERS");
    }

    #[test]
    fn intenciones_pendientes_filtran_sucursal_y_marcan_resueltas() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir memoria");

        almacen
            .guardar_intencion(&RegistroIntencion {
                identificador_unico: String::from("int-s5-1"),
                sucursal_id: SucursalId(5),
                operacion: String::from("ajuste_local"),
                trazables_suspendidos: Some(String::from(r#"["10500", "", "20800"]"#)),
                estado: String::from("iniciada"),
                creado_en: String::from("2026-11-16T14:00:00Z"),
            })
            .expect("guardar pendiente 1");

        almacen
            .guardar_intencion(&RegistroIntencion {
                identificador_unico: String::from("int-s5-2"),
                sucursal_id: SucursalId(5),
                operacion: String::from("ajuste_local"),
                trazables_suspendidos: None,
                estado: String::from("completada"),
                creado_en: String::from("2026-11-16T14:01:00Z"),
            })
            .expect("guardar completada");

        almacen
            .guardar_intencion(&RegistroIntencion {
                identificador_unico: String::from("int-s8-1"),
                sucursal_id: SucursalId(8),
                operacion: String::from("ajuste_local"),
                trazables_suspendidos: Some(String::from(r#"["99999"]"#)),
                estado: String::from("iniciada"),
                creado_en: String::from("2026-11-16T14:02:00Z"),
            })
            .expect("guardar otra sucursal");

        let pendientes_s5 = almacen
            .listar_intenciones_pendientes(SucursalId(5))
            .expect("listar pendientes s5");
        assert_eq!(pendientes_s5.len(), 1);
        assert_eq!(pendientes_s5[0].identificador_unico, "int-s5-1");
        assert_eq!(
            pendientes_s5[0].trazables_suspendidos.as_deref(),
            Some(r#"["10500","20800"]"#)
        );

        almacen
            .marcar_intencion_resuelta("int-s5-1", "completada")
            .expect("marcar resuelta");
        assert!(almacen
            .listar_intenciones_pendientes(SucursalId(5))
            .expect("sin pendientes s5")
            .is_empty());

        assert!(matches!(
            almacen.marcar_intencion_resuelta("inexistente", "completada"),
            Err(ErrorNucleo::AlmacenLocal)
        ));
    }
}

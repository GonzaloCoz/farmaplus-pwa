//! Despacho central de comandos locales y concentrador LAN para colectores de sucursal.

pub mod concentrador_lan;

use std::sync::atomic::{AtomicU64, Ordering};

use almacen::{
    AlmacenLocal, ArticuloPadron, AsientoMayor, LecturaColector, RegistroIntencion, SerieTrazable,
};
use ciclicos::{
    calcular_resumen_laboratorio, deduplicar_renglones, filtrar_laboratorios_asignados,
    preparar_cierre_laboratorio, BajaLaboratorioAprobada, RenglonCiclico, ResumenLaboratorio,
};
use colector::{
    analizar_datamatrix_gs1, aplicar_conversion_padre_hijo, autorizar_cierre_ubicacion_qr,
    autorizar_lectura_colector, detectar_no_inventariados, es_posible_datamatrix, DatosGs1Anmat,
    ReglaPadreHijo, ResultadoConversion, ResumenNoInventariados,
};
use comun::{ErrorNucleo, SucursalId};
use enlace::{
    buscar_sucursal, parsear_productos_suspendidos, verificar_terminal_local, EstadoTerminalLocal,
};
use informes::{formatear_bajas_no_inventariados, formatear_lote_colector, RenglonSalidaLocal};
use reglas::{Accion, MotorReglas, RecursoObjetivo, SujetoOperador};
use serde::{Deserialize, Serialize};
use sincronia::{CoordinadorSincronia, LoteEmpaquetado, PresupuestoReintentos};
use trama::CredencialFirma;
use vencimientos::{ejecutar_pase_sucursal, LoteVencimiento, ResultadoPase};

pub use concentrador_lan::{
    ConcentradorLanColector, ManejadorConcentrador, RespuestaEstadoLan, SolicitudLecturaLan,
};

/// Limite estricto de articulos retornados por pagina hacia la interfaz WebView.
pub const TOPE_PAGINA_ARTICULOS: usize = 500;

/// Diagnostico general del plano local para barra de estado e indicadores operativos.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EstadoSaludSistema {
    pub sucursal_id: SucursalId,
    pub nombre_sucursal: String,
    pub terminal_local: EstadoTerminalLocal,
    pub cadena_mayor_integra: bool,
    pub pendientes_salida: usize,
    pub presupuesto_reintentos: u32,
}

/// Resultado discriminado de procesar una entrada cruda proveniente de escaner o teclado.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "tipo", rename_all = "snake_case")]
pub enum ResultadoEscaneo {
    UbicacionActualizada {
        codigo_ubicacion: String,
    },
    SerieTrazableRegistrada {
        lectura: LecturaColector,
        serie: SerieTrazable,
        datos_gs1: DatosGs1Anmat,
    },
    ArticuloRegistrado {
        lectura: LecturaColector,
        articulo: Option<ArticuloPadron>,
        conversion_padre_hijo: Option<ResultadoConversion>,
    },
}

/// Parametros requeridos para cerrar e impactar un laboratorio en el libro mayor local.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntradaCierreCiclico {
    pub laboratorio: String,
    pub ronda: i64,
    pub id_idempotencia: String,
    pub renglones: Vec<RenglonCiclico>,
}

/// Lotes planos formateados y auditoria de faltantes sin conteo listos para exportar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PaqueteSalidasColector {
    pub lote_conteo: String,
    pub resumen_no_inventariados: ResumenNoInventariados,
    pub lote_bajas_no_inventariados: String,
}

/// Orquestador central de comandos de negocio que articula almacen, reglas y modulos de dominio.
pub struct DespachadorComandos {
    almacen: AlmacenLocal,
    motor_reglas: MotorReglas,
    presupuesto: PresupuestoReintentos,
    sucursal_id: SucursalId,
    ubicacion_activa: String,
    secuencia_local: AtomicU64,
}

impl DespachadorComandos {
    /// Construye el despachador unificado para una celula de sucursal.
    pub fn crear(
        almacen: AlmacenLocal,
        motor_reglas: MotorReglas,
        sucursal_id: SucursalId,
    ) -> Self {
        Self {
            almacen,
            motor_reglas,
            presupuesto: PresupuestoReintentos::estandar_sucursal(),
            sucursal_id,
            ubicacion_activa: String::from("SIN_UBICACION"),
            secuencia_local: AtomicU64::new(1),
        }
    }

    /// Devuelve el identificador de sucursal configurado en esta instancia celular.
    pub fn sucursal_id(&self) -> SucursalId {
        self.sucursal_id
    }

    /// Expone una referencia de solo lectura al almacen local para verificaciones y pruebas.
    pub fn almacen(&self) -> &AlmacenLocal {
        &self.almacen
    }

    /// Expone una referencia mutable al almacen local para carga de padron o mantenimiento.
    pub fn almacen_mut(&mut self) -> &mut AlmacenLocal {
        &mut self.almacen
    }

    /// Evalua estado de salud de la celula local, integridad del libro mayor y cola de salida.
    pub fn estado_salud(&self, sujeto: &SujetoOperador) -> Result<EstadoSaludSistema, ErrorNucleo> {
        self.motor_reglas.autorizar(
            sujeto,
            Accion::VerPanel,
            &RecursoObjetivo {
                sucursal_destino: self.sucursal_id,
                monto_ajuste_abs: None,
                ubicacion_abierta_por: None,
            },
        )?;

        let nombre_sucursal = buscar_sucursal(self.sucursal_id)
            .map(|info| info.nombre.to_string())
            .unwrap_or_else(|| format!("Sucursal {}", self.sucursal_id.0));

        let terminal_local = verificar_terminal_local()?;
        let cadena_mayor_integra = self.almacen.verificar_cadena_mayor()?;
        let pendientes_salida = self.almacen.contar_pendientes_salida()?;

        Ok(EstadoSaludSistema {
            sucursal_id: self.sucursal_id,
            nombre_sucursal,
            terminal_local,
            cadena_mayor_integra,
            pendientes_salida,
            presupuesto_reintentos: self.presupuesto.disponibles(),
        })
    }

    /// Devuelve estado resumido para el concentrador LAN bajo permiso de colector.
    pub fn estado_concentrador_lan(
        &self,
        sujeto: &SujetoOperador,
    ) -> Result<RespuestaEstadoLan, ErrorNucleo> {
        autorizar_lectura_colector(&self.motor_reglas, sujeto, self.sucursal_id)?;

        let nombre_sucursal = buscar_sucursal(self.sucursal_id)
            .map(|info| info.nombre.to_string())
            .unwrap_or_else(|| format!("Sucursal {}", self.sucursal_id.0));

        Ok(RespuestaEstadoLan {
            activo: true,
            sucursal_id: self.sucursal_id,
            nombre_sucursal,
            pendientes_salida: self.almacen.contar_pendientes_salida()?,
            cadena_mayor_integra: self.almacen.verificar_cadena_mayor()?,
        })
    }

    /// Busca articulos del padron local respetando el tope maximo de 500 resultados.
    pub fn buscar_articulos_paginados(
        &self,
        sujeto: &SujetoOperador,
        filtro: &str,
        limite: usize,
    ) -> Result<Vec<ArticuloPadron>, ErrorNucleo> {
        self.motor_reglas.autorizar(
            sujeto,
            Accion::VerPanel,
            &RecursoObjetivo {
                sucursal_destino: self.sucursal_id,
                monto_ajuste_abs: None,
                ubicacion_abierta_por: None,
            },
        )?;

        let limite_acotado = limite.min(TOPE_PAGINA_ARTICULOS);
        self.almacen
            .buscar_articulos_paginados(filtro, limite_acotado)
    }

    /// Procesa una lectura cruda desde pistola o colector: ubicacion QR, GS1 DataMatrix o EAN Padre-Hijo.
    pub fn procesar_entrada_escaner(
        &mut self,
        sujeto: &SujetoOperador,
        sesion_id: &str,
        entrada_cruda: &str,
        ubicacion: &str,
        terminal_id: &str,
        creado_en: &str,
    ) -> Result<ResultadoEscaneo, ErrorNucleo> {
        autorizar_lectura_colector(&self.motor_reglas, sujeto, self.sucursal_id)?;

        let entrada = entrada_cruda.trim();
        let sesion_limpia = sesion_id.trim();
        if entrada.is_empty() || sesion_limpia.is_empty() {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        if let Some(codigo_ubicacion) = normalizar_codigo_ubicacion(entrada) {
            self.ubicacion_activa = codigo_ubicacion.clone();
            return Ok(ResultadoEscaneo::UbicacionActualizada { codigo_ubicacion });
        }

        let ubicacion_efectiva = if ubicacion.trim().is_empty() {
            self.ubicacion_activa.clone()
        } else {
            ubicacion.trim().to_string()
        };
        let seq = self.secuencia_local.fetch_add(1, Ordering::Relaxed);

        if es_posible_datamatrix(entrada) {
            return self.registrar_lectura_datamatrix(
                sesion_limpia,
                entrada,
                &ubicacion_efectiva,
                terminal_id.trim(),
                creado_en.trim(),
                seq,
            );
        }

        self.registrar_lectura_estandar(
            sesion_limpia,
            entrada,
            &ubicacion_efectiva,
            terminal_id.trim(),
            creado_en.trim(),
            seq,
        )
    }

    fn registrar_lectura_datamatrix(
        &mut self,
        sesion_id: &str,
        entrada: &str,
        ubicacion: &str,
        terminal_id: &str,
        creado_en: &str,
        seq: u64,
    ) -> Result<ResultadoEscaneo, ErrorNucleo> {
        let datos_gs1 = analizar_datamatrix_gs1(entrada);
        let articulo = self.resolver_articulo_gs1(&datos_gs1)?;
        let producto_id = articulo
            .as_ref()
            .map(|a| a.producto_id.clone())
            .or_else(|| datos_gs1.codigo_ean13.clone())
            .or_else(|| datos_gs1.gtin.clone())
            .ok_or(ErrorNucleo::IntegridadInvalida)?;

        let serie = datos_gs1.a_serie_trazable(
            format!("ser-{sesion_id}-{seq}"),
            sesion_id.to_string(),
            producto_id.clone(),
            false,
        )?;
        self.almacen.registrar_serie_trazable(&serie)?;

        let codigo_lectura = datos_gs1
            .codigo_ean13
            .clone()
            .or_else(|| datos_gs1.gtin.clone())
            .unwrap_or_else(|| producto_id.clone());
        let descripcion = articulo
            .as_ref()
            .map(|a| a.descripcion.clone())
            .unwrap_or_else(|| format!("TRAZABLE GS1 {}", codigo_lectura));

        let lectura = LecturaColector {
            id: format!("lec-{sesion_id}-{seq}"),
            sesion_id: sesion_id.to_string(),
            sucursal_id: self.sucursal_id,
            codigo: codigo_lectura,
            producto_id: Some(producto_id),
            descripcion,
            cantidad: 1,
            ubicacion: ubicacion.to_string(),
            terminal_id: terminal_id.to_string(),
            creado_en: creado_en.to_string(),
        };
        self.almacen.registrar_lectura_colector(&lectura)?;

        Ok(ResultadoEscaneo::SerieTrazableRegistrada {
            lectura,
            serie,
            datos_gs1,
        })
    }

    fn registrar_lectura_estandar(
        &mut self,
        sesion_id: &str,
        codigo: &str,
        ubicacion: &str,
        terminal_id: &str,
        creado_en: &str,
        seq: u64,
    ) -> Result<ResultadoEscaneo, ErrorNucleo> {
        let articulo = self.almacen.buscar_por_codigo(codigo)?;
        let (producto_id, descripcion, conversion_padre_hijo) = match &articulo {
            Some(art) => {
                let mut acumulado_unidad = 1_i64;
                if let Ok(previas) = self.almacen.listar_lecturas_sesion(sesion_id) {
                    let ya_contadas: i64 = previas
                        .iter()
                        .filter(|l| l.producto_id.as_deref() == Some(art.producto_id.as_str()))
                        .map(|l| l.cantidad)
                        .sum();
                    acumulado_unidad = acumulado_unidad.saturating_add(ya_contadas);
                }
                let conversion = ReglaPadreHijo::desde_articulo(art, None, None)
                    .map(|regla| aplicar_conversion_padre_hijo(acumulado_unidad, &regla));
                (
                    Some(art.producto_id.clone()),
                    art.descripcion.clone(),
                    conversion,
                )
            }
            None => (None, format!("DESCONOCIDO {codigo}"), None),
        };

        let lectura = LecturaColector {
            id: format!("lec-{sesion_id}-{seq}"),
            sesion_id: sesion_id.to_string(),
            sucursal_id: self.sucursal_id,
            codigo: codigo.to_string(),
            producto_id,
            descripcion,
            cantidad: 1,
            ubicacion: ubicacion.to_string(),
            terminal_id: terminal_id.to_string(),
            creado_en: creado_en.to_string(),
        };
        self.almacen.registrar_lectura_colector(&lectura)?;

        Ok(ResultadoEscaneo::ArticuloRegistrado {
            lectura,
            articulo,
            conversion_padre_hijo,
        })
    }

    fn resolver_articulo_gs1(
        &self,
        datos_gs1: &DatosGs1Anmat,
    ) -> Result<Option<ArticuloPadron>, ErrorNucleo> {
        if let Some(ref ean) = datos_gs1.codigo_ean13 {
            if let Some(art) = self.almacen.buscar_por_codigo(ean)? {
                return Ok(Some(art));
            }
        }
        if let Some(ref gtin) = datos_gs1.gtin {
            if let Some(art) = self.almacen.buscar_por_codigo(gtin)? {
                return Ok(Some(art));
            }
        }
        Ok(None)
    }

    /// Autoriza el cierre de una ubicacion QR verificando aislamiento celular y operador autor.
    pub fn cerrar_ubicacion_qr(
        &self,
        sujeto: &SujetoOperador,
        ubicacion_abierta_por: Option<String>,
    ) -> Result<(), ErrorNucleo> {
        autorizar_cierre_ubicacion_qr(
            &self.motor_reglas,
            sujeto,
            self.sucursal_id,
            ubicacion_abierta_por,
        )
    }

    /// Deduplica renglones ciclicos, aplica bajas aprobadas Criterio B y resume metricas contables.
    pub fn evaluar_laboratorio_ciclico(
        &self,
        sujeto: &SujetoOperador,
        laboratorio: &str,
        renglones: &[RenglonCiclico],
        bajas_aprobadas: &[BajaLaboratorioAprobada],
    ) -> Result<Option<ResumenLaboratorio>, ErrorNucleo> {
        self.motor_reglas.autorizar(
            sujeto,
            Accion::ContarCiclico,
            &RecursoObjetivo {
                sucursal_destino: self.sucursal_id,
                monto_ajuste_abs: None,
                ubicacion_abierta_por: None,
            },
        )?;

        let activos = filtrar_laboratorios_asignados(
            self.sucursal_id,
            vec![laboratorio.to_string()],
            bajas_aprobadas,
        );
        if activos.is_empty() {
            return Ok(None);
        }

        let deduplicados = deduplicar_renglones(renglones.to_vec());
        Ok(Some(calcular_resumen_laboratorio(laboratorio, &deduplicados)))
    }

    /// Prepara y registra atomicamente el cierre ciclico en el libro mayor y en bandeja de salida.
    pub fn cerrar_ciclico_laboratorio(
        &mut self,
        sujeto: &SujetoOperador,
        entrada: EntradaCierreCiclico,
        carga_salida: &str,
        creado_en: &str,
    ) -> Result<AsientoMayor, ErrorNucleo> {
        let deduplicados = deduplicar_renglones(entrada.renglones);
        let preparacion = preparar_cierre_laboratorio(
            &self.motor_reglas,
            sujeto,
            self.sucursal_id,
            &entrada.laboratorio,
            entrada.ronda,
            &entrada.id_idempotencia,
            &deduplicados,
        )?;

        self.almacen
            .registrar_cierre_transaccional(preparacion.asiento, carga_salida, creado_en)
    }

    /// Ejecuta un pase de lote de vencimientos entre sucursales validando permisos celulares.
    pub fn transferir_lote_vencimiento(
        &mut self,
        sujeto: &SujetoOperador,
        lote_origen: &LoteVencimiento,
        sucursal_destino: SucursalId,
        sesion_destino_id: &str,
        numero_envio_local: &str,
        lotes_destino: &[LoteVencimiento],
    ) -> Result<ResultadoPase, ErrorNucleo> {
        ejecutar_pase_sucursal(
            &self.motor_reglas,
            sujeto,
            lote_origen,
            sucursal_destino,
            sesion_destino_id,
            numero_envio_local,
            lotes_destino,
        )
    }

    /// Genera salidas planas `ID;CODIGO;CANTIDAD;0` y bajas `ID;CODIGO;0;0` de no inventariados.
    pub fn generar_salidas_colector(
        &self,
        sujeto: &SujetoOperador,
        sesion_id: &str,
        articulos_sucursal: &[ArticuloPadron],
    ) -> Result<PaqueteSalidasColector, ErrorNucleo> {
        self.motor_reglas.autorizar(
            sujeto,
            Accion::VerPanel,
            &RecursoObjetivo {
                sucursal_destino: self.sucursal_id,
                monto_ajuste_abs: None,
                ubicacion_abierta_por: None,
            },
        )?;

        let lecturas = self.almacen.listar_lecturas_sesion(sesion_id)?;
        let renglones_conteo: Vec<RenglonSalidaLocal> =
            lecturas.iter().map(RenglonSalidaLocal::from).collect();
        let lote_conteo = formatear_lote_colector(&renglones_conteo);

        let resumen_no_inventariados = detectar_no_inventariados(articulos_sucursal, &lecturas);
        let renglones_baja: Vec<RenglonSalidaLocal> = resumen_no_inventariados
            .articulos
            .iter()
            .map(|art| RenglonSalidaLocal {
                producto_id: Some(art.producto_id.clone()),
                codigo: art.codigo_principal.clone(),
                cantidad: 0,
            })
            .collect();
        let lote_bajas_no_inventariados = formatear_bajas_no_inventariados(&renglones_baja);

        Ok(PaqueteSalidasColector {
            lote_conteo,
            resumen_no_inventariados,
            lote_bajas_no_inventariados,
        })
    }

    /// Reclama mensajes pendientes de la bandeja de salida y construye un contenedor `.pak` firmado.
    pub fn empaquetar_bandeja_salida(
        &mut self,
        credencial: &CredencialFirma,
        limite: usize,
        enviado_en: &str,
    ) -> Result<Option<LoteEmpaquetado>, ErrorNucleo> {
        let ahora_ms = parsear_instante_ms(enviado_en)?;
        CoordinadorSincronia::preparar_envio(&mut self.almacen, limite, ahora_ms, credencial)
    }

    /// Devuelve hasta `limite` (maximo 500) asientos del libro mayor de la sucursal.
    pub fn listar_libro_mayor(
        &self,
        sujeto: &SujetoOperador,
        limite: usize,
    ) -> Result<Vec<AsientoMayor>, ErrorNucleo> {
        self.motor_reglas.autorizar(
            sujeto,
            Accion::VerPanel,
            &RecursoObjetivo {
                sucursal_destino: self.sucursal_id,
                monto_ajuste_abs: None,
                ubicacion_abierta_por: None,
            },
        )?;
        self.almacen
            .listar_asientos_mayor(self.sucursal_id, limite.min(TOPE_PAGINA_ARTICULOS))
    }

    /// Registra la intencion previa a un ajuste local para habilitar recuperacion ante corte de luz.
    pub fn registrar_intencion_ajuste(
        &mut self,
        identificador_unico: &str,
        operacion: &str,
        trazables_suspendidos: &[String],
        creado_en: &str,
    ) -> Result<(), ErrorNucleo> {
        let id_limpio = identificador_unico.trim();
        let operacion_limpia = operacion.trim();
        let creado_limpio = creado_en.trim();
        if id_limpio.is_empty() || operacion_limpia.is_empty() || creado_limpio.is_empty() {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        let lista_limpia: Vec<String> = trazables_suspendidos
            .iter()
            .map(|item| item.trim().to_owned())
            .filter(|item| !item.is_empty())
            .collect();
        let trazables_json = if lista_limpia.is_empty() {
            None
        } else {
            Some(
                serde_json::to_string(&lista_limpia)
                    .map_err(|_| ErrorNucleo::IntegridadInvalida)?,
            )
        };

        self.almacen.guardar_intencion(&RegistroIntencion {
            identificador_unico: id_limpio.to_owned(),
            sucursal_id: self.sucursal_id,
            operacion: operacion_limpia.to_owned(),
            trazables_suspendidos: trazables_json,
            estado: String::from("iniciada"),
            creado_en: creado_limpio.to_owned(),
        })
    }

    /// Lista intenciones pendientes, ejecuta la restauracion externa y las marca como completadas.
    pub fn recuperar_intenciones_pendientes(
        &mut self,
        mut restaurar_fn: impl FnMut(&RegistroIntencion, &[String]) -> Result<(), ErrorNucleo>,
    ) -> Result<usize, ErrorNucleo> {
        let pendientes = self
            .almacen
            .listar_intenciones_pendientes(self.sucursal_id)?;
        let mut recuperadas = 0usize;

        for intencion in &pendientes {
            let productos =
                parsear_productos_suspendidos(intencion.trazables_suspendidos.as_deref())?;
            restaurar_fn(intencion, &productos)?;
            self.almacen
                .marcar_intencion_resuelta(&intencion.identificador_unico, "completada")?;
            recuperadas += 1;
        }

        Ok(recuperadas)
    }
}

fn normalizar_codigo_ubicacion(entrada: &str) -> Option<String> {
    let limpia = entrada.trim();
    let sufijo = limpia
        .strip_prefix("POS:")
        .or_else(|| limpia.strip_prefix("pos:"))?;
    let codigo = sufijo.trim();
    if codigo.is_empty() {
        None
    } else {
        Some(format!("POS:{codigo}"))
    }
}

fn parsear_instante_ms(marca: &str) -> Result<i64, ErrorNucleo> {
    let limpia = marca.trim();
    if limpia.is_empty() {
        return Err(ErrorNucleo::IntegridadInvalida);
    }
    if let Ok(ms) = limpia.parse::<i64>() {
        return Ok(ms);
    }
    if limpia.len() >= 19 && limpia.as_bytes()[4] == b'-' && limpia.as_bytes()[7] == b'-' {
        let anio: i64 = limpia[0..4].parse().map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let mes: i64 = limpia[5..7].parse().map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let dia: i64 = limpia[8..10].parse().map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let hora: i64 = limpia[11..13].parse().map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let min: i64 = limpia[14..16].parse().map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let seg: i64 = limpia[17..19].parse().map_err(|_| ErrorNucleo::IntegridadInvalida)?;

        let dias = dias_desde_epoca_unix(anio, mes, dia);
        let segundos = dias
            .saturating_mul(86_400)
            .saturating_add(hora.saturating_mul(3_600))
            .saturating_add(min.saturating_mul(60))
            .saturating_add(seg);
        return Ok(segundos.saturating_mul(1_000));
    }
    Err(ErrorNucleo::IntegridadInvalida)
}

fn dias_desde_epoca_unix(anio: i64, mes: i64, dia: i64) -> i64 {
    let y = if mes <= 2 { anio - 1 } else { anio };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let m = if mes > 2 { mes - 3 } else { mes + 9 };
    let doy = (153 * m + 2) / 5 + dia - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use almacen::CodigoBarra;
    use ciclicos::{EstadoRenglon, RubroCiclico};
    use reglas::RolOperador;
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::sync::{Arc, Mutex};
    use std::time::Instant;
    use trama::CredencialFirma;
    use vencimientos::EstadoLoteVencimiento;

    fn operador_sucursal(sucursal: u16, sesion_local: bool) -> SujetoOperador {
        SujetoOperador {
            operador_id: String::from("op-suc-14"),
            rol: RolOperador::Sucursal,
            sucursal_origen: SucursalId(sucursal),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: sesion_local,
        }
    }

    fn articulo_con_padre(
        id: &str,
        ean: &str,
        existencia: f64,
        padre_id: Option<&str>,
        unidades_padre: i64,
    ) -> ArticuloPadron {
        ArticuloPadron {
            producto_id: id.to_string(),
            sucursal_id: SucursalId(14),
            troquel: Some(format!("TRQ-{id}")),
            descripcion: format!("PRODUCTO {id}"),
            laboratorio: Some(String::from("BAGO")),
            rubro: Some(String::from("MEDICAMENTOS")),
            subrubro: Some(String::from("ETICOS")),
            existencia,
            costo: 1000.0,
            precio: 1800.0,
            oculto: false,
            trazable: true,
            gtin: Some(format!("0{ean}")),
            padre_id: padre_id.map(str::to_string),
            unidades_padre,
            actualizado_en: String::from("2026-11-16T12:00:00Z"),
            codigos_barra: vec![CodigoBarra {
                codigo: ean.to_string(),
                es_principal: true,
            }],
        }
    }

    fn crear_despachador_con_padron(cantidad_extra: usize) -> (DespachadorComandos, Vec<ArticuloPadron>) {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("almacen memoria");
        let mut catalogo = vec![
            articulo_con_padre("100", "7790001000011", 5.0, None, 1),
            articulo_con_padre("101", "7790001000028", 12.0, Some("100"), 3),
            articulo_con_padre("102", "7790001000035", 4.0, None, 1),
        ];
        for i in 0..cantidad_extra {
            catalogo.push(articulo_con_padre(
                &format!("9{:04}", i),
                &format!("7799999{:06}", i),
                2.0,
                None,
                1,
            ));
        }
        almacen
            .importar_padron_lote(&catalogo)
            .expect("importar padron");
        (
            DespachadorComandos::crear(almacen, MotorReglas::crear(), SucursalId(14)),
            catalogo,
        )
    }

    #[test]
    fn estado_salud_y_paginacion_respetan_tope_500() {
        let (despachador, _) = crear_despachador_con_padron(650);
        let op = operador_sucursal(14, false);

        let salud = despachador.estado_salud(&op).expect("salud");
        assert_eq!(salud.sucursal_id, SucursalId(14));
        assert!(salud.cadena_mayor_integra);
        assert_eq!(salud.pendientes_salida, 0);

        let pagina = despachador
            .buscar_articulos_paginados(&op, "", 5000)
            .expect("busqueda");
        assert_eq!(pagina.len(), TOPE_PAGINA_ARTICULOS);

        let filtrados = despachador
            .buscar_articulos_paginados(&op, "7790001000028", 20)
            .expect("filtro");
        assert_eq!(filtrados.len(), 1);
        assert_eq!(filtrados[0].producto_id, "101");
    }

    #[test]
    fn bloqueo_celular_impide_acceso_cruzado_entre_sucursales() {
        let (despachador, _) = crear_despachador_con_padron(0);
        let operador_otra_sucursal = operador_sucursal(22, true);
        assert!(matches!(
            despachador.estado_salud(&operador_otra_sucursal),
            Err(ErrorNucleo::NoAutorizado)
        ));
    }

    #[test]
    fn escaner_procesa_ubicacion_qr_y_trazable_gs1_evitando_serie_duplicada() {
        let (mut despachador, _) = crear_despachador_con_padron(0);
        let op = operador_sucursal(14, false);

        let r_qr = despachador
            .procesar_entrada_escaner(
                &op,
                "ses-1",
                "POS:HEL-01-A",
                "",
                "ZEBRA-01",
                "2026-11-16T15:00:00Z",
            )
            .expect("qr");
        assert!(matches!(
            r_qr,
            ResultadoEscaneo::UbicacionActualizada { ref codigo_ubicacion } if codigo_ubicacion == "POS:HEL-01-A"
        ));

        let dm = "]d2010779000100001121SERIE9988\x1d1728063010LOTE01";
        let r_gs1 = despachador
            .procesar_entrada_escaner(
                &op,
                "ses-1",
                dm,
                "",
                "ZEBRA-01",
                "2026-11-16T15:00:05Z",
            )
            .expect("gs1");
        assert!(matches!(
            r_gs1,
            ResultadoEscaneo::SerieTrazableRegistrada { ref lectura, ref serie, .. }
            if lectura.producto_id.as_deref() == Some("100")
                && lectura.ubicacion == "POS:HEL-01-A"
                && serie.serie == "SERIE9988"
        ));

        // Escaneo duplicado del mismo GTIN + Serie en la sesion debe fallar de forma segura.
        assert!(matches!(
            despachador.procesar_entrada_escaner(
                &op,
                "ses-1",
                dm,
                "",
                "ZEBRA-01",
                "2026-11-16T15:00:08Z",
            ),
            Err(ErrorNucleo::AlmacenLocal)
        ));
    }

    #[test]
    fn escaner_aplica_conversion_padre_hijo_acumulada_en_sqlite() {
        let (mut despachador, _) = crear_despachador_con_padron(0);
        let op = operador_sucursal(14, false);

        for intento in 1..=3 {
            let res = despachador
                .procesar_entrada_escaner(
                    &op,
                    "ses-ph",
                    "7790001000028",
                    "POS:GON-01-A",
                    "ZEBRA-02",
                    "2026-11-16T15:10:00Z",
                )
                .expect("lectura hijo");

            if let ResultadoEscaneo::ArticuloRegistrado {
                conversion_padre_hijo,
                ..
            } = res
            {
                let conv = conversion_padre_hijo.expect("regla padre-hijo activa");
                if intento < 3 {
                    assert_eq!(conv.cajas_padre, 0);
                    assert_eq!(conv.resto_hijo, intento);
                } else {
                    assert_eq!(conv.cajas_padre, 1);
                    assert_eq!(conv.resto_hijo, 0);
                }
            } else {
                panic!("se esperaba ArticuloRegistrado");
            }
        }
    }

    #[test]
    fn ciclicos_cierre_mayor_y_empaquetado_pak_completo() {
        let (mut despachador, _) = crear_despachador_con_padron(0);
        let op_sin_sesion = operador_sucursal(14, false);
        let op_con_sesion = operador_sucursal(14, true);

        let renglones = vec![
            RenglonCiclico {
                producto_id: String::from("100"),
                codigo: String::from("7790001000011"),
                descripcion: String::from("AMOXICILINA"),
                rubro: RubroCiclico::Medicamentos,
                costo: 1000.0,
                precio: 1800.0,
                existencia_sistema: 5,
                cantidad_contada: 4,
                estado: EstadoRenglon::Controlado,
                fue_reajustado: false,
                motivo_reajuste: None,
                operacion_baja_id: None,
                operacion_alta_id: None,
            },
            RenglonCiclico {
                producto_id: String::from("102"),
                codigo: String::from("0"),
                descripcion: String::from("SIN CODIGO PENDIENTE"),
                rubro: RubroCiclico::Medicamentos,
                costo: 5000.0,
                precio: 7000.0,
                existencia_sistema: 10,
                cantidad_contada: 0,
                estado: EstadoRenglon::Pendiente,
                fue_reajustado: false,
                motivo_reajuste: None,
                operacion_baja_id: None,
                operacion_alta_id: None,
            },
        ];

        // Baja aprobada (Criterio B) excluye al laboratorio.
        let excluidos = despachador
            .evaluar_laboratorio_ciclico(
                &op_sin_sesion,
                "BAGO",
                &renglones,
                &[BajaLaboratorioAprobada {
                    sucursal_id: Some(SucursalId(14)),
                    laboratorio: String::from("BAGO"),
                    rubro: RubroCiclico::Medicamentos,
                }],
            )
            .expect("evaluar con baja");
        assert!(excluidos.is_none());

        let resumen = despachador
            .evaluar_laboratorio_ciclico(&op_sin_sesion, "BAGO", &renglones, &[])
            .expect("evaluar activo")
            .expect("resumen");
        assert_eq!(resumen.articulos_controlados, 1);
        assert_eq!(resumen.valor_faltante, 1000.0);

        // Cierre sin sesion activa en terminal local debe denegarse.
        let entrada_fail = EntradaCierreCiclico {
            laboratorio: String::from("BAGO"),
            ronda: 1,
            id_idempotencia: String::from("01930000-0000-7000-8000-000000000555"),
            renglones: renglones.clone(),
        };
        assert!(matches!(
            despachador.cerrar_ciclico_laboratorio(
                &op_sin_sesion,
                entrada_fail,
                "{}",
                "2026-11-16T15:20:00Z"
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let entrada_ok = EntradaCierreCiclico {
            laboratorio: String::from("BAGO"),
            ronda: 1,
            id_idempotencia: String::from("01930000-0000-7000-8000-000000000556"),
            renglones,
        };
        let asiento = despachador
            .cerrar_ciclico_laboratorio(
                &op_con_sesion,
                entrada_ok,
                r#"{"ronda":1,"laboratorio":"BAGO"}"#,
                "2026-11-16T15:20:05Z",
            )
            .expect("cierre transaccional");
        assert_eq!(asiento.diferencia_neta, -1000.0);
        assert_eq!(
            despachador
                .almacen()
                .contar_pendientes_salida()
                .expect("pendientes"),
            1
        );

        let credencial = CredencialFirma::generar();
        let (ids, pak) = despachador
            .empaquetar_bandeja_salida(&credencial, 10, "2026-11-16T15:21:00Z")
            .expect("empaquetar")
            .expect("lote existente");
        assert_eq!(ids.len(), 1);
        let paquete = CoordinadorSincronia::leer_paquete(&pak, &credencial.verificacion())
            .expect("verificar firma .pak");
        assert_eq!(paquete.mensajes.len(), 1);
    }

    #[test]
    fn generar_salidas_colector_y_transferencia_vencimientos() {
        let (mut despachador, catalogo) = crear_despachador_con_padron(0);
        let op = operador_sucursal(14, false);

        despachador
            .procesar_entrada_escaner(
                &op,
                "ses-sal",
                "7790001000011",
                "POS:EST-01-A",
                "ZEBRA-01",
                "2026-11-16T15:30:00Z",
            )
            .expect("lectura");

        let salidas = despachador
            .generar_salidas_colector(&op, "ses-sal", &catalogo)
            .expect("salidas");
        assert_eq!(salidas.lote_conteo, "100;7790001000011;1;0");
        assert_eq!(salidas.resumen_no_inventariados.no_inventariados, 2);
        assert!(salidas
            .lote_bajas_no_inventariados
            .contains("101;7790001000028;0;0"));
        assert!(salidas
            .lote_bajas_no_inventariados
            .contains("102;7790001000035;0;0"));

        let lote_origen = LoteVencimiento {
            id: String::from("lote-v1"),
            sucursal_id: SucursalId(14),
            sesion_id: String::from("vto-14"),
            producto_id: String::from("100"),
            codigo: String::from("7790001000011"),
            descripcion: String::from("PRODUCTO 100"),
            numero_lote: String::from("L2026"),
            fecha_vencimiento: String::from("2027-02-15"),
            cantidad: 4,
            estado: EstadoLoteVencimiento::Activo,
            sucursal_destino: None,
            numero_envio_local: None,
        };
        let pase = despachador
            .transferir_lote_vencimiento(
                &op,
                &lote_origen,
                SucursalId(15),
                "vto-15",
                "ENV-00912",
                &[],
            )
            .expect("pase intersucursal");
        assert_eq!(pase.lote_origen_actualizado.estado, EstadoLoteVencimiento::EnPase);
        assert_eq!(pase.lote_destino.sucursal_id, SucursalId(15));
    }

    fn enviar_http_lan(direccion: std::net::SocketAddr, peticion: &str) -> String {
        let mut flujo = TcpStream::connect(direccion).expect("conectar concentrador LAN");
        flujo
            .write_all(peticion.as_bytes())
            .expect("escribir peticion");
        flujo.flush().expect("vaciar buffer");
        let mut respuesta = String::new();
        flujo.read_to_string(&mut respuesta).expect("leer respuesta");
        respuesta
    }

    #[test]
    fn concentrador_lan_valida_pin_y_registra_lectura_por_tcp_local() {
        let (despachador, _) = crear_despachador_con_padron(0);
        let compartido = Arc::new(Mutex::new(despachador));
        let servidor =
            ConcentradorLanColector::vincular("127.0.0.1:0", "482910", Arc::clone(&compartido))
                .expect("vincular TCP");
        let mut manejador = servidor.iniciar().expect("iniciar concentrador");
        let addr = manejador.direccion();

        // PIN incorrecto debe rechazarse con 401.
        let r_unauth = enviar_http_lan(
            addr,
            "GET /estado HTTP/1.1\r\nHost: localhost\r\nX-MiPlus-Codigo: 000000\r\n\r\n",
        );
        assert!(r_unauth.starts_with("HTTP/1.1 401"));

        // GET /estado autenticado debe responder 200 con metadata celular.
        let t0 = Instant::now();
        let r_estado = enviar_http_lan(
            addr,
            "GET /estado HTTP/1.1\r\nHost: localhost\r\nX-MiPlus-Codigo: 482910\r\n\r\n",
        );
        assert!(r_estado.starts_with("HTTP/1.1 200"));
        assert!(r_estado.contains(r#""sucursal_id":14"#));
        assert!(t0.elapsed().as_millis() < 500);

        // POST /lectura debe persistir en almacen local.
        let cuerpo = r#"{"operador_id":"zebra-14","sesion_id":"ses-lan","entrada_cruda":"7790001000011","ubicacion":"POS:MOS-01-A","terminal_id":"TC21-01","creado_en":"2026-11-16T15:40:00Z"}"#;
        let req_post = format!(
            "POST /lectura HTTP/1.1\r\nHost: localhost\r\nX-MiPlus-Codigo: 482910\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            cuerpo.len(),
            cuerpo
        );
        let r_post = enviar_http_lan(addr, &req_post);
        assert!(r_post.starts_with("HTTP/1.1 200"));
        assert!(r_post.contains("articulo_registrado"));

        manejador.detener();

        let guard = compartido.lock().expect("lock almacen");
        let lecturas = guard
            .almacen()
            .listar_lecturas_sesion("ses-lan")
            .expect("lecturas guardadas");
        assert_eq!(lecturas.len(), 1);
        assert_eq!(lecturas[0].terminal_id, "TC21-01");
    }

    #[test]
    fn cerrar_ubicacion_qr_y_listar_libro_mayor_respetan_autoria() {
        let (mut despachador, _) = crear_despachador_con_padron(0);
        let autor = operador_sucursal(14, true);
        let ajeno = SujetoOperador {
            operador_id: String::from("op-ajeno"),
            rol: RolOperador::Sucursal,
            sucursal_origen: SucursalId(14),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: true,
        };

        assert!(matches!(
            despachador.cerrar_ubicacion_qr(&ajeno, Some(String::from("op-suc-14"))),
            Err(ErrorNucleo::NoAutorizado)
        ));
        assert!(despachador
            .cerrar_ubicacion_qr(&autor, Some(String::from("op-suc-14")))
            .is_ok());

        let renglones = vec![RenglonCiclico {
            producto_id: String::from("100"),
            codigo: String::from("7790001000011"),
            descripcion: String::from("AMOXICILINA"),
            rubro: RubroCiclico::Medicamentos,
            costo: 1000.0,
            precio: 1800.0,
            existencia_sistema: 5,
            cantidad_contada: 5,
            estado: EstadoRenglon::Controlado,
            fue_reajustado: false,
            motivo_reajuste: None,
            operacion_baja_id: None,
            operacion_alta_id: None,
        }];
        despachador
            .cerrar_ciclico_laboratorio(
                &autor,
                EntradaCierreCiclico {
                    laboratorio: String::from("ROEMMERS"),
                    ronda: 1,
                    id_idempotencia: String::from("01930000-0000-7000-8000-000000000777"),
                    renglones,
                },
                "{}",
                "2026-11-16T16:00:00Z",
            )
            .expect("asiento");
        let asientos = despachador
            .listar_libro_mayor(&autor, 10)
            .expect("listar mayor");
        assert_eq!(asientos.len(), 1);
        assert_eq!(asientos[0].laboratorio, "ROEMMERS");
    }

    #[test]
    fn vinculacion_concentrador_rechaza_pin_invalido() {
        let (despachador, _) = crear_despachador_con_padron(0);
        let compartido = Arc::new(Mutex::new(despachador));
        assert!(matches!(
            ConcentradorLanColector::vincular("127.0.0.1:0", "12345", Arc::clone(&compartido)),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
        assert!(matches!(
            ConcentradorLanColector::vincular("127.0.0.1:0", "12AB56", compartido),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }

    #[test]
    fn ciclo_completo_recuperacion_intenciones_ante_corte() {
        let (mut despachador, _) = crear_despachador_con_padron(0);

        despachador
            .registrar_intencion_ajuste(
                "01930000-0000-7000-8000-000000000501",
                "ajuste_ciclico",
                &[
                    String::from("10500"),
                    String::from("  "),
                    String::from("20800"),
                ],
                "2026-11-16T16:10:00Z",
            )
            .expect("registrar intencion 1");

        despachador
            .registrar_intencion_ajuste(
                "01930000-0000-7000-8000-000000000502",
                "ajuste_ciclico",
                &[],
                "2026-11-16T16:11:00Z",
            )
            .expect("registrar intencion 2");

        // Si falla la restauracion en la primera intencion, ninguna queda marcada como completada.
        let fallo = despachador.recuperar_intenciones_pendientes(|_, _| Err(ErrorNucleo::SinConexion));
        assert!(matches!(fallo, Err(ErrorNucleo::SinConexion)));
        assert_eq!(
            despachador
                .almacen()
                .listar_intenciones_pendientes(SucursalId(14))
                .expect("pendientes tras fallo")
                .len(),
            2
        );

        let mut procesadas = Vec::new();
        let cantidad = despachador
            .recuperar_intenciones_pendientes(|intencion, productos| {
                procesadas.push((intencion.identificador_unico.clone(), productos.to_vec()));
                Ok(())
            })
            .expect("recuperacion exitosa");

        assert_eq!(cantidad, 2);
        assert_eq!(
            procesadas,
            vec![
                (
                    String::from("01930000-0000-7000-8000-000000000501"),
                    vec![String::from("10500"), String::from("20800")]
                ),
                (
                    String::from("01930000-0000-7000-8000-000000000502"),
                    Vec::new()
                ),
            ]
        );
        assert!(despachador
            .almacen()
            .listar_intenciones_pendientes(SucursalId(14))
            .expect("sin pendientes")
            .is_empty());
        assert_eq!(
            despachador
                .recuperar_intenciones_pendientes(|_, _| Ok(()))
                .expect("segunda pasada idempotente"),
            0
        );
    }
}

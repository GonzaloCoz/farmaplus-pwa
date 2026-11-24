//! Dominio de control de vencimientos, semaforo de alertas y pases entre sucursales.

use comun::{ErrorNucleo, SucursalId};
use reglas::{Accion, MotorReglas, RecursoObjetivo, SujetoOperador};
use serde::{Deserialize, Serialize};

/// Estado operativo de un lote registrado en el control de vencimientos.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EstadoLoteVencimiento {
    Activo,
    Vendido,
    EnPase,
    Devuelto,
    Destruido,
}

/// Nivel de alerta del semaforo segun los dias restantes hasta el vencimiento.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NivelAlertaVencimiento {
    Vencido,
    Critico,
    Alerta,
    Vigente,
}

/// Lote controlado con fecha de vencimiento y trazabilidad de pase entre sucursales.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LoteVencimiento {
    pub id: String,
    pub sucursal_id: SucursalId,
    pub sesion_id: String,
    pub producto_id: String,
    pub codigo: String,
    pub descripcion: String,
    pub numero_lote: String,
    pub fecha_vencimiento: String,
    pub cantidad: i64,
    pub estado: EstadoLoteVencimiento,
    pub sucursal_destino: Option<SucursalId>,
    pub numero_envio_local: Option<String>,
}

/// Resultado atomico de ejecutar un pase de lote desde una sucursal de origen hacia destino.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResultadoPase {
    pub lote_origen_actualizado: LoteVencimiento,
    pub lote_destino: LoteVencimiento,
    pub consolidado_en_existente: bool,
}

/// Clasifica la prioridad del semaforo segun los dias hasta el vencimiento:
/// `< 0` es `Vencido`, `0..=90` es `Critico`, `91..=180` es `Alerta` y `> 180` es `Vigente`.
pub fn clasificar_alerta(dias_hasta_vencimiento: i64) -> NivelAlertaVencimiento {
    if dias_hasta_vencimiento < 0 {
        NivelAlertaVencimiento::Vencido
    } else if dias_hasta_vencimiento <= 90 {
        NivelAlertaVencimiento::Critico
    } else if dias_hasta_vencimiento <= 180 {
        NivelAlertaVencimiento::Alerta
    } else {
        NivelAlertaVencimiento::Vigente
    }
}

/// Calcula los dias calendario desde `fecha_actual_iso` hasta `fecha_vencimiento_iso` (`YYYY-MM-DD`).
/// Retorna negativo si la fecha de vencimiento ya paso, cero si vence hoy, o positivo si falta vencer.
pub fn dias_entre_fechas(
    fecha_actual_iso: &str,
    fecha_vencimiento_iso: &str,
) -> Result<i64, ErrorNucleo> {
    let (anio_actual, mes_actual, dia_actual) = parsear_fecha_iso(fecha_actual_iso)?;
    let (anio_vto, mes_vto, dia_vto) = parsear_fecha_iso(fecha_vencimiento_iso)?;

    let dias_actual = dias_civil_desde_epoca(anio_actual, mes_actual, dia_actual);
    let dias_vto = dias_civil_desde_epoca(anio_vto, mes_vto, dia_vto);

    Ok(dias_vto - dias_actual)
}

/// Ejecuta un pase de lote entre sucursales validando permisos celulares, integridad operativa
/// y consolidacion sin duplicados en la sucursal de destino.
pub fn ejecutar_pase_sucursal(
    motor: &MotorReglas,
    sujeto: &SujetoOperador,
    lote_origen: &LoteVencimiento,
    sucursal_destino: SucursalId,
    sesion_destino_id: &str,
    numero_envio_local: &str,
    lotes_existentes_destino: &[LoteVencimiento],
) -> Result<ResultadoPase, ErrorNucleo> {
    motor.autorizar(
        sujeto,
        Accion::TransferirVencimiento,
        &RecursoObjetivo {
            sucursal_destino: lote_origen.sucursal_id,
            monto_ajuste_abs: None,
            ubicacion_abierta_por: None,
        },
    )?;

    let envio_limpio = numero_envio_local.trim();
    if sucursal_destino == lote_origen.sucursal_id
        || lote_origen.estado != EstadoLoteVencimiento::Activo
        || lote_origen.cantidad <= 0
        || envio_limpio.is_empty()
    {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut lote_origen_actualizado = lote_origen.clone();
    lote_origen_actualizado.estado = EstadoLoteVencimiento::EnPase;
    lote_origen_actualizado.sucursal_destino = Some(sucursal_destino);
    lote_origen_actualizado.numero_envio_local = Some(envio_limpio.to_string());

    let lote_existente = lotes_existentes_destino.iter().find(|lote| {
        lote.sucursal_id == sucursal_destino
            && lote.estado == EstadoLoteVencimiento::Activo
            && lote.producto_id == lote_origen.producto_id
            && lote.numero_lote == lote_origen.numero_lote
            && lote.fecha_vencimiento == lote_origen.fecha_vencimiento
    });

    let (lote_destino, consolidado_en_existente) = if let Some(existente) = lote_existente {
        let cantidad_total = existente
            .cantidad
            .checked_add(lote_origen.cantidad)
            .ok_or(ErrorNucleo::IntegridadInvalida)?;
        let mut consolidado = existente.clone();
        consolidado.cantidad = cantidad_total;
        consolidado.estado = EstadoLoteVencimiento::Activo;
        consolidado.sucursal_destino = None;
        consolidado.numero_envio_local = None;
        (consolidado, true)
    } else {
        let generado = LoteVencimiento {
            id: format!(
                "pase-{}-{}-{}",
                sucursal_destino.0, envio_limpio, lote_origen.id
            ),
            sucursal_id: sucursal_destino,
            sesion_id: sesion_destino_id.to_string(),
            producto_id: lote_origen.producto_id.clone(),
            codigo: lote_origen.codigo.clone(),
            descripcion: lote_origen.descripcion.clone(),
            numero_lote: lote_origen.numero_lote.clone(),
            fecha_vencimiento: lote_origen.fecha_vencimiento.clone(),
            cantidad: lote_origen.cantidad,
            estado: EstadoLoteVencimiento::Activo,
            sucursal_destino: None,
            numero_envio_local: None,
        };
        (generado, false)
    };

    Ok(ResultadoPase {
        lote_origen_actualizado,
        lote_destino,
        consolidado_en_existente,
    })
}

fn parsear_fecha_iso(fecha: &str) -> Result<(i64, i64, i64), ErrorNucleo> {
    if !fecha.is_ascii() || fecha.len() != 10 {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let bytes = fecha.as_bytes();
    if bytes[4] != b'-' || bytes[7] != b'-' {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let anio = parsear_digitos_ascii(&bytes[0..4])?;
    let mes = parsear_digitos_ascii(&bytes[5..7])?;
    let dia = parsear_digitos_ascii(&bytes[8..10])?;

    if anio == 0 || !(1..=12).contains(&mes) {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let maximo_dias = dias_en_mes(anio, mes);
    if !(1..=maximo_dias).contains(&dia) {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    Ok((anio, mes, dia))
}

fn parsear_digitos_ascii(porcion: &[u8]) -> Result<i64, ErrorNucleo> {
    let mut acumulado: i64 = 0;
    for &byte in porcion {
        if !byte.is_ascii_digit() {
            return Err(ErrorNucleo::IntegridadInvalida);
        }
        acumulado = acumulado * 10 + i64::from(byte - b'0');
    }
    Ok(acumulado)
}

fn es_bisiesto(anio: i64) -> bool {
    (anio % 4 == 0 && anio % 100 != 0) || (anio % 400 == 0)
}

fn dias_en_mes(anio: i64, mes: i64) -> i64 {
    match mes {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if es_bisiesto(anio) {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// Convierte una fecha gregoriana proleptica a dias desde 1970-01-01 mediante aritmetica civil pura.
fn dias_civil_desde_epoca(anio: i64, mes: i64, dia: i64) -> i64 {
    let y = anio - if mes <= 2 { 1 } else { 0 };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (mes + if mes > 2 { -3 } else { 9 }) + 2) / 5 + dia - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;
    use reglas::{EfectoRegla, ReglaAdicional, RolOperador};

    fn sujeto_sucursal(sucursal: u16, rol: RolOperador) -> SujetoOperador {
        SujetoOperador {
            operador_id: String::from("op-venc-01"),
            rol,
            sucursal_origen: SucursalId(sucursal),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: true,
        }
    }

    fn lote_base(
        id: &str,
        sucursal: u16,
        cantidad: i64,
        estado: EstadoLoteVencimiento,
    ) -> LoteVencimiento {
        LoteVencimiento {
            id: id.to_string(),
            sucursal_id: SucursalId(sucursal),
            sesion_id: format!("ses-{sucursal}"),
            producto_id: String::from("PROD-1001"),
            codigo: String::from("7791234567890"),
            descripcion: String::from("IBUPROFENO 600MG X 20 COMP"),
            numero_lote: String::from("LOTE-A26"),
            fecha_vencimiento: String::from("2027-02-15"),
            cantidad,
            estado,
            sucursal_destino: None,
            numero_envio_local: None,
        }
    }

    #[test]
    fn calculo_de_dias_y_semaforo_de_alertas() {
        assert_eq!(dias_entre_fechas("2026-11-16", "2026-11-16").unwrap(), 0);
        assert_eq!(dias_entre_fechas("2026-11-16", "2026-11-15").unwrap(), -1);
        assert_eq!(dias_entre_fechas("2026-11-16", "2027-02-14").unwrap(), 90);
        assert_eq!(dias_entre_fechas("2026-11-16", "2027-02-15").unwrap(), 91);
        assert_eq!(dias_entre_fechas("2026-11-16", "2027-05-15").unwrap(), 180);
        assert_eq!(dias_entre_fechas("2026-11-16", "2027-05-16").unwrap(), 181);

        // Anios bisiestos y no bisiestos (reglas de 4, 100 y 400 anios)
        assert_eq!(dias_entre_fechas("2024-02-28", "2024-03-01").unwrap(), 2);
        assert_eq!(dias_entre_fechas("2025-02-28", "2025-03-01").unwrap(), 1);
        assert_eq!(dias_entre_fechas("2000-02-29", "2000-03-01").unwrap(), 1);
        assert_eq!(dias_entre_fechas("2100-02-28", "2100-03-01").unwrap(), 1);

        assert_eq!(clasificar_alerta(-1), NivelAlertaVencimiento::Vencido);
        assert_eq!(clasificar_alerta(0), NivelAlertaVencimiento::Critico);
        assert_eq!(clasificar_alerta(90), NivelAlertaVencimiento::Critico);
        assert_eq!(clasificar_alerta(91), NivelAlertaVencimiento::Alerta);
        assert_eq!(clasificar_alerta(180), NivelAlertaVencimiento::Alerta);
        assert_eq!(clasificar_alerta(181), NivelAlertaVencimiento::Vigente);

        let dias_vencido = dias_entre_fechas("2026-11-16", "2026-10-01").unwrap();
        assert_eq!(
            clasificar_alerta(dias_vencido),
            NivelAlertaVencimiento::Vencido
        );
        let dias_critico = dias_entre_fechas("2026-11-16", "2027-01-10").unwrap();
        assert_eq!(
            clasificar_alerta(dias_critico),
            NivelAlertaVencimiento::Critico
        );
        let dias_alerta = dias_entre_fechas("2026-11-16", "2027-04-01").unwrap();
        assert_eq!(
            clasificar_alerta(dias_alerta),
            NivelAlertaVencimiento::Alerta
        );
        let dias_vigente = dias_entre_fechas("2026-11-16", "2027-12-01").unwrap();
        assert_eq!(
            clasificar_alerta(dias_vigente),
            NivelAlertaVencimiento::Vigente
        );

        for fecha_invalida in [
            "",
            "2026-02-29",
            "2100-02-29",
            "2026-04-31",
            "2026-13-01",
            "2026-00-10",
            "0000-01-01",
            "2026-11-6",
            "16-11-2026",
            "2026/11/16",
            "2026-11-16 ",
        ] {
            assert!(matches!(
                dias_entre_fechas(fecha_invalida, "2026-11-16"),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
            assert!(matches!(
                dias_entre_fechas("2026-11-16", fecha_invalida),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
        }
    }

    #[test]
    fn pase_valido_entre_sucursales_crea_lote_limpio_en_destino() {
        let motor = MotorReglas::crear();
        let operador = sujeto_sucursal(5, RolOperador::Sucursal);
        let origen = lote_base("lote-orig-1", 5, 14, EstadoLoteVencimiento::Activo);

        let resultado = ejecutar_pase_sucursal(
            &motor,
            &operador,
            &origen,
            SucursalId(12),
            "ses-dest-12",
            "ENV-5012",
            &[],
        )
        .expect("Pase valido debe completarse");

        assert!(!resultado.consolidado_en_existente);

        assert_eq!(resultado.lote_origen_actualizado.id, "lote-orig-1");
        assert_eq!(resultado.lote_origen_actualizado.sucursal_id, SucursalId(5));
        assert_eq!(
            resultado.lote_origen_actualizado.estado,
            EstadoLoteVencimiento::EnPase
        );
        assert_eq!(
            resultado.lote_origen_actualizado.sucursal_destino,
            Some(SucursalId(12))
        );
        assert_eq!(
            resultado
                .lote_origen_actualizado
                .numero_envio_local
                .as_deref(),
            Some("ENV-5012")
        );
        assert_eq!(resultado.lote_origen_actualizado.cantidad, 14);

        assert_ne!(resultado.lote_destino.id, origen.id);
        assert_eq!(resultado.lote_destino.sucursal_id, SucursalId(12));
        assert_eq!(resultado.lote_destino.sesion_id, "ses-dest-12");
        assert_eq!(resultado.lote_destino.producto_id, "PROD-1001");
        assert_eq!(resultado.lote_destino.codigo, "7791234567890");
        assert_eq!(resultado.lote_destino.numero_lote, "LOTE-A26");
        assert_eq!(resultado.lote_destino.fecha_vencimiento, "2027-02-15");
        assert_eq!(resultado.lote_destino.cantidad, 14);
        assert_eq!(resultado.lote_destino.estado, EstadoLoteVencimiento::Activo);
        assert_eq!(resultado.lote_destino.sucursal_destino, None);
        assert_eq!(resultado.lote_destino.numero_envio_local, None);
    }

    #[test]
    fn consolidacion_idempotente_sin_duplicados_en_destino() {
        let motor = MotorReglas::crear();
        let operador = sujeto_sucursal(5, RolOperador::Sucursal);
        let origen = lote_base("lote-orig-2", 5, 6, EstadoLoteVencimiento::Activo);

        let mut lote_otro_lote = lote_base("lote-dest-otro", 12, 9, EstadoLoteVencimiento::Activo);
        lote_otro_lote.numero_lote = String::from("LOTE-Z99");

        let mut lote_vendido =
            lote_base("lote-dest-vendido", 12, 4, EstadoLoteVencimiento::Vendido);
        lote_vendido.sucursal_id = SucursalId(12);

        let lote_origen_en_lista = lote_base("lote-orig-2", 5, 6, EstadoLoteVencimiento::Activo);
        let lote_destino_previo =
            lote_base("lote-dest-activo", 12, 10, EstadoLoteVencimiento::Activo);

        let existentes = vec![
            lote_origen_en_lista,
            lote_otro_lote,
            lote_vendido,
            lote_destino_previo,
        ];

        let resultado = ejecutar_pase_sucursal(
            &motor,
            &operador,
            &origen,
            SucursalId(12),
            "ses-dest-12",
            "ENV-5013",
            &existentes,
        )
        .expect("Consolidacion sobre lote activo existente debe funcionar");

        assert!(resultado.consolidado_en_existente);
        assert_eq!(resultado.lote_destino.id, "lote-dest-activo");
        assert_eq!(resultado.lote_destino.sucursal_id, SucursalId(12));
        assert_eq!(resultado.lote_destino.cantidad, 16);
        assert_eq!(resultado.lote_destino.estado, EstadoLoteVencimiento::Activo);
        assert_eq!(resultado.lote_destino.sucursal_destino, None);
        assert_eq!(resultado.lote_destino.numero_envio_local, None);

        // Reintentar con el lote ya marcado EnPase no duplica unidades en destino.
        let reintento = ejecutar_pase_sucursal(
            &motor,
            &operador,
            &resultado.lote_origen_actualizado,
            SucursalId(12),
            "ses-dest-12",
            "ENV-5013",
            std::slice::from_ref(&resultado.lote_destino),
        );
        assert!(matches!(reintento, Err(ErrorNucleo::IntegridadInvalida)));
    }

    #[test]
    fn no_consolida_sobre_lotes_no_activos_en_destino() {
        let motor = MotorReglas::crear();
        let operador = sujeto_sucursal(5, RolOperador::Sucursal);
        let origen = lote_base("lote-orig-3", 5, 3, EstadoLoteVencimiento::Activo);

        let existente_inactivo =
            lote_base("lote-dest-devuelto", 12, 7, EstadoLoteVencimiento::Devuelto);

        let resultado = ejecutar_pase_sucursal(
            &motor,
            &operador,
            &origen,
            SucursalId(12),
            "ses-dest-99",
            "ENV-5014",
            &[existente_inactivo],
        )
        .expect("Debe generar lote activo independiente cuando en destino solo hay inactivos");

        assert!(!resultado.consolidado_en_existente);
        assert_ne!(resultado.lote_destino.id, "lote-dest-devuelto");
        assert_eq!(resultado.lote_destino.cantidad, 3);
        assert_eq!(resultado.lote_destino.estado, EstadoLoteVencimiento::Activo);
    }

    #[test]
    fn rechaza_pase_por_falta_de_autorizacion() {
        let mut motor = MotorReglas::crear();
        let origen = lote_base("lote-orig-4", 5, 5, EstadoLoteVencimiento::Activo);

        let colector = sujeto_sucursal(5, RolOperador::Colector);
        assert!(matches!(
            ejecutar_pase_sucursal(
                &motor,
                &colector,
                &origen,
                SucursalId(12),
                "ses-12",
                "ENV-1",
                &[],
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let otra_sucursal = sujeto_sucursal(7, RolOperador::Sucursal);
        assert!(matches!(
            ejecutar_pase_sucursal(
                &motor,
                &otra_sucursal,
                &origen,
                SucursalId(12),
                "ses-12",
                "ENV-2",
                &[],
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let mut zonal_sin_alcance = sujeto_sucursal(1, RolOperador::Zonal);
        zonal_sin_alcance.sucursales_asignadas = vec![SucursalId(12)];
        assert!(matches!(
            ejecutar_pase_sucursal(
                &motor,
                &zonal_sin_alcance,
                &origen,
                SucursalId(12),
                "ses-12",
                "ENV-3",
                &[],
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let mut zonal_autorizado = sujeto_sucursal(1, RolOperador::Zonal);
        zonal_autorizado.sucursales_asignadas = vec![SucursalId(5), SucursalId(12)];
        assert!(ejecutar_pase_sucursal(
            &motor,
            &zonal_autorizado,
            &origen,
            SucursalId(12),
            "ses-12",
            "ENV-4",
            &[],
        )
        .is_ok());

        motor.agregar_regla(ReglaAdicional {
            id: String::from("denegar-pase-suc-5"),
            efecto: EfectoRegla::Denegar,
            accion: Some(Accion::TransferirVencimiento),
            rol: None,
            sucursal: Some(SucursalId(5)),
            monto_maximo: None,
            descripcion: String::from("Bloqueo preventivo de pases en sucursal 5"),
        });
        let operador_sucursal = sujeto_sucursal(5, RolOperador::Sucursal);
        assert!(matches!(
            ejecutar_pase_sucursal(
                &motor,
                &operador_sucursal,
                &origen,
                SucursalId(12),
                "ses-12",
                "ENV-5",
                &[],
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));
    }

    #[test]
    fn rechaza_pase_por_misma_sucursal_lote_inactivo_cantidad_o_envio() {
        let motor = MotorReglas::crear();
        let operador = sujeto_sucursal(5, RolOperador::Sucursal);

        let activo = lote_base("lote-orig-5", 5, 5, EstadoLoteVencimiento::Activo);
        assert!(matches!(
            ejecutar_pase_sucursal(
                &motor,
                &operador,
                &activo,
                SucursalId(5),
                "ses-5",
                "ENV-10",
                &[],
            ),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        for estado_inactivo in [
            EstadoLoteVencimiento::Vendido,
            EstadoLoteVencimiento::EnPase,
            EstadoLoteVencimiento::Devuelto,
            EstadoLoteVencimiento::Destruido,
        ] {
            let lote_inactivo = lote_base("lote-inact", 5, 5, estado_inactivo);
            assert!(matches!(
                ejecutar_pase_sucursal(
                    &motor,
                    &operador,
                    &lote_inactivo,
                    SucursalId(12),
                    "ses-12",
                    "ENV-11",
                    &[],
                ),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
        }

        for cantidad_invalida in [0, -2] {
            let lote_sin_stock = lote_base(
                "lote-cero",
                5,
                cantidad_invalida,
                EstadoLoteVencimiento::Activo,
            );
            assert!(matches!(
                ejecutar_pase_sucursal(
                    &motor,
                    &operador,
                    &lote_sin_stock,
                    SucursalId(12),
                    "ses-12",
                    "ENV-12",
                    &[],
                ),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
        }

        for envio_vacio in ["", "   \t "] {
            assert!(matches!(
                ejecutar_pase_sucursal(
                    &motor,
                    &operador,
                    &activo,
                    SucursalId(12),
                    "ses-12",
                    envio_vacio,
                    &[],
                ),
                Err(ErrorNucleo::IntegridadInvalida)
            ));
        }
    }

    #[test]
    fn autoriza_administrador_y_protege_desbordamiento_al_consolidar() {
        let motor = MotorReglas::crear();
        let admin = sujeto_sucursal(1, RolOperador::Administrador);
        let origen = lote_base("lote-admin-1", 5, 4, EstadoLoteVencimiento::Activo);

        let resultado = ejecutar_pase_sucursal(
            &motor,
            &admin,
            &origen,
            SucursalId(8),
            "ses-8",
            "ENV-88",
            &[],
        )
        .expect("Administrador puede ejecutar pases en cualquier sucursal");
        assert_eq!(resultado.lote_destino.sucursal_id, SucursalId(8));
        assert_eq!(resultado.lote_destino.cantidad, 4);

        let lote_tope = lote_base(
            "lote-dest-tope",
            8,
            i64::MAX - 1,
            EstadoLoteVencimiento::Activo,
        );
        let fallo_desborde = ejecutar_pase_sucursal(
            &motor,
            &admin,
            &origen,
            SucursalId(8),
            "ses-8",
            "ENV-89",
            &[lote_tope],
        );
        assert!(matches!(
            fallo_desborde,
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }
}

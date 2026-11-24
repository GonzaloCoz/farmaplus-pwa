//! Dominio de inventarios ciclicos, rondas, rubros, criterio B y preparacion de cierres.

use std::collections::HashMap;

use almacen::DatosAsientoMayor;
use comun::{ErrorNucleo, SucursalId};
use reglas::{Accion, MotorReglas, RecursoObjetivo, SujetoOperador};
use serde::{Deserialize, Serialize};

const SEGUNDOS_POR_DIA: i64 = 86_400;

/// Clasificacion comercial de articulos para inventarios ciclicos.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default, Serialize, Deserialize,
)]
pub enum RubroCiclico {
    Medicamentos,
    Perfumeria,
    Accesorios,
    #[default]
    Varios,
}

impl RubroCiclico {
    /// Normaliza un texto de rubro o categoria hacia una de las cuatro variantes canonicas.
    pub fn desde_texto(texto: &str) -> Self {
        let normalizado = plegar_ascii_minusculas(texto);
        if normalizado.contains("medic") {
            Self::Medicamentos
        } else if normalizado.contains("perf") {
            Self::Perfumeria
        } else if normalizado.contains("acces") {
            Self::Accesorios
        } else {
            Self::Varios
        }
    }
}

/// Estado operativo de un renglon dentro del conteo ciclico de laboratorio.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default, Serialize, Deserialize,
)]
pub enum EstadoRenglon {
    #[default]
    Pendiente,
    Controlado,
    Ajustado,
}

impl EstadoRenglon {
    fn prioridad_fusion(self) -> u8 {
        match self {
            Self::Pendiente => 0,
            Self::Controlado => 1,
            Self::Ajustado => 2,
        }
    }

    /// Indica si el renglon ya fue auditado y debe impactar metricas y diferencias.
    pub fn esta_auditado(self) -> bool {
        matches!(self, Self::Controlado | Self::Ajustado)
    }
}

/// Renglon individual de inventario ciclico perteneciente a un laboratorio.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RenglonCiclico {
    pub producto_id: String,
    pub codigo: String,
    pub descripcion: String,
    pub rubro: RubroCiclico,
    pub costo: f64,
    pub precio: f64,
    pub existencia_sistema: i64,
    pub cantidad_contada: i64,
    pub estado: EstadoRenglon,
    pub fue_reajustado: bool,
    pub motivo_reajuste: Option<String>,
    pub operacion_baja_id: Option<String>,
    pub operacion_alta_id: Option<String>,
}

/// Resumen metrico y monetario calculado exclusivamente sobre renglones auditados.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResumenLaboratorio {
    pub laboratorio: String,
    pub total_articulos: usize,
    pub articulos_controlados: usize,
    pub porcentaje_avance: f64,
    pub indice_exactitud: f64,
    pub unidades_faltantes: i64,
    pub unidades_sobrantes: i64,
    pub unidades_netas: i64,
    pub valor_faltante: f64,
    pub valor_sobrante: f64,
    pub valor_neto: f64,
}

/// Solicitud aprobada de baja de laboratorio por sucursal especifica o global (`None`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BajaLaboratorioAprobada {
    pub sucursal_id: Option<SucursalId>,
    pub laboratorio: String,
    pub rubro: RubroCiclico,
}

/// Configuracion de plazo y bloqueo operativo para el ciclo de una sucursal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfiguracionCicloSucursal {
    pub sucursal_id: SucursalId,
    pub dias_asignados: i64,
    pub inicio_ciclo_epoch_s: i64,
    pub bloqueo_manual: bool,
}

impl ConfiguracionCicloSucursal {
    /// Calcula los dias restantes del ciclo actual respecto a `ahora_epoch_s`.
    pub fn dias_restantes(&self, ahora_epoch_s: i64) -> i64 {
        if self.dias_asignados <= 0 || self.inicio_ciclo_epoch_s <= 0 {
            return self.dias_asignados.max(0);
        }
        let transcurrido_s = ahora_epoch_s
            .saturating_sub(self.inicio_ciclo_epoch_s)
            .max(0);
        let dias_transcurridos = transcurrido_s / SEGUNDOS_POR_DIA;
        self.dias_asignados
            .saturating_sub(dias_transcurridos)
            .max(0)
    }

    /// Determina si la sucursal tiene el inventario bloqueado por candado manual o vencimiento de plazo.
    pub fn esta_bloqueado(&self, ahora_epoch_s: i64) -> bool {
        if self.bloqueo_manual {
            return true;
        }
        if self.dias_asignados > 0 && self.inicio_ciclo_epoch_s > 0 {
            return self.dias_restantes(ahora_epoch_s) <= 0;
        }
        false
    }
}

/// Resultado validado listo para impactar bajas, altas y asiento contable local.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PreparacionCierre {
    pub resumen: ResumenLaboratorio,
    pub bajas: Vec<RenglonCiclico>,
    pub altas: Vec<RenglonCiclico>,
    pub asiento: DatosAsientoMayor,
}

/// Deduplica renglones preservando productos sin codigo de barras valido mediante `IDP_<producto_id>`
/// y conservando estados `Controlado`/`Ajustado` por encima de `Pendiente`.
pub fn deduplicar_renglones(renglones: Vec<RenglonCiclico>) -> Vec<RenglonCiclico> {
    let mut salida: Vec<RenglonCiclico> = Vec::with_capacity(renglones.len());
    let mut indices_por_clave: HashMap<String, usize> = HashMap::with_capacity(renglones.len());

    for renglon in renglones {
        let Some(clave_canonica) = obtener_clave_canonica(&renglon) else {
            continue;
        };

        if let Some(&indice) = indices_por_clave.get(&clave_canonica) {
            let actual = &mut salida[indice];
            if debe_reemplazar(actual, &renglon) {
                *actual = renglon;
            }
        } else {
            let indice = salida.len();
            indices_por_clave.insert(clave_canonica, indice);
            salida.push(renglon);
        }
    }

    salida
}

/// Calcula avance, IRA (indice de exactitud) y diferencias en unidades y costo de un laboratorio.
///
/// Regla de negocio: los renglones en `EstadoRenglon::Pendiente` solo integran `total_articulos`;
/// unicamente `Controlado` y `Ajustado` impactan unidades, valores monetarios, avance e IRA.
pub fn calcular_resumen_laboratorio(
    laboratorio: &str,
    renglones: &[RenglonCiclico],
) -> ResumenLaboratorio {
    let total_articulos = renglones.len();
    let mut articulos_controlados: usize = 0;
    let mut articulos_exactos: usize = 0;
    let mut unidades_faltantes: i64 = 0;
    let mut unidades_sobrantes: i64 = 0;
    let mut valor_faltante: f64 = 0.0;
    let mut valor_sobrante: f64 = 0.0;

    for renglon in renglones {
        if !renglon.estado.esta_auditado() {
            continue;
        }

        articulos_controlados += 1;
        let diferencia =
            i128::from(renglon.cantidad_contada) - i128::from(renglon.existencia_sistema);
        let costo = if renglon.costo.is_finite() && renglon.costo > 0.0 {
            renglon.costo
        } else {
            0.0
        };

        if diferencia == 0 {
            articulos_exactos += 1;
        } else if diferencia < 0 {
            let unidades = i64::try_from(diferencia.unsigned_abs()).unwrap_or(i64::MAX);
            unidades_faltantes = unidades_faltantes.saturating_add(unidades);
            valor_faltante += (unidades as f64) * costo;
        } else {
            let unidades = i64::try_from(diferencia).unwrap_or(i64::MAX);
            unidades_sobrantes = unidades_sobrantes.saturating_add(unidades);
            valor_sobrante += (unidades as f64) * costo;
        }
    }

    let unidades_netas = unidades_sobrantes.saturating_sub(unidades_faltantes);
    let valor_faltante = normalizar_cero(valor_faltante);
    let valor_sobrante = normalizar_cero(valor_sobrante);
    let valor_neto = normalizar_cero(valor_sobrante - valor_faltante);

    let porcentaje_avance = if total_articulos > 0 {
        normalizar_cero(
            ((articulos_controlados as f64 / total_articulos as f64) * 100.0).min(100.0),
        )
    } else {
        0.0
    };

    let indice_exactitud = if articulos_controlados > 0 {
        normalizar_cero(
            ((articulos_exactos as f64 / articulos_controlados as f64) * 100.0).min(100.0),
        )
    } else {
        0.0
    };

    ResumenLaboratorio {
        laboratorio: laboratorio.trim().to_string(),
        total_articulos,
        articulos_controlados,
        porcentaje_avance,
        indice_exactitud,
        unidades_faltantes,
        unidades_sobrantes,
        unidades_netas,
        valor_faltante,
        valor_sobrante,
        valor_neto,
    }
}

/// Descarta de la lista asignada a una sucursal los laboratorios con baja aprobada local o global (`None`).
pub fn filtrar_laboratorios_asignados(
    sucursal_id: SucursalId,
    asignados: Vec<String>,
    bajas: &[BajaLaboratorioAprobada],
) -> Vec<String> {
    asignados
        .into_iter()
        .filter(|lab| !tiene_baja_aprobada(sucursal_id, lab, None, bajas))
        .collect()
}

/// Variante por rubro de Criterio B para filtrar pares `(laboratorio, rubro)` segun bajas aprobadas.
pub fn filtrar_laboratorios_por_rubro(
    sucursal_id: SucursalId,
    asignados: Vec<(String, RubroCiclico)>,
    bajas: &[BajaLaboratorioAprobada],
) -> Vec<(String, RubroCiclico)> {
    asignados
        .into_iter()
        .filter(|(lab, rubro)| !tiene_baja_aprobada(sucursal_id, lab, Some(*rubro), bajas))
        .collect()
}

/// Evalua reglas de autorizacion, separa bajas/altas y prepara el asiento contable para cierre local.
pub fn preparar_cierre_laboratorio(
    motor: &MotorReglas,
    sujeto: &SujetoOperador,
    sucursal_id: SucursalId,
    laboratorio: &str,
    ronda: i64,
    id_idempotencia: &str,
    renglones: &[RenglonCiclico],
) -> Result<PreparacionCierre, ErrorNucleo> {
    let resumen = calcular_resumen_laboratorio(laboratorio, renglones);
    let monto_ajuste_abs = normalizar_cero(resumen.valor_faltante + resumen.valor_sobrante);

    motor.autorizar(
        sujeto,
        Accion::ImpactarAjusteLocal,
        &RecursoObjetivo {
            sucursal_destino: sucursal_id,
            monto_ajuste_abs: Some(monto_ajuste_abs),
            ubicacion_abierta_por: None,
        },
    )?;

    let lab_limpio = laboratorio.trim();
    let id_limpio = id_idempotencia.trim();
    if lab_limpio.is_empty() || id_limpio.is_empty() || ronda < 0 {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut bajas = Vec::new();
    let mut altas = Vec::new();

    for renglon in renglones {
        if !renglon.estado.esta_auditado() {
            continue;
        }
        let diferencia =
            i128::from(renglon.cantidad_contada) - i128::from(renglon.existencia_sistema);
        if diferencia < 0 {
            bajas.push(renglon.clone());
        } else if diferencia > 0 {
            altas.push(renglon.clone());
        }
    }

    let asiento = DatosAsientoMayor {
        id: format!("cierre-{}", id_limpio),
        id_idempotencia: id_limpio.to_string(),
        sucursal_id,
        laboratorio: lab_limpio.to_string(),
        ronda,
        folio_remoto: None,
        operacion_baja_id: None,
        operacion_alta_id: None,
        diferencia_neta: resumen.valor_neto,
        estado: String::from("registrado"),
        destino_salida: String::from("cierre_ciclico"),
    };

    Ok(PreparacionCierre {
        resumen,
        bajas,
        altas,
        asiento,
    })
}

fn obtener_clave_canonica(renglon: &RenglonCiclico) -> Option<String> {
    let codigo_limpio = renglon.codigo.trim();
    let producto_limpio = renglon.producto_id.trim();
    let codigo_sin_valor = codigo_limpio.is_empty()
        || codigo_limpio == "0"
        || codigo_limpio == "00"
        || codigo_limpio.eq_ignore_ascii_case("s/n");

    if codigo_sin_valor {
        if !producto_limpio.is_empty() {
            Some(format!("IDP_{}", producto_limpio))
        } else if !codigo_limpio.is_empty() {
            Some(codigo_limpio.to_string())
        } else {
            None
        }
    } else if !producto_limpio.is_empty() {
        Some(format!("IDP_{}", producto_limpio))
    } else {
        Some(codigo_limpio.to_string())
    }
}

fn debe_reemplazar(actual: &RenglonCiclico, entrante: &RenglonCiclico) -> bool {
    let prio_actual = actual.estado.prioridad_fusion();
    let prio_entrante = entrante.estado.prioridad_fusion();

    if prio_entrante > prio_actual {
        return true;
    }
    if prio_entrante < prio_actual {
        return actual.estado == EstadoRenglon::Ajustado
            && entrante.estado == EstadoRenglon::Controlado
            && entrante.fue_reajustado;
    }
    true
}

fn tiene_baja_aprobada(
    sucursal_id: SucursalId,
    laboratorio: &str,
    rubro: Option<RubroCiclico>,
    bajas: &[BajaLaboratorioAprobada],
) -> bool {
    let lab_norm = normalizar_identificador_lab(laboratorio);
    if lab_norm.is_empty() {
        return false;
    }

    bajas.iter().any(|baja| {
        let aplica_sucursal = baja.sucursal_id.is_none() || baja.sucursal_id == Some(sucursal_id);
        if !aplica_sucursal {
            return false;
        }
        let aplica_rubro = match rubro {
            Some(objetivo) => baja.rubro == objetivo,
            None => true,
        };
        if !aplica_rubro {
            return false;
        }
        let baja_lab_norm = normalizar_identificador_lab(&baja.laboratorio);
        !baja_lab_norm.is_empty() && baja_lab_norm == lab_norm
    })
}

fn normalizar_identificador_lab(texto: &str) -> String {
    plegar_ascii_minusculas(texto)
        .chars()
        .filter(|c| !c.is_whitespace())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

fn plegar_ascii_minusculas(texto: &str) -> String {
    let mut salida = String::with_capacity(texto.len());
    for caracter in texto.trim().chars() {
        let base = match caracter {
            '\u{00e1}' | '\u{00e0}' | '\u{00e4}' | '\u{00e2}' | '\u{00c1}' | '\u{00c0}'
            | '\u{00c4}' | '\u{00c2}' => 'a',
            '\u{00e9}' | '\u{00e8}' | '\u{00eb}' | '\u{00ea}' | '\u{00c9}' | '\u{00c8}'
            | '\u{00cb}' | '\u{00ca}' => 'e',
            '\u{00ed}' | '\u{00ec}' | '\u{00ef}' | '\u{00ee}' | '\u{00cd}' | '\u{00cc}'
            | '\u{00cf}' | '\u{00ce}' => 'i',
            '\u{00f3}' | '\u{00f2}' | '\u{00f6}' | '\u{00f4}' | '\u{00d3}' | '\u{00d2}'
            | '\u{00d6}' | '\u{00d4}' => 'o',
            '\u{00fa}' | '\u{00f9}' | '\u{00fc}' | '\u{00fb}' | '\u{00da}' | '\u{00d9}'
            | '\u{00dc}' | '\u{00db}' => 'u',
            '\u{00f1}' | '\u{00d1}' => 'n',
            otro => otro.to_ascii_lowercase(),
        };
        salida.push(base);
    }
    salida
}

fn normalizar_cero(valor: f64) -> f64 {
    if valor == 0.0 {
        0.0
    } else {
        valor
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use almacen::AlmacenLocal;
    use reglas::{EfectoRegla, ReglaAdicional, RolOperador};

    fn renglon_muestra(
        producto_id: &str,
        codigo: &str,
        existencia_sistema: i64,
        cantidad_contada: i64,
        costo: f64,
        estado: EstadoRenglon,
    ) -> RenglonCiclico {
        RenglonCiclico {
            producto_id: String::from(producto_id),
            codigo: String::from(codigo),
            descripcion: format!("PRODUCTO {}", producto_id),
            rubro: RubroCiclico::Medicamentos,
            costo,
            precio: costo * 1.5,
            existencia_sistema,
            cantidad_contada,
            estado,
            fue_reajustado: false,
            motivo_reajuste: None,
            operacion_baja_id: None,
            operacion_alta_id: None,
        }
    }

    fn sujeto_sucursal(sucursal: u16, sesion_activa: bool) -> SujetoOperador {
        SujetoOperador {
            operador_id: String::from("op-sucursal-5"),
            rol: RolOperador::Sucursal,
            sucursal_origen: SucursalId(sucursal),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: sesion_activa,
        }
    }

    #[test]
    fn rubro_ciclico_desde_texto_mapea_variantes() {
        assert_eq!(
            RubroCiclico::desde_texto("Medicamentos"),
            RubroCiclico::Medicamentos
        );
        assert_eq!(
            RubroCiclico::desde_texto("  medicamento  "),
            RubroCiclico::Medicamentos
        );
        assert_eq!(
            RubroCiclico::desde_texto("Perfumer\u{00ed}a"),
            RubroCiclico::Perfumeria
        );
        assert_eq!(
            RubroCiclico::desde_texto("PERFUMERIA"),
            RubroCiclico::Perfumeria
        );
        assert_eq!(
            RubroCiclico::desde_texto("Accesorios"),
            RubroCiclico::Accesorios
        );
        assert_eq!(RubroCiclico::desde_texto("Varios"), RubroCiclico::Varios);
        assert_eq!(
            RubroCiclico::desde_texto("Otro Rubro"),
            RubroCiclico::Varios
        );
        assert_eq!(RubroCiclico::desde_texto(""), RubroCiclico::Varios);
    }

    #[test]
    fn deduplicar_preserva_codigos_cero_y_prioriza_estado_auditado() {
        let entrada = vec![
            renglon_muestra("101", "0", 10, 0, 100.0, EstadoRenglon::Pendiente),
            renglon_muestra("102", "0", 8, 8, 120.0, EstadoRenglon::Controlado),
            renglon_muestra("103", "00", 5, 4, 90.0, EstadoRenglon::Controlado),
            renglon_muestra("104", "S/N", 3, 3, 50.0, EstadoRenglon::Ajustado),
            renglon_muestra("105", "  ", 2, 0, 75.0, EstadoRenglon::Pendiente),
            // Colision con 101: Controlado gana sobre Pendiente.
            renglon_muestra("101", "0", 10, 9, 100.0, EstadoRenglon::Controlado),
            // Colision con 104: Pendiente NO debe pisar a Ajustado.
            renglon_muestra("104", "s/n", 3, 0, 50.0, EstadoRenglon::Pendiente),
            // Producto sin producto_id usando codigo limpio.
            renglon_muestra("", "7790001000011", 4, 4, 200.0, EstadoRenglon::Pendiente),
            renglon_muestra(
                "",
                " 7790001000011 ",
                4,
                6,
                200.0,
                EstadoRenglon::Controlado,
            ),
            // Registro invalido sin codigo ni producto_id debe omitirse.
            renglon_muestra("", "  ", 1, 1, 10.0, EstadoRenglon::Pendiente),
        ];

        let resultado = deduplicar_renglones(entrada);
        assert_eq!(resultado.len(), 6);

        let p101 = resultado
            .iter()
            .find(|r| r.producto_id == "101")
            .expect("101 presente");
        assert_eq!(p101.estado, EstadoRenglon::Controlado);
        assert_eq!(p101.cantidad_contada, 9);

        let p102 = resultado
            .iter()
            .find(|r| r.producto_id == "102")
            .expect("102 presente");
        assert_eq!(p102.cantidad_contada, 8);

        let p103 = resultado
            .iter()
            .find(|r| r.producto_id == "103")
            .expect("103 presente");
        assert_eq!(p103.estado, EstadoRenglon::Controlado);

        let p104 = resultado
            .iter()
            .find(|r| r.producto_id == "104")
            .expect("104 presente");
        assert_eq!(p104.estado, EstadoRenglon::Ajustado);
        assert_eq!(p104.cantidad_contada, 3);

        let p_ean = resultado
            .iter()
            .find(|r| r.codigo.trim() == "7790001000011")
            .expect("ean presente");
        assert_eq!(p_ean.estado, EstadoRenglon::Controlado);
        assert_eq!(p_ean.cantidad_contada, 6);
    }

    #[test]
    fn calcular_resumen_excluye_pendientes_de_unidades_y_valores() {
        let renglones = vec![
            // Pendiente con gran diferencia falsa (0 contado vs 50 sistema): NO debe impactar metricas.
            renglon_muestra("P-PEND", "7790001", 50, 0, 1000.0, EstadoRenglon::Pendiente),
            // Controlado con faltante de 2 unidades a costo 250.0 => -500.0
            renglon_muestra("P-FALT", "7790002", 10, 8, 250.0, EstadoRenglon::Controlado),
            // Controlado con sobrante de 3 unidades a costo 100.0 => +300.0
            renglon_muestra("P-SOBR", "7790003", 4, 7, 100.0, EstadoRenglon::Controlado),
            // Ajustado exacto sin diferencia
            renglon_muestra("P-EXAC", "7790004", 6, 6, 400.0, EstadoRenglon::Ajustado),
        ];

        let resumen = calcular_resumen_laboratorio("  ROEMMERS  ", &renglones);
        assert_eq!(resumen.laboratorio, "ROEMMERS");
        assert_eq!(resumen.total_articulos, 4);
        assert_eq!(resumen.articulos_controlados, 3);
        assert!((resumen.porcentaje_avance - 75.0).abs() < 1e-9);
        assert!((resumen.indice_exactitud - (100.0 / 3.0)).abs() < 1e-9);
        assert_eq!(resumen.unidades_faltantes, 2);
        assert_eq!(resumen.unidades_sobrantes, 3);
        assert_eq!(resumen.unidades_netas, 1);
        assert!((resumen.valor_faltante - 500.0).abs() < 1e-9);
        assert!((resumen.valor_sobrante - 300.0).abs() < 1e-9);
        assert!((resumen.valor_neto - (-200.0)).abs() < 1e-9);

        let solo_pendientes = vec![renglon_muestra(
            "P-SOLO",
            "7790099",
            25,
            0,
            500.0,
            EstadoRenglon::Pendiente,
        )];
        let resumen_pendiente = calcular_resumen_laboratorio("BAGO", &solo_pendientes);
        assert_eq!(resumen_pendiente.total_articulos, 1);
        assert_eq!(resumen_pendiente.articulos_controlados, 0);
        assert_eq!(resumen_pendiente.porcentaje_avance, 0.0);
        assert_eq!(resumen_pendiente.indice_exactitud, 0.0);
        assert_eq!(resumen_pendiente.unidades_faltantes, 0);
        assert_eq!(resumen_pendiente.unidades_sobrantes, 0);
        assert_eq!(resumen_pendiente.unidades_netas, 0);
        assert_eq!(resumen_pendiente.valor_faltante, 0.0);
        assert_eq!(resumen_pendiente.valor_sobrante, 0.0);
        assert_eq!(resumen_pendiente.valor_neto, 0.0);
    }

    #[test]
    fn criterio_b_filtra_bajas_locales_y_globales() {
        let bajas = vec![
            BajaLaboratorioAprobada {
                sucursal_id: None,
                laboratorio: String::from("LOREAL"),
                rubro: RubroCiclico::Perfumeria,
            },
            BajaLaboratorioAprobada {
                sucursal_id: Some(SucursalId(5)),
                laboratorio: String::from("  Bag\u{00f3} "),
                rubro: RubroCiclico::Medicamentos,
            },
        ];

        let asignados = vec![
            String::from("ROEMMERS"),
            String::from("BAGO"),
            String::from("LOREAL"),
            String::from("BAYER"),
        ];

        let filtrados_suc_5 =
            filtrar_laboratorios_asignados(SucursalId(5), asignados.clone(), &bajas);
        assert_eq!(filtrados_suc_5, vec!["ROEMMERS", "BAYER"]);

        // En sucursal 12 solo aplica la baja global (LOREAL); BAGO permanece activo.
        let filtrados_suc_12 = filtrar_laboratorios_asignados(SucursalId(12), asignados, &bajas);
        assert_eq!(filtrados_suc_12, vec!["ROEMMERS", "BAGO", "BAYER"]);

        // Validacion discriminada por rubro: BAGO solo tiene baja en Medicamentos en sucursal 5.
        let por_rubro = filtrar_laboratorios_por_rubro(
            SucursalId(5),
            vec![
                (String::from("BAGO"), RubroCiclico::Medicamentos),
                (String::from("BAGO"), RubroCiclico::Perfumeria),
                (String::from("LOREAL"), RubroCiclico::Perfumeria),
            ],
            &bajas,
        );
        assert_eq!(
            por_rubro,
            vec![(String::from("BAGO"), RubroCiclico::Perfumeria)]
        );
    }

    #[test]
    fn candado_de_plazo_y_bloqueo_manual() {
        let inicio = 1_700_000_000;
        let config_activa = ConfiguracionCicloSucursal {
            sucursal_id: SucursalId(5),
            dias_asignados: 30,
            inicio_ciclo_epoch_s: inicio,
            bloqueo_manual: false,
        };

        assert!(!config_activa.esta_bloqueado(inicio - 120));
        assert_eq!(config_activa.dias_restantes(inicio - 120), 30);

        let ultimo_segundo_habilitado = inicio + (29 * SEGUNDOS_POR_DIA) + (SEGUNDOS_POR_DIA - 1);
        assert!(!config_activa.esta_bloqueado(ultimo_segundo_habilitado));
        assert_eq!(config_activa.dias_restantes(ultimo_segundo_habilitado), 1);

        let vencimiento_exacto = inicio + (30 * SEGUNDOS_POR_DIA);
        assert!(config_activa.esta_bloqueado(vencimiento_exacto));
        assert_eq!(config_activa.dias_restantes(vencimiento_exacto), 0);

        let sin_plazo_configurado = ConfiguracionCicloSucursal {
            sucursal_id: SucursalId(5),
            dias_asignados: 0,
            inicio_ciclo_epoch_s: inicio,
            bloqueo_manual: false,
        };
        assert!(!sin_plazo_configurado.esta_bloqueado(vencimiento_exacto + 10_000));

        let bloqueo_manual = ConfiguracionCicloSucursal {
            sucursal_id: SucursalId(5),
            dias_asignados: 30,
            inicio_ciclo_epoch_s: inicio,
            bloqueo_manual: true,
        };
        assert!(bloqueo_manual.esta_bloqueado(inicio));
    }

    #[test]
    fn preparar_cierre_autorizado_separa_bajas_altas_e_impacta_almacen() {
        let motor = MotorReglas::crear();
        let sujeto = sujeto_sucursal(5, true);
        let renglones = vec![
            renglon_muestra("P-PEND", "7791000", 10, 0, 500.0, EstadoRenglon::Pendiente),
            renglon_muestra("P-BAJA", "7791001", 10, 7, 100.0, EstadoRenglon::Controlado),
            renglon_muestra("P-ALTA", "7791002", 4, 6, 50.0, EstadoRenglon::Controlado),
            renglon_muestra("P-IGUAL", "7791003", 5, 5, 200.0, EstadoRenglon::Controlado),
        ];

        let preparacion = preparar_cierre_laboratorio(
            &motor,
            &sujeto,
            SucursalId(5),
            "ROEMMERS",
            2,
            "01930000-0000-7000-8000-000000000501",
            &renglones,
        )
        .expect("cierre autorizado");

        assert_eq!(preparacion.bajas.len(), 1);
        assert_eq!(preparacion.bajas[0].producto_id, "P-BAJA");
        assert_eq!(preparacion.altas.len(), 1);
        assert_eq!(preparacion.altas[0].producto_id, "P-ALTA");
        assert_eq!(preparacion.resumen.unidades_faltantes, 3);
        assert_eq!(preparacion.resumen.unidades_sobrantes, 2);
        assert!((preparacion.asiento.diferencia_neta - (-200.0)).abs() < 1e-9);
        assert_eq!(preparacion.asiento.sucursal_id, SucursalId(5));
        assert_eq!(preparacion.asiento.laboratorio, "ROEMMERS");
        assert_eq!(preparacion.asiento.ronda, 2);

        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("almacen en memoria");
        let carga = serde_json::to_string(&preparacion.resumen).expect("serializar resumen");
        let asiento_mayor = almacen
            .registrar_cierre_transaccional(preparacion.asiento, &carga, "2026-11-16T15:00:00Z")
            .expect("registrar cierre en almacen");
        assert_eq!(asiento_mayor.laboratorio, "ROEMMERS");
        assert!(almacen.verificar_cadena_mayor().expect("verificar cadena"));
    }

    #[test]
    fn preparar_cierre_rechaza_cuando_motor_reglas_deniega() {
        let mut motor = MotorReglas::crear();
        motor.agregar_regla(ReglaAdicional {
            id: String::from("tope-sucursal-5"),
            efecto: EfectoRegla::Denegar,
            accion: Some(Accion::ImpactarAjusteLocal),
            rol: None,
            sucursal: Some(SucursalId(5)),
            monto_maximo: Some(500.0),
            descripcion: String::from("Tope maximo de ajuste para sucursal 5"),
        });

        let renglones_excedidos = vec![
            // Faltante 400 + Sobrante 200 = 600.0 > tope 500.0
            renglon_muestra("P-BAJA", "7792001", 6, 2, 100.0, EstadoRenglon::Controlado),
            renglon_muestra("P-ALTA", "7792002", 1, 3, 100.0, EstadoRenglon::Controlado),
        ];

        let sujeto_valido = sujeto_sucursal(5, true);
        let err_tope = preparar_cierre_laboratorio(
            &motor,
            &sujeto_valido,
            SucursalId(5),
            "BAYER",
            1,
            "01930000-0000-7000-8000-000000000502",
            &renglones_excedidos,
        );
        assert!(matches!(err_tope, Err(ErrorNucleo::NoAutorizado)));

        // Sesion local inactiva debe denegar incluso si el monto esta dentro del tope.
        let renglones_chicos = vec![renglon_muestra(
            "P-CHICO",
            "7792003",
            2,
            1,
            100.0,
            EstadoRenglon::Controlado,
        )];
        let sujeto_sin_sesion = sujeto_sucursal(5, false);
        let err_sesion = preparar_cierre_laboratorio(
            &motor,
            &sujeto_sin_sesion,
            SucursalId(5),
            "BAYER",
            1,
            "01930000-0000-7000-8000-000000000503",
            &renglones_chicos,
        );
        assert!(matches!(err_sesion, Err(ErrorNucleo::NoAutorizado)));

        // Colector y otra sucursal tambien deben denegarse.
        let colector = SujetoOperador {
            operador_id: String::from("col-1"),
            rol: RolOperador::Colector,
            sucursal_origen: SucursalId(5),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: true,
        };
        let err_colector = preparar_cierre_laboratorio(
            &motor,
            &colector,
            SucursalId(5),
            "BAYER",
            1,
            "01930000-0000-7000-8000-000000000504",
            &renglones_chicos,
        );
        assert!(matches!(err_colector, Err(ErrorNucleo::NoAutorizado)));
    }

    #[test]
    fn preparar_cierre_rechaza_identificadores_vacios() {
        let motor = MotorReglas::crear();
        let sujeto = sujeto_sucursal(5, true);
        let renglones = vec![renglon_muestra(
            "P-1",
            "7793001",
            5,
            4,
            100.0,
            EstadoRenglon::Controlado,
        )];

        let sin_idempotencia = preparar_cierre_laboratorio(
            &motor,
            &sujeto,
            SucursalId(5),
            "ROEMMERS",
            1,
            "   ",
            &renglones,
        );
        assert!(matches!(
            sin_idempotencia,
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let sin_laboratorio = preparar_cierre_laboratorio(
            &motor,
            &sujeto,
            SucursalId(5),
            " ",
            1,
            "01930000-0000-7000-8000-000000000505",
            &renglones,
        );
        assert!(matches!(
            sin_laboratorio,
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }
}

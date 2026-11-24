//! Dominio de colector, conversion padre-hijo, trazabilidad GS1, ubicaciones QR y recuentos.

pub mod auditoria;
pub mod gs1;
pub mod padre_hijo;
pub mod ubicaciones;

pub use auditoria::{
    detectar_no_inventariados, repartir_diferencias_recuento, ArticuloNoInventariado,
    ResumenNoInventariados,
};
pub use gs1::{analizar_datamatrix_gs1, es_posible_datamatrix, DatosGs1Anmat};
pub use padre_hijo::{
    aplicar_conversion_padre_hijo, consolidar_mapa_padre_hijo, ItemConsolidado, ReglaPadreHijo,
    ResultadoConversion,
};
pub use ubicaciones::{expandir_ubicaciones_qr, EsquemaCaras, GrupoMueblesQr, PrefijoSector};

use comun::{ErrorNucleo, SucursalId};
use reglas::{Accion, MotorReglas, RecursoObjetivo, SujetoOperador};

/// Verifica mediante `MotorReglas` que el operador este autorizado a registrar lecturas en la sucursal.
pub fn autorizar_lectura_colector(
    motor: &MotorReglas,
    sujeto: &SujetoOperador,
    sucursal_destino: SucursalId,
) -> Result<(), ErrorNucleo> {
    let recurso = RecursoObjetivo {
        sucursal_destino,
        monto_ajuste_abs: None,
        ubicacion_abierta_por: None,
    };
    motor.autorizar(sujeto, Accion::RegistrarLecturaColector, &recurso)
}

/// Verifica mediante `MotorReglas` que el operador pueda cerrar una ubicacion QR dentro de su sucursal.
pub fn autorizar_cierre_ubicacion_qr(
    motor: &MotorReglas,
    sujeto: &SujetoOperador,
    sucursal_destino: SucursalId,
    ubicacion_abierta_por: Option<String>,
) -> Result<(), ErrorNucleo> {
    let recurso = RecursoObjetivo {
        sucursal_destino,
        monto_ajuste_abs: None,
        ubicacion_abierta_por,
    };
    motor.autorizar(sujeto, Accion::CerrarUbicacionQr, &recurso)
}

#[cfg(test)]
mod tests {
    use super::*;
    use reglas::RolOperador;

    #[test]
    fn autoriza_colector_solo_en_su_sucursal_y_bloquea_otra() {
        let motor = MotorReglas::crear();
        let colector = SujetoOperador {
            operador_id: String::from("op-colector-1"),
            rol: RolOperador::Colector,
            sucursal_origen: SucursalId(12),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: false,
        };

        assert!(autorizar_lectura_colector(&motor, &colector, SucursalId(12)).is_ok());
        assert!(autorizar_cierre_ubicacion_qr(
            &motor,
            &colector,
            SucursalId(12),
            Some(String::from("op-colector-1")),
        )
        .is_ok());
        assert!(matches!(
            autorizar_lectura_colector(&motor, &colector, SucursalId(13)),
            Err(ErrorNucleo::NoAutorizado)
        ));
    }
}

use almacen::{AlmacenLocal, MensajeSalida};
use comun::ErrorNucleo;
use serde::{Deserialize, Serialize};
use trama::{desempaquetar_pak, empaquetar_pak, CredencialFirma, CredencialVerificacion};

use crate::PresupuestoReintentos;

/// Version vigente del formato JSON contenido dentro de un paquete `.pak` de bandeja.
pub const VERSION_PAQUETE_BANDEJA: u8 = 1;

/// Par de identificadores reclamados y su contenedor binario `.pak` firmado.
pub type LoteEmpaquetado = (Vec<String>, Vec<u8>);

/// Carga estructurada de mensajes reclamados desde `bandeja_salida` para envio en `.pak`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaqueteBandeja {
    pub version: u8,
    pub generado_en_ms: i64,
    pub mensajes: Vec<MensajeSalida>,
}

/// Orquestador de empaquetado de bandeja local y gestion de confirmacion o reintentos.
#[derive(Debug, Clone, Copy, Default)]
pub struct CoordinadorSincronia;

impl CoordinadorSincronia {
    /// Reclama hasta `limite` mensajes listos en `almacen`, los serializa y firma en un `.pak`.
    pub fn preparar_envio(
        almacen: &mut AlmacenLocal,
        limite: usize,
        ahora_ms: i64,
        firma: &CredencialFirma,
    ) -> Result<Option<LoteEmpaquetado>, ErrorNucleo> {
        let mensajes = almacen.reclamar_lote_salida(limite, ahora_ms)?;
        if mensajes.is_empty() {
            return Ok(None);
        }

        let ids: Vec<String> = mensajes.iter().map(|m| m.id.clone()).collect();
        let paquete = PaqueteBandeja {
            version: VERSION_PAQUETE_BANDEJA,
            generado_en_ms: ahora_ms,
            mensajes,
        };
        let carga_json =
            serde_json::to_vec(&paquete).map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let contenedor_pak = empaquetar_pak(&carga_json, firma)?;
        Ok(Some((ids, contenedor_pak)))
    }

    /// Verifica firma/huella de un `.pak` recibido y reconstruye el `PaqueteBandeja`.
    pub fn leer_paquete(
        paquete_pak: &[u8],
        verificador: &CredencialVerificacion,
    ) -> Result<PaqueteBandeja, ErrorNucleo> {
        let carga_json = desempaquetar_pak(paquete_pak, verificador)?;
        let paquete: PaqueteBandeja =
            serde_json::from_slice(&carga_json).map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        if paquete.version != VERSION_PAQUETE_BANDEJA {
            return Err(ErrorNucleo::IntegridadInvalida);
        }
        Ok(paquete)
    }

    /// Confirma mensajes enviados y recarga presupuesto, o devuelve con espera exponencial ante fallo.
    pub fn procesar_resultado(
        almacen: &mut AlmacenLocal,
        presupuesto: &mut PresupuestoReintentos,
        ids: &[String],
        exito: bool,
        ahora_ms: i64,
        base_ms: i64,
        techo_ms: i64,
    ) -> Result<(), ErrorNucleo> {
        if ids.is_empty() {
            return Ok(());
        }

        if exito {
            almacen.confirmar_lote_enviado(ids)?;
            presupuesto.registrar_exito();
            return Ok(());
        }

        if presupuesto.consumir_intento() {
            almacen.registrar_fallo_con_desfasaje(ids, ahora_ms, base_ms, techo_ms)?;
        } else {
            // Sin saldo de reintentos: devuelve filas a pendiente con ventana maxima para no trabar la cola.
            let tope = techo_ms.max(base_ms).max(0);
            almacen.registrar_fallo_con_desfasaje(ids, ahora_ms, tope, tope)?;
        }
        Ok(())
    }
}

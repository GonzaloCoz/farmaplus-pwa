use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Identificador canonico de celula (sucursal).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SucursalId(pub u16);

/// Errores base del nucleo sin exponer detalles internos sensibles hacia la interfaz.
#[derive(Debug, Error)]
pub enum ErrorNucleo {
    #[error("Operacion no autorizada para la sesion o sucursal actual.")]
    NoAutorizado,
    #[error("No fue posible acceder al almacen local de datos.")]
    AlmacenLocal,
    #[error("Formato o integridad de paquete invalida.")]
    IntegridadInvalida,
    #[error("Sin conexion con el servidor de sucursal o central.")]
    SinConexion,
}

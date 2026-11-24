use serde::{Deserialize, Serialize};

const CAPACIDAD_ESTANDAR_SUCURSAL: u32 = 100;
const RECARGA_ESTANDAR_SUCURSAL: u32 = 1;
const COSTO_ESTANDAR_REINTENTO: u32 = 10;

/// Cubo de cuota para limitar tormentas de reintentos entre las 71 sucursales.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PresupuestoReintentos {
    capacidad_maxima: u32,
    disponibles: u32,
    recarga_por_exito: u32,
    costo_reintento: u32,
}

impl PresupuestoReintentos {
    /// Crea un presupuesto inicializado a capacidad maxima con costos y recargas configurables.
    pub fn crear(capacidad_maxima: u32, recarga_por_exito: u32, costo_reintento: u32) -> Self {
        Self {
            capacidad_maxima,
            disponibles: capacidad_maxima,
            recarga_por_exito,
            costo_reintento,
        }
    }

    /// Crea la configuracion estandar de sucursal (tope 100, recarga 1, costo 10 por reintento).
    pub fn estandar_sucursal() -> Self {
        Self::crear(
            CAPACIDAD_ESTANDAR_SUCURSAL,
            RECARGA_ESTANDAR_SUCURSAL,
            COSTO_ESTANDAR_REINTENTO,
        )
    }

    /// Intenta descontar el costo de un reintento; devuelve `false` si no alcanza el saldo.
    pub fn consumir_intento(&mut self) -> bool {
        if self.capacidad_maxima == 0 || self.disponibles < self.costo_reintento {
            return false;
        }
        self.disponibles -= self.costo_reintento;
        true
    }

    /// Acredita unidades tras un envio confirmado sin superar la capacidad maxima.
    pub fn registrar_exito(&mut self) {
        self.disponibles = self
            .disponibles
            .saturating_add(self.recarga_por_exito)
            .min(self.capacidad_maxima);
    }

    /// Devuelve la cantidad de unidades disponibles actualmente para reintentar.
    pub fn disponibles(&self) -> u32 {
        self.disponibles
    }

    /// Devuelve el limite maximo configurado para este presupuesto.
    pub fn capacidad_maxima(&self) -> u32 {
        self.capacidad_maxima
    }

    /// Devuelve cuantas unidades se recuperan tras cada envio exitoso.
    pub fn recarga_por_exito(&self) -> u32 {
        self.recarga_por_exito
    }

    /// Devuelve el costo en unidades descontado por cada reintento.
    pub fn costo_reintento(&self) -> u32 {
        self.costo_reintento
    }
}

impl Default for PresupuestoReintentos {
    fn default() -> Self {
        Self::estandar_sucursal()
    }
}

use std::collections::{BTreeMap, HashMap};

use almacen::ArticuloPadron;
use serde::{Deserialize, Serialize};

/// Regla de conversion fraccionaria desde un articulo hijo hacia su presentacion padre.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReglaPadreHijo {
    pub padre_id: String,
    pub unidades_padre: i64,
    pub codigo_padre: Option<String>,
    pub descripcion_padre: Option<String>,
}

impl ReglaPadreHijo {
    /// Construye una regla valida a partir de un articulo del padron si posee padre distinto de si mismo y factor > 1.
    pub fn desde_articulo(
        articulo: &ArticuloPadron,
        codigo_padre: Option<String>,
        descripcion_padre: Option<String>,
    ) -> Option<Self> {
        let padre = articulo.padre_id.as_deref()?.trim();
        let propio = articulo.producto_id.trim();
        if articulo.unidades_padre <= 1 || padre.is_empty() || padre == "0" || padre == propio {
            return None;
        }
        Some(Self {
            padre_id: padre.to_string(),
            unidades_padre: articulo.unidades_padre,
            codigo_padre,
            descripcion_padre,
        })
    }
}

/// Resultado de dividir una cantidad acumulada de unidades hijo en cajas padre y resto suelto.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResultadoConversion {
    pub cajas_padre: i64,
    pub resto_hijo: i64,
}

/// Renglon consolidado de inventario listo para conversion padre-hijo y exportacion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemConsolidado {
    pub producto_id: String,
    pub codigo: String,
    pub descripcion: String,
    pub cantidad: i64,
}

fn regla_habilitada(regla: &ReglaPadreHijo) -> bool {
    let padre = regla.padre_id.trim();
    regla.unidades_padre > 1 && !padre.is_empty() && padre != "0"
}

/// Convierte unidades acumuladas de un hijo en cajas padre solo si `unidades_padre > 1` y `padre_id` es valido.
pub fn aplicar_conversion_padre_hijo(
    cantidad_acumulada: i64,
    regla: &ReglaPadreHijo,
) -> ResultadoConversion {
    if !regla_habilitada(regla) || cantidad_acumulada < regla.unidades_padre {
        return ResultadoConversion {
            cajas_padre: 0,
            resto_hijo: cantidad_acumulada,
        };
    }

    ResultadoConversion {
        cajas_padre: cantidad_acumulada / regla.unidades_padre,
        resto_hijo: cantidad_acumulada % regla.unidades_padre,
    }
}

fn buscar_regla<'a>(
    entrada_id: &str,
    item: &ItemConsolidado,
    reglas: &'a HashMap<String, ReglaPadreHijo>,
) -> Option<&'a ReglaPadreHijo> {
    let id_limpio = item.producto_id.trim();
    if !id_limpio.is_empty() {
        if let Some(regla) = reglas.get(id_limpio) {
            return Some(regla);
        }
    }
    let codigo_limpio = item.codigo.trim();
    if !codigo_limpio.is_empty() {
        if let Some(regla) = reglas.get(codigo_limpio) {
            return Some(regla);
        }
    }
    reglas.get(entrada_id.trim())
}

fn buscar_entrada_padre(
    conteos: &BTreeMap<String, ItemConsolidado>,
    padre_id: &str,
) -> Option<String> {
    if let Some((entrada, _)) = conteos
        .iter()
        .find(|(entrada, _)| entrada.as_str() == padre_id)
    {
        return Some(entrada.clone());
    }
    conteos
        .iter()
        .find(|(_, item)| item.producto_id.trim() == padre_id)
        .map(|(entrada, _)| entrada.clone())
}

/// Consolida fracciones acumuladas hacia el articulo padre eliminando el hijo cuando el resto es cero.
pub fn consolidar_mapa_padre_hijo(
    conteos: &mut BTreeMap<String, ItemConsolidado>,
    reglas: &HashMap<String, ReglaPadreHijo>,
) {
    if conteos.is_empty() || reglas.is_empty() {
        return;
    }

    let entradas: Vec<String> = conteos.keys().cloned().collect();
    for entrada in entradas {
        let Some((regla_clonada, conversion)) = conteos.get(&entrada).and_then(|item| {
            let regla = buscar_regla(&entrada, item, reglas)?;
            if !regla_habilitada(regla) {
                return None;
            }
            let padre_id = regla.padre_id.trim();
            if padre_id == entrada.trim() || padre_id == item.producto_id.trim() {
                return None;
            }
            let resultado = aplicar_conversion_padre_hijo(item.cantidad, regla);
            if resultado.cajas_padre <= 0 {
                return None;
            }
            Some((regla.clone(), resultado))
        }) else {
            continue;
        };

        if conversion.resto_hijo > 0 {
            if let Some(item_hijo) = conteos.get_mut(&entrada) {
                item_hijo.cantidad = conversion.resto_hijo;
            }
        } else {
            conteos.remove(&entrada);
        }

        let padre_id = regla_clonada.padre_id.trim().to_string();
        if let Some(entrada_padre) = buscar_entrada_padre(conteos, &padre_id) {
            if let Some(item_padre) = conteos.get_mut(&entrada_padre) {
                item_padre.cantidad = item_padre.cantidad.saturating_add(conversion.cajas_padre);
            }
        } else {
            let codigo_padre = regla_clonada
                .codigo_padre
                .as_deref()
                .map(str::trim)
                .filter(|c| !c.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| padre_id.clone());
            let descripcion_padre = regla_clonada
                .descripcion_padre
                .as_deref()
                .map(str::trim)
                .filter(|d| !d.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("Producto {}", padre_id));

            conteos.insert(
                padre_id.clone(),
                ItemConsolidado {
                    producto_id: padre_id,
                    codigo: codigo_padre,
                    descripcion: descripcion_padre,
                    cantidad: conversion.cajas_padre,
                },
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversion_padre_hijo_exacta_y_con_resto() {
        let regla = ReglaPadreHijo {
            padre_id: String::from("PROD-CAJA-10"),
            unidades_padre: 10,
            codigo_padre: Some(String::from("7790001000109")),
            descripcion_padre: Some(String::from("IBUPROFENO 600MG X 100")),
        };

        let exacta = aplicar_conversion_padre_hijo(30, &regla);
        assert_eq!(
            exacta,
            ResultadoConversion {
                cajas_padre: 3,
                resto_hijo: 0
            }
        );

        let con_resto = aplicar_conversion_padre_hijo(24, &regla);
        assert_eq!(
            con_resto,
            ResultadoConversion {
                cajas_padre: 2,
                resto_hijo: 4
            }
        );

        let insuficiente = aplicar_conversion_padre_hijo(9, &regla);
        assert_eq!(
            insuficiente,
            ResultadoConversion {
                cajas_padre: 0,
                resto_hijo: 9
            }
        );
    }

    #[test]
    fn no_convierte_reglas_invalidas_o_sin_padre() {
        let regla_uno = ReglaPadreHijo {
            padre_id: String::from("PROD-PADRE"),
            unidades_padre: 1,
            codigo_padre: None,
            descripcion_padre: None,
        };
        assert_eq!(
            aplicar_conversion_padre_hijo(12, &regla_uno),
            ResultadoConversion {
                cajas_padre: 0,
                resto_hijo: 12
            }
        );

        let regla_cero = ReglaPadreHijo {
            padre_id: String::from("0"),
            unidades_padre: 10,
            codigo_padre: None,
            descripcion_padre: None,
        };
        assert_eq!(
            aplicar_conversion_padre_hijo(20, &regla_cero),
            ResultadoConversion {
                cajas_padre: 0,
                resto_hijo: 20
            }
        );

        let regla_vacia = ReglaPadreHijo {
            padre_id: String::from("   "),
            unidades_padre: 10,
            codigo_padre: None,
            descripcion_padre: None,
        };
        assert_eq!(
            aplicar_conversion_padre_hijo(20, &regla_vacia),
            ResultadoConversion {
                cajas_padre: 0,
                resto_hijo: 20
            }
        );
    }

    #[test]
    fn consolida_mapa_eliminando_hijo_si_resto_es_cero_y_acumulando_si_hay_resto() {
        let mut conteos = BTreeMap::new();
        conteos.insert(
            String::from("HIJO-EXACTO"),
            ItemConsolidado {
                producto_id: String::from("HIJO-EXACTO"),
                codigo: String::from("7791111111111"),
                descripcion: String::from("BLISTER X 10"),
                cantidad: 20,
            },
        );
        conteos.insert(
            String::from("HIJO-RESTO"),
            ItemConsolidado {
                producto_id: String::from("HIJO-RESTO"),
                codigo: String::from("7792222222222"),
                descripcion: String::from("SOBRE SUELTO"),
                cantidad: 15,
            },
        );
        conteos.insert(
            String::from("PADRE-2"),
            ItemConsolidado {
                producto_id: String::from("PADRE-2"),
                codigo: String::from("7799999999999"),
                descripcion: String::from("CAJA X 6 SOBRES"),
                cantidad: 3,
            },
        );

        let mut reglas = HashMap::new();
        reglas.insert(
            String::from("HIJO-EXACTO"),
            ReglaPadreHijo {
                padre_id: String::from("PADRE-1"),
                unidades_padre: 10,
                codigo_padre: Some(String::from("7798888888888")),
                descripcion_padre: Some(String::from("CAJA X 10 BLISTERS")),
            },
        );
        reglas.insert(
            String::from("HIJO-RESTO"),
            ReglaPadreHijo {
                padre_id: String::from("PADRE-2"),
                unidades_padre: 6,
                codigo_padre: Some(String::from("7799999999999")),
                descripcion_padre: Some(String::from("CAJA X 6 SOBRES")),
            },
        );

        consolidar_mapa_padre_hijo(&mut conteos, &reglas);

        assert_eq!(conteos.get("HIJO-EXACTO"), None);
        let padre_1 = conteos.get("PADRE-1").expect("padre 1 creado");
        assert_eq!(padre_1.cantidad, 2);
        assert_eq!(padre_1.codigo, "7798888888888");
        assert_eq!(padre_1.descripcion, "CAJA X 10 BLISTERS");

        let hijo_resto = conteos.get("HIJO-RESTO").expect("hijo con resto");
        assert_eq!(hijo_resto.cantidad, 3);

        let padre_2 = conteos.get("PADRE-2").expect("padre 2 acumulado");
        assert_eq!(padre_2.cantidad, 5);
    }
}

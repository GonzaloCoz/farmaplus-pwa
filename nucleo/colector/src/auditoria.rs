use std::collections::{BTreeMap, HashSet};

use almacen::{ArticuloPadron, LecturaColector};
use serde::{Deserialize, Serialize};

/// Detalle de un articulo del padron con existencia positiva sin lecturas registradas.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ArticuloNoInventariado {
    pub producto_id: String,
    pub codigo_principal: String,
    pub descripcion: String,
    pub laboratorio: Option<String>,
    pub rubro: Option<String>,
    pub existencia: f64,
    pub costo: f64,
    pub precio: f64,
    pub perdida_costo: f64,
    pub perdida_precio: f64,
}

/// Resumen ejecutivo de cobertura de inventario y valorizacion de faltantes no escaneados.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResumenNoInventariados {
    pub total_con_existencia: usize,
    pub inventariados: usize,
    pub no_inventariados: usize,
    pub cobertura_porcentaje: f64,
    pub unidades_no_inventariadas: f64,
    pub perdida_costo: f64,
    pub perdida_precio: f64,
    pub articulos: Vec<ArticuloNoInventariado>,
}

fn valor_monetario_seguro(valor: f64) -> f64 {
    if valor.is_finite() && valor > 0.0 {
        valor
    } else {
        0.0
    }
}

fn obtener_codigo_principal(articulo: &ArticuloPadron) -> String {
    articulo
        .codigos_barra
        .iter()
        .find(|barra| barra.es_principal && !barra.codigo.trim().is_empty())
        .or_else(|| {
            articulo
                .codigos_barra
                .iter()
                .find(|barra| !barra.codigo.trim().is_empty())
        })
        .map(|barra| barra.codigo.trim().to_string())
        .or_else(|| {
            articulo
                .gtin
                .as_deref()
                .map(str::trim)
                .filter(|g| !g.is_empty())
                .map(str::to_string)
        })
        .unwrap_or_default()
}

/// Detecta articulos del padron con `existencia > 0.0` que no poseen ninguna lectura por `producto_id` ni por ninguno de sus `codigos_barra`.
pub fn detectar_no_inventariados(
    padron: &[ArticuloPadron],
    lecturas: &[LecturaColector],
) -> ResumenNoInventariados {
    let mut ids_contados: HashSet<&str> = HashSet::new();
    let mut codigos_contados: HashSet<&str> = HashSet::new();

    for lectura in lecturas {
        if lectura.cantidad <= 0 {
            continue;
        }
        if let Some(ref pid) = lectura.producto_id {
            let limpio = pid.trim();
            if !limpio.is_empty() {
                ids_contados.insert(limpio);
            }
        }
        let codigo_limpio = lectura.codigo.trim();
        if !codigo_limpio.is_empty() {
            codigos_contados.insert(codigo_limpio);
        }
    }

    let mut total_con_existencia: usize = 0;
    let mut inventariados: usize = 0;
    let mut unidades_no_inventariadas: f64 = 0.0;
    let mut perdida_costo_total: f64 = 0.0;
    let mut perdida_precio_total: f64 = 0.0;
    let mut articulos = Vec::new();

    for articulo in padron {
        if !articulo.existencia.is_finite() || articulo.existencia <= 0.0 {
            continue;
        }
        total_con_existencia += 1;

        let pid_limpio = articulo.producto_id.trim();
        let contado_por_id = !pid_limpio.is_empty() && ids_contados.contains(pid_limpio);
        let contado_por_barra = !contado_por_id
            && articulo.codigos_barra.iter().any(|barra| {
                let c = barra.codigo.trim();
                !c.is_empty() && codigos_contados.contains(c)
            });

        if contado_por_id || contado_por_barra {
            inventariados += 1;
            continue;
        }

        let costo = valor_monetario_seguro(articulo.costo);
        let precio = valor_monetario_seguro(articulo.precio);
        let perdida_costo = articulo.existencia * costo;
        let perdida_precio = articulo.existencia * precio;

        unidades_no_inventariadas += articulo.existencia;
        perdida_costo_total += perdida_costo;
        perdida_precio_total += perdida_precio;

        articulos.push(ArticuloNoInventariado {
            producto_id: articulo.producto_id.clone(),
            codigo_principal: obtener_codigo_principal(articulo),
            descripcion: articulo.descripcion.clone(),
            laboratorio: articulo.laboratorio.clone(),
            rubro: articulo.rubro.clone(),
            existencia: articulo.existencia,
            costo,
            precio,
            perdida_costo,
            perdida_precio,
        });
    }

    articulos.sort_by(|a, b| {
        b.perdida_costo
            .total_cmp(&a.perdida_costo)
            .then_with(|| b.existencia.total_cmp(&a.existencia))
            .then_with(|| a.producto_id.cmp(&b.producto_id))
    });

    let no_inventariados = articulos.len();
    let cobertura_porcentaje = if total_con_existencia > 0 {
        (inventariados as f64 / total_con_existencia as f64) * 100.0
    } else {
        0.0
    };

    ResumenNoInventariados {
        total_con_existencia,
        inventariados,
        no_inventariados,
        cobertura_porcentaje,
        unidades_no_inventariadas,
        perdida_costo: perdida_costo_total,
        perdida_precio: perdida_precio_total,
        articulos,
    }
}

/// Reparte diferencias de inventario en forma equitativa round-robin (`idx % terminales.len()`), disjunta entre terminales.
pub fn repartir_diferencias_recuento<T: Clone>(
    diferencias: &[T],
    terminales: &[String],
) -> BTreeMap<String, Vec<T>> {
    if diferencias.is_empty() || terminales.is_empty() {
        return BTreeMap::new();
    }

    let mut terminales_unicas: Vec<String> = Vec::with_capacity(terminales.len());
    let mut vistas: HashSet<String> = HashSet::with_capacity(terminales.len());
    for terminal in terminales {
        let limpia = terminal.trim();
        if !limpia.is_empty() && vistas.insert(limpia.to_string()) {
            terminales_unicas.push(limpia.to_string());
        }
    }

    if terminales_unicas.is_empty() {
        return BTreeMap::new();
    }

    let mut asignaciones: BTreeMap<String, Vec<T>> = BTreeMap::new();
    for terminal in &terminales_unicas {
        asignaciones.insert(terminal.clone(), Vec::new());
    }

    let cantidad_terminales = terminales_unicas.len();
    for (idx, diferencia) in diferencias.iter().enumerate() {
        let destino = &terminales_unicas[idx % cantidad_terminales];
        if let Some(lista) = asignaciones.get_mut(destino) {
            lista.push(diferencia.clone());
        }
    }

    asignaciones
}

#[cfg(test)]
mod tests {
    use super::*;
    use almacen::CodigoBarra;
    use comun::SucursalId;

    fn crear_articulo(
        producto_id: &str,
        existencia: f64,
        costo: f64,
        precio: f64,
        codigos: Vec<(&str, bool)>,
    ) -> ArticuloPadron {
        ArticuloPadron {
            producto_id: producto_id.to_string(),
            sucursal_id: SucursalId(5),
            troquel: None,
            descripcion: format!("ARTICULO {}", producto_id),
            laboratorio: Some(String::from("ROEMMERS")),
            rubro: Some(String::from("MEDICAMENTOS")),
            subrubro: None,
            existencia,
            costo,
            precio,
            oculto: false,
            trazable: false,
            gtin: None,
            padre_id: None,
            unidades_padre: 1,
            actualizado_en: String::from("2026-11-16T12:00:00Z"),
            codigos_barra: codigos
                .into_iter()
                .map(|(codigo, es_principal)| CodigoBarra {
                    codigo: codigo.to_string(),
                    es_principal,
                })
                .collect(),
        }
    }

    fn crear_lectura(
        id: &str,
        codigo: &str,
        producto_id: Option<&str>,
        cantidad: i64,
    ) -> LecturaColector {
        LecturaColector {
            id: id.to_string(),
            sesion_id: String::from("ses-1"),
            sucursal_id: SucursalId(5),
            codigo: codigo.to_string(),
            producto_id: producto_id.map(str::to_string),
            descripcion: String::from("LECTURA"),
            cantidad,
            ubicacion: String::from("POS:ESP-01"),
            terminal_id: String::from("ZEBRA-01"),
            creado_en: String::from("2026-11-16T12:10:00Z"),
        }
    }

    #[test]
    fn detecta_no_inventariados_respetando_codigos_secundarios_y_calcula_perdidas() {
        let padron = vec![
            crear_articulo(
                "PROD-1",
                5.0,
                100.0,
                200.0,
                vec![("7790001000011", true), ("ALT-0001", false)],
            ),
            crear_articulo("PROD-2", 3.0, 500.0, 900.0, vec![("7790001000022", true)]),
            crear_articulo(
                "PROD-3",
                4.0,
                250.0,
                400.0,
                vec![("7790001000033", true), ("ALT-0003", false)],
            ),
            crear_articulo(
                "PROD-SIN-STOCK",
                0.0,
                1000.0,
                2000.0,
                vec![("7790001000044", true)],
            ),
        ];

        let lecturas = vec![
            // Matchea PROD-1 unicamente por su codigo secundario sin producto_id
            crear_lectura("lec-1", "ALT-0001", None, 2),
            // Matchea PROD-2 directamente por producto_id
            crear_lectura("lec-2", "OTRO-CODIGO", Some("PROD-2"), 1),
            // Lectura en cero no debe marcar PROD-3 como inventariado
            crear_lectura("lec-3", "7790001000033", Some("PROD-3"), 0),
        ];

        let resumen = detectar_no_inventariados(&padron, &lecturas);

        assert_eq!(resumen.total_con_existencia, 3);
        assert_eq!(resumen.inventariados, 2);
        assert_eq!(resumen.no_inventariados, 1);
        assert!((resumen.cobertura_porcentaje - (200.0 / 3.0)).abs() < 1e-6);
        assert!((resumen.unidades_no_inventariadas - 4.0).abs() < 1e-9);
        assert!((resumen.perdida_costo - 1000.0).abs() < 1e-9);
        assert!((resumen.perdida_precio - 1600.0).abs() < 1e-9);

        assert_eq!(resumen.articulos.len(), 1);
        assert_eq!(resumen.articulos[0].producto_id, "PROD-3");
        assert_eq!(resumen.articulos[0].codigo_principal, "7790001000033");
    }

    #[test]
    fn reparte_diferencias_round_robin_disjunto_y_equitativo() {
        let diferencias = vec![
            String::from("D1"),
            String::from("D2"),
            String::from("D3"),
            String::from("D4"),
            String::from("D5"),
            String::from("D6"),
            String::from("D7"),
        ];
        let terminales = vec![
            String::from("ZEBRA-01"),
            String::from("ZEBRA-02"),
            String::from("WEB-01"),
        ];

        let reparto = repartir_diferencias_recuento(&diferencias, &terminales);
        assert_eq!(
            reparto.get("ZEBRA-01"),
            Some(&vec![
                String::from("D1"),
                String::from("D4"),
                String::from("D7")
            ])
        );
        assert_eq!(
            reparto.get("ZEBRA-02"),
            Some(&vec![String::from("D2"), String::from("D5")])
        );
        assert_eq!(
            reparto.get("WEB-01"),
            Some(&vec![String::from("D3"), String::from("D6")])
        );

        let mut union = HashSet::new();
        let mut total_asignados = 0usize;
        for lista in reparto.values() {
            for item in lista {
                assert!(
                    union.insert(item.clone()),
                    "elemento duplicado entre terminales"
                );
                total_asignados += 1;
            }
        }
        assert_eq!(total_asignados, diferencias.len());

        assert!(repartir_diferencias_recuento(&diferencias, &[]).is_empty());
        assert!(repartir_diferencias_recuento::<String>(&[], &terminales).is_empty());
    }
}

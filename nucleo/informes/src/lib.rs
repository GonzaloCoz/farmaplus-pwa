//! Generacion de lotes estandar, exportacion tabular segura y maquetado A4 de laminas QR.

use std::fmt::Write;

use almacen::LecturaColector;
use serde::{Deserialize, Serialize};

/// Ancho total de hoja A4 vertical en milimetros.
pub const ANCHO_A4_MM: f32 = 210.0;
/// Alto total de hoja A4 vertical en milimetros.
pub const ALTO_A4_MM: f32 = 297.0;
/// Margen uniforme en los cuatro bordes de la hoja A4 en milimetros.
pub const MARGEN_A4_MM: f32 = 10.0;
/// Separacion horizontal y vertical entre tarjetas QR en milimetros.
pub const SEPARACION_A4_MM: f32 = 5.0;
/// Cantidad de columnas por lamina A4.
pub const COLUMNAS_A4: usize = 2;
/// Cantidad de filas por lamina A4.
pub const FILAS_A4: usize = 4;
/// Cantidad maxima de tarjetas QR por hoja A4.
pub const ETIQUETAS_POR_PAGINA_A4: usize = COLUMNAS_A4 * FILAS_A4;

/// Renglon de conteo o baja para archivos planos de intercambio local.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenglonSalidaLocal {
    pub producto_id: Option<String>,
    pub codigo: String,
    pub cantidad: i64,
}

impl From<&LecturaColector> for RenglonSalidaLocal {
    fn from(lectura: &LecturaColector) -> Self {
        Self {
            producto_id: lectura.producto_id.clone(),
            codigo: lectura.codigo.clone(),
            cantidad: lectura.cantidad,
        }
    }
}

/// Datos de una etiqueta QR de ubicacion fisica en sucursal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EtiquetaQrUbicacion {
    pub codigo_ubicacion: String,
    pub titulo: String,
    pub subtitulo: Option<String>,
}

/// Tarjeta maquetada con coordenadas exactas en milimetros sobre una hoja A4.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TarjetaQrA4 {
    pub pagina: usize,
    pub fila: usize,
    pub columna: usize,
    pub x_mm: f32,
    pub y_mm: f32,
    pub ancho_mm: f32,
    pub alto_mm: f32,
    pub etiqueta: EtiquetaQrUbicacion,
}

/// Formatea un lote de lecturas de colector en formato `ID;CODIGO;CANTIDAD;0` separado por `\r\n`.
pub fn formatear_lote_colector(renglones: &[RenglonSalidaLocal]) -> String {
    formatear_renglones_salida(renglones, true)
}

/// Formatea bajas de productos no inventariados en formato `ID;CODIGO;0;0` separado por `\r\n`.
pub fn formatear_bajas_no_inventariados(renglones: &[RenglonSalidaLocal]) -> String {
    formatear_renglones_salida(renglones, false)
}

fn formatear_renglones_salida(renglones: &[RenglonSalidaLocal], incluir_cantidad: bool) -> String {
    let mut salida = String::new();
    for (indice, renglon) in renglones.iter().enumerate() {
        if indice > 0 {
            salida.push_str("\r\n");
        }
        let codigo_limpio = limpiar_campo_lote(&renglon.codigo);
        let id_resuelto = renglon
            .producto_id
            .as_deref()
            .map(limpiar_campo_lote)
            .filter(|id| !id.is_empty())
            .unwrap_or_else(|| codigo_limpio.clone());
        let cantidad = if incluir_cantidad {
            renglon.cantidad
        } else {
            0
        };
        let _ = write!(salida, "{id_resuelto};{codigo_limpio};{cantidad};0");
    }
    salida
}

fn limpiar_campo_lote(valor: &str) -> String {
    valor
        .chars()
        .filter(|caracter| !matches!(caracter, ';' | '\r' | '\n'))
        .collect::<String>()
        .trim()
        .to_owned()
}

/// Exporta encabezados y filas a CSV separado por `;` con mitigacion de inyeccion de formulas.
pub fn exportar_csv_auditoria(encabezados: &[&str], filas: &[Vec<String>]) -> String {
    let mut lineas = Vec::with_capacity(filas.len() + usize::from(!encabezados.is_empty()));

    if !encabezados.is_empty() {
        let linea_encabezado = encabezados
            .iter()
            .map(|celda| formatear_celda_csv(celda))
            .collect::<Vec<_>>()
            .join(";");
        lineas.push(linea_encabezado);
    }

    for fila in filas {
        let linea_fila = fila
            .iter()
            .map(|celda| formatear_celda_csv(celda))
            .collect::<Vec<_>>()
            .join(";");
        lineas.push(linea_fila);
    }

    lineas.join("\n")
}

fn formatear_celda_csv(valor: &str) -> String {
    let normalizada = valor.replace("\r\n", " ").replace(['\r', '\n'], " ");

    let requiere_apostrofe = requiere_proteccion_formula(valor, &normalizada);
    let mut segura = String::with_capacity(normalizada.len() + usize::from(requiere_apostrofe));
    if requiere_apostrofe {
        segura.push('\'');
    }
    segura.push_str(&normalizada);

    if segura.contains([';', '"']) {
        let escapada = segura.replace('"', "\"\"");
        format!("\"{escapada}\"")
    } else {
        segura
    }
}

fn requiere_proteccion_formula(crudo: &str, normalizada: &str) -> bool {
    if crudo.starts_with(['\t', '\r']) || normalizada.starts_with('\t') {
        return true;
    }

    // Preserva numeros negativos puros (ej. -15 o -12.50) usados en columnas de diferencia.
    if es_numero_negativo_puro(normalizada) {
        return false;
    }

    normalizada.trim_start().starts_with(['=', '+', '-', '@'])
}

fn es_numero_negativo_puro(valor: &str) -> bool {
    let Some(resto) = valor.strip_prefix('-') else {
        return false;
    };
    if resto.is_empty() {
        return false;
    }
    match resto.split_once('.') {
        Some((entero, decimal)) => {
            !entero.is_empty()
                && !decimal.is_empty()
                && entero.bytes().all(|b| b.is_ascii_digit())
                && decimal.bytes().all(|b| b.is_ascii_digit())
        }
        None => resto.bytes().all(|b| b.is_ascii_digit()),
    }
}

/// Distribuye etiquetas QR en hojas A4 de 2 columnas por 4 filas con margenes de 10.0 mm.
pub fn distribuir_laminas_qr_a4(etiquetas: &[EtiquetaQrUbicacion]) -> Vec<TarjetaQrA4> {
    let ancho_util = ANCHO_A4_MM - 2.0 * MARGEN_A4_MM;
    let alto_util = ALTO_A4_MM - 2.0 * MARGEN_A4_MM;
    let ancho_tarjeta =
        (ancho_util - SEPARACION_A4_MM * (COLUMNAS_A4 as f32 - 1.0)) / COLUMNAS_A4 as f32;
    let alto_tarjeta = (alto_util - SEPARACION_A4_MM * (FILAS_A4 as f32 - 1.0)) / FILAS_A4 as f32;

    etiquetas
        .iter()
        .enumerate()
        .map(|(indice, etiqueta)| {
            let pagina = indice / ETIQUETAS_POR_PAGINA_A4;
            let posicion_pagina = indice % ETIQUETAS_POR_PAGINA_A4;
            let fila = posicion_pagina / COLUMNAS_A4;
            let columna = posicion_pagina % COLUMNAS_A4;
            let x_mm = MARGEN_A4_MM + (columna as f32) * (ancho_tarjeta + SEPARACION_A4_MM);
            let y_mm = MARGEN_A4_MM + (fila as f32) * (alto_tarjeta + SEPARACION_A4_MM);

            TarjetaQrA4 {
                pagina,
                fila,
                columna,
                x_mm,
                y_mm,
                ancho_mm: ancho_tarjeta,
                alto_mm: alto_tarjeta,
                etiqueta: etiqueta.clone(),
            }
        })
        .collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use comun::SucursalId;

    #[test]
    fn lote_colector_resuelve_id_y_limpia_delimitadores() {
        let renglones = vec![
            RenglonSalidaLocal {
                producto_id: Some(" 1045 ".to_owned()),
                codigo: "7791234567890".to_owned(),
                cantidad: 8,
            },
            RenglonSalidaLocal {
                producto_id: None,
                codigo: "7790001;00002\r\n".to_owned(),
                cantidad: 3,
            },
            RenglonSalidaLocal {
                producto_id: Some(" ;\n\r ".to_owned()),
                codigo: "7799999000011".to_owned(),
                cantidad: 15,
            },
            RenglonSalidaLocal {
                producto_id: Some("ID;77\n".to_owned()),
                codigo: "7795555111222".to_owned(),
                cantidad: 1,
            },
        ];

        let salida = formatear_lote_colector(&renglones);
        assert_eq!(
            salida,
            "1045;7791234567890;8;0\r\n779000100002;779000100002;3;0\r\n7799999000011;7799999000011;15;0\r\nID77;7795555111222;1;0"
        );
        assert_eq!(formatear_lote_colector(&[]), "");
    }

    #[test]
    fn bajas_no_inventariados_fuerza_cantidades_en_cero_y_convierte_lectura() {
        let lectura = LecturaColector {
            id: "lec-1".to_owned(),
            sesion_id: "ses-1".to_owned(),
            sucursal_id: SucursalId(5),
            codigo: "7798888777666".to_owned(),
            producto_id: Some("9021".to_owned()),
            descripcion: "Producto muestra".to_owned(),
            cantidad: 24,
            ubicacion: "POS:GON-01".to_owned(),
            terminal_id: "TERM-01".to_owned(),
            creado_en: "2026-11-16T10:00:00Z".to_owned(),
        };

        let renglones = vec![
            RenglonSalidaLocal::from(&lectura),
            RenglonSalidaLocal {
                producto_id: None,
                codigo: "7791111222333".to_owned(),
                cantidad: 99,
            },
        ];

        let salida = formatear_bajas_no_inventariados(&renglones);
        assert_eq!(
            salida,
            "9021;7798888777666;0;0\r\n7791111222333;7791111222333;0;0"
        );
    }

    /// Regla documentada de prevencion de inyeccion de formulas en CSV:
    /// Se antepone `'` cuando la celda cruda comienza con `\t` o `\r`, o cuando
    /// su texto normalizado (sin saltos ni espacios iniciales) comienza con `=`, `+`, `-` o `@`,
    /// exceptuando unicamente numeros negativos decimales puros (`-15`, `-12.50`).
    #[test]
    fn csv_auditoria_protege_contra_inyeccion_de_formulas_y_preserva_negativos_puros() {
        let encabezados = [
            "Producto",
            "FormulaEq",
            "FormulaMas",
            "FormulaArroba",
            "Diferencia",
        ];
        let filas = vec![
            vec![
                "=CMD('calc')".to_owned(),
                "+1+1".to_owned(),
                "@SUM(A1:A5)".to_owned(),
                "-1+1".to_owned(),
                "-15".to_owned(),
            ],
            vec![
                "\t=2+2".to_owned(),
                "\r=3+3".to_owned(),
                "  =4+4".to_owned(),
                "-CMD".to_owned(),
                "-12.50".to_owned(),
            ],
        ];

        let csv = exportar_csv_auditoria(&encabezados, &filas);
        let lineas: Vec<&str> = csv.split('\n').collect();
        assert_eq!(lineas.len(), 3);
        assert_eq!(
            lineas[0],
            "Producto;FormulaEq;FormulaMas;FormulaArroba;Diferencia"
        );
        assert_eq!(lineas[1], "'=CMD('calc');'+1+1;'@SUM(A1:A5);'-1+1;-15");
        assert_eq!(lineas[2], "'\t=2+2;' =3+3;'  =4+4;'-CMD;-12.50");
    }

    #[test]
    fn csv_auditoria_escapa_comillas_delimitadores_y_saltos_de_linea() {
        let encabezados = ["Codigo", "Detalle \"Oficial\"", "Observacion"];
        let filas = vec![vec![
            "779;001".to_owned(),
            "Jarabe \"Infantil\"\r\n200ml".to_owned(),
            "=CMD(\"a;b\")\nfin".to_owned(),
        ]];

        let csv = exportar_csv_auditoria(&encabezados, &filas);
        assert!(!csv.contains('\r'));
        let lineas: Vec<&str> = csv.split('\n').collect();
        assert_eq!(lineas.len(), 2);
        assert_eq!(lineas[0], "Codigo;\"Detalle \"\"Oficial\"\"\";Observacion");
        assert_eq!(
            lineas[1],
            "\"779;001\";\"Jarabe \"\"Infantil\"\" 200ml\";\"'=CMD(\"\"a;b\"\") fin\""
        );
    }

    #[test]
    fn laminas_qr_a4_pagina_18_etiquetas_sin_solapamiento_dentro_de_margenes() {
        let etiquetas: Vec<EtiquetaQrUbicacion> = (1..=18)
            .map(|n| EtiquetaQrUbicacion {
                codigo_ubicacion: format!("POS:GON-{n:02}"),
                titulo: format!("Gondola {n:02}"),
                subtitulo: Some(format!("Sector {n}")),
            })
            .collect();

        let tarjetas = distribuir_laminas_qr_a4(&etiquetas);
        assert_eq!(tarjetas.len(), 18);
        assert!(distribuir_laminas_qr_a4(&[]).is_empty());

        for (indice, tarjeta) in tarjetas.iter().enumerate() {
            assert_eq!(tarjeta.pagina, indice / 8);
            assert_eq!(tarjeta.fila, (indice % 8) / 2);
            assert_eq!(tarjeta.columna, indice % 2);
            assert!(tarjeta.x_mm >= 10.0);
            assert!(tarjeta.x_mm + tarjeta.ancho_mm <= 200.0);
            assert!(tarjeta.y_mm >= 10.0);
            assert!(tarjeta.y_mm + tarjeta.alto_mm <= 287.0);
            assert!(tarjeta.ancho_mm > 0.0);
            assert!(tarjeta.alto_mm > 0.0);
        }

        // Verifica coordenadas exactas para 2x4 con margenes de 10.0 mm y separacion de 5.0 mm.
        assert_eq!(tarjetas[0].ancho_mm, 92.5);
        assert_eq!(tarjetas[0].alto_mm, 65.5);
        assert_eq!(tarjetas[0].x_mm, 10.0);
        assert_eq!(tarjetas[0].y_mm, 10.0);
        assert_eq!(tarjetas[7].pagina, 0);
        assert_eq!(tarjetas[7].fila, 3);
        assert_eq!(tarjetas[7].columna, 1);
        assert_eq!(tarjetas[7].x_mm, 107.5);
        assert_eq!(tarjetas[7].y_mm, 221.5);
        assert_eq!(tarjetas[7].x_mm + tarjetas[7].ancho_mm, 200.0);
        assert_eq!(tarjetas[7].y_mm + tarjetas[7].alto_mm, 287.0);

        // Verifica que ultima tarjeta caiga en pagina 2, fila 0, columna 1.
        let ultima = tarjetas.last().expect("debe existir la ultima tarjeta");
        assert_eq!(ultima.pagina, 2);
        assert_eq!(ultima.fila, 0);
        assert_eq!(ultima.columna, 1);

        // Verifica ausencia de solapamiento entre tarjetas de la misma pagina.
        for i in 0..tarjetas.len() {
            for j in (i + 1)..tarjetas.len() {
                if tarjetas[i].pagina != tarjetas[j].pagina {
                    continue;
                }
                let a = &tarjetas[i];
                let b = &tarjetas[j];
                let separadas_x = a.x_mm + a.ancho_mm <= b.x_mm || b.x_mm + b.ancho_mm <= a.x_mm;
                let separadas_y = a.y_mm + a.alto_mm <= b.y_mm || b.y_mm + b.alto_mm <= a.y_mm;
                assert!(separadas_x || separadas_y);
            }
        }
    }

    #[test]
    fn csv_auditoria_casos_borde_negativos_no_puros_y_entradas_vacias() {
        assert_eq!(exportar_csv_auditoria(&[], &[]), "");
        assert_eq!(exportar_csv_auditoria(&["ColA", "ColB"], &[]), "ColA;ColB");

        let filas = vec![vec![
            "-".to_owned(),
            "-.".to_owned(),
            "-15.".to_owned(),
            "-1e5".to_owned(),
            "-0".to_owned(),
            "  Producto normal".to_owned(),
        ]];
        let csv = exportar_csv_auditoria(&[], &filas);
        assert_eq!(csv, "'-;'-.;'-15.;'-1e5;-0;  Producto normal");
    }
}

use almacen::SerieTrazable;
use comun::ErrorNucleo;
use serde::{Deserialize, Serialize};

const SEPARADOR_GS: char = '\x1d';

/// Datos decodificados desde una lectura GS1 DataMatrix o cadena con identificadores de aplicacion ANMAT.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DatosGs1Anmat {
    pub es_datamatrix: bool,
    pub gtin: Option<String>,
    pub codigo_ean13: Option<String>,
    pub vencimiento: Option<String>,
    pub lote: Option<String>,
    pub serie: Option<String>,
    pub texto_crudo: String,
}

impl DatosGs1Anmat {
    /// Convierte la lectura analizada en una entidad `SerieTrazable` lista para persistir en almacen local.
    pub fn a_serie_trazable(
        &self,
        id: String,
        sesion_id: String,
        producto_id: String,
        sin_matriz: bool,
    ) -> Result<SerieTrazable, ErrorNucleo> {
        let gtin = self
            .gtin
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .ok_or(ErrorNucleo::IntegridadInvalida)?
            .to_string();
        let serie = self
            .serie
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .ok_or(ErrorNucleo::IntegridadInvalida)?
            .to_string();

        Ok(SerieTrazable {
            id,
            sesion_id,
            producto_id,
            gtin,
            serie,
            lote: self.lote.clone(),
            vencimiento: self.vencimiento.clone(),
            sin_matriz,
        })
    }
}

/// Determina heuristicamente si una lectura corresponde a un codigo compuesto GS1 DataMatrix.
pub fn es_posible_datamatrix(lectura: &str) -> bool {
    let s = lectura.trim();
    if s.is_empty() {
        return false;
    }
    if s.starts_with("]d2") || s.starts_with("]Q3") || s.starts_with("]C1") {
        return true;
    }
    if s.contains(SEPARADOR_GS) {
        return true;
    }
    if s.starts_with("(01)") || (s.contains("(01)") && s.contains("(21)")) {
        return true;
    }
    if s.contains('(')
        && s.contains(')')
        && (s.contains("(01)") || s.contains("(21)") || s.contains("(17)") || s.contains("(10)"))
    {
        return true;
    }
    if s.starts_with("01")
        && s.chars().count() >= 18
        && (s.contains("21") || s.contains("17") || s.contains("10"))
    {
        return true;
    }
    false
}

/// Analiza una lectura GS1 DataMatrix ANMAT soportando prefijos AIM (`]d2`, `]Q3`, `]C1`), parentesis y separador ASCII 29 (`\x1d`).
pub fn analizar_datamatrix_gs1(lectura: &str) -> DatosGs1Anmat {
    let texto_crudo = lectura.to_string();
    let mut datos = lectura.trim();
    if datos.is_empty() || !es_posible_datamatrix(datos) {
        return DatosGs1Anmat {
            es_datamatrix: false,
            gtin: None,
            codigo_ean13: None,
            vencimiento: None,
            lote: None,
            serie: None,
            texto_crudo,
        };
    }

    if datos.starts_with("]d2") || datos.starts_with("]Q3") || datos.starts_with("]C1") {
        datos = &datos[3..];
    }

    let mut gtin: Option<String> = None;
    let mut serie: Option<String> = None;
    let mut lote: Option<String> = None;
    let mut vencimiento_crudo: Option<String> = None;

    if datos.contains('(') && datos.contains(')') {
        extraer_con_parentesis(
            datos,
            &mut gtin,
            &mut serie,
            &mut lote,
            &mut vencimiento_crudo,
        );
    } else {
        extraer_flujo_continuo(
            datos,
            &mut gtin,
            &mut serie,
            &mut lote,
            &mut vencimiento_crudo,
        );
    }

    let vencimiento = vencimiento_crudo
        .as_deref()
        .and_then(formatear_y_validar_fecha_gs1);
    let codigo_ean13 = gtin.as_deref().and_then(deducir_ean13);

    let gtin_valido = gtin.as_deref().is_some_and(|g| g.chars().count() >= 8);
    let serie_valida = serie.as_deref().is_some_and(|s| s.chars().count() >= 3);
    let es_datamatrix = gtin_valido || serie_valida;

    DatosGs1Anmat {
        es_datamatrix,
        gtin,
        codigo_ean13,
        vencimiento,
        lote,
        serie,
        texto_crudo,
    }
}

fn extraer_con_parentesis(
    datos: &str,
    gtin: &mut Option<String>,
    serie: &mut Option<String>,
    lote: &mut Option<String>,
    vencimiento: &mut Option<String>,
) {
    let caracteres: Vec<char> = datos.chars().collect();
    let total = caracteres.len();
    let mut idx = 0;

    while idx < total {
        if caracteres[idx] != '(' {
            idx += 1;
            continue;
        }

        let ai_inicio = idx + 1;
        let mut ai_fin = ai_inicio;
        while ai_fin < total && caracteres[ai_fin].is_ascii_digit() && ai_fin - ai_inicio < 4 {
            ai_fin += 1;
        }
        let longitud_ai = ai_fin - ai_inicio;

        if (2..=4).contains(&longitud_ai) && ai_fin < total && caracteres[ai_fin] == ')' {
            let val_inicio = ai_fin + 1;
            let mut val_fin = val_inicio;
            while val_fin < total && caracteres[val_fin] != '(' && caracteres[val_fin] != ')' {
                val_fin += 1;
            }
            if val_fin > val_inicio {
                let ai: String = caracteres[ai_inicio..ai_fin].iter().collect();
                let valor_raw: String = caracteres[val_inicio..val_fin].iter().collect();
                let valor = valor_raw.trim_matches(SEPARADOR_GS).to_string();
                if !valor.is_empty() {
                    match ai.as_str() {
                        "01" => *gtin = Some(valor),
                        "21" => *serie = Some(valor),
                        "10" => *lote = Some(valor),
                        "17" => *vencimiento = Some(valor),
                        _ => {}
                    }
                }
                idx = val_fin;
                continue;
            }
        }

        idx += 1;
    }
}

fn extraer_flujo_continuo(
    datos: &str,
    gtin: &mut Option<String>,
    serie: &mut Option<String>,
    lote: &mut Option<String>,
    vencimiento: &mut Option<String>,
) {
    let caracteres: Vec<char> = datos.chars().collect();
    let total = caracteres.len();
    let mut idx = 0;

    while idx < total {
        if caracteres[idx] == SEPARADOR_GS {
            idx += 1;
            continue;
        }

        if idx + 2 <= total {
            let ai0 = caracteres[idx];
            let ai1 = caracteres[idx + 1];

            if ai0 == '0'
                && ai1 == '1'
                && idx + 16 <= total
                && caracteres[idx + 2..idx + 16]
                    .iter()
                    .all(|c| c.is_ascii_digit())
            {
                let valor: String = caracteres[idx + 2..idx + 16].iter().collect();
                *gtin = Some(valor);
                idx += 16;
                continue;
            }

            if ai0 == '1'
                && ai1 == '7'
                && idx + 8 <= total
                && caracteres[idx + 2..idx + 8]
                    .iter()
                    .all(|c| c.is_ascii_digit())
            {
                let valor: String = caracteres[idx + 2..idx + 8].iter().collect();
                *vencimiento = Some(valor);
                idx += 8;
                continue;
            }

            if ai0 == '1'
                && ai1 == '1'
                && idx + 8 <= total
                && caracteres[idx + 2..idx + 8]
                    .iter()
                    .all(|c| c.is_ascii_digit())
            {
                idx += 8;
                continue;
            }

            if (ai0 == '1' && ai1 == '0') || (ai0 == '2' && ai1 == '1') {
                let val_inicio = idx + 2;
                let mut val_fin = val_inicio;
                while val_fin < total && caracteres[val_fin] != SEPARADOR_GS {
                    if val_fin - val_inicio >= 20 {
                        break;
                    }
                    val_fin += 1;
                }
                let valor: String = caracteres[val_inicio..val_fin].iter().collect();
                if !valor.is_empty() {
                    if ai0 == '1' && ai1 == '0' {
                        *lote = Some(valor);
                    } else {
                        *serie = Some(valor);
                    }
                }
                idx = val_fin;
                continue;
            }
        }

        idx += 1;
    }
}

fn formatear_y_validar_fecha_gs1(fecha: &str) -> Option<String> {
    let limpia = fecha.trim();
    if limpia.len() != 6 || !limpia.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }

    let yy: u32 = limpia[0..2].parse().ok()?;
    let mm: u32 = limpia[2..4].parse().ok()?;
    let dd: u32 = limpia[4..6].parse().ok()?;

    if !(1..=12).contains(&mm) {
        return None;
    }

    let siglo = if yy < 70 { 2000 } else { 1900 };
    let anio = siglo + yy;
    let dias_max = dias_en_mes(anio, mm);
    if !(1..=dias_max).contains(&dd) {
        return None;
    }

    Some(format!("{:04}-{:02}-{:02}", anio, mm, dd))
}

fn dias_en_mes(anio: u32, mes: u32) -> u32 {
    match mes {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            let es_bisiesto = (anio % 4 == 0 && anio % 100 != 0) || (anio % 400 == 0);
            if es_bisiesto {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

fn deducir_ean13(gtin: &str) -> Option<String> {
    let limpio = gtin.trim();
    if !limpio.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if limpio.len() == 14 && limpio.starts_with('0') {
        return Some(limpio[1..].to_string());
    }
    if limpio.len() == 13 {
        return Some(limpio.to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analiza_datamatrix_crudo_con_separador_gs_y_prefijo_d2() {
        let crudo = "]d201077900010000141728053110LOTE99\x1d21SERIE12345";
        let datos = analizar_datamatrix_gs1(crudo);

        assert!(datos.es_datamatrix);
        assert_eq!(datos.gtin.as_deref(), Some("07790001000014"));
        assert_eq!(datos.codigo_ean13.as_deref(), Some("7790001000014"));
        assert_eq!(datos.vencimiento.as_deref(), Some("2028-05-31"));
        assert_eq!(datos.lote.as_deref(), Some("LOTE99"));
        assert_eq!(datos.serie.as_deref(), Some("SERIE12345"));
        assert_eq!(datos.texto_crudo, crudo);

        let trazable = datos
            .a_serie_trazable(
                String::from("ser-1"),
                String::from("ses-1"),
                String::from("PROD-1"),
                false,
            )
            .expect("conversion a serie trazable");
        assert_eq!(trazable.gtin, "07790001000014");
        assert_eq!(trazable.serie, "SERIE12345");
    }

    #[test]
    fn analiza_datamatrix_con_parentesis_y_gtin_no_ean13() {
        let entrada = "]Q3(01)17791234567892(17)240229(10)L-402(21)SN998877";
        let datos = analizar_datamatrix_gs1(entrada);

        assert!(datos.es_datamatrix);
        assert_eq!(datos.gtin.as_deref(), Some("17791234567892"));
        assert_eq!(datos.codigo_ean13, None);
        assert_eq!(datos.vencimiento.as_deref(), Some("2024-02-29"));
        assert_eq!(datos.lote.as_deref(), Some("L-402"));
        assert_eq!(datos.serie.as_deref(), Some("SN998877"));
    }

    #[test]
    fn rechaza_fecha_gs1_con_mes_o_dia_invalido_y_no_confunde_ean_comun() {
        let fecha_mes_invalido = "(01)07790001000014(17)261315(10)L1(21)S123";
        let parsed_mes = analizar_datamatrix_gs1(fecha_mes_invalido);
        assert!(parsed_mes.es_datamatrix);
        assert_eq!(parsed_mes.vencimiento, None);

        let fecha_febrero_invalido = "]C101077900010000141725022921SERIE77\x1d10LOT1";
        let parsed_feb = analizar_datamatrix_gs1(fecha_febrero_invalido);
        assert!(parsed_feb.es_datamatrix);
        assert_eq!(parsed_feb.vencimiento, None);
        assert_eq!(parsed_feb.serie.as_deref(), Some("SERIE77"));
        assert_eq!(parsed_feb.lote.as_deref(), Some("LOT1"));

        let ean_comun = analizar_datamatrix_gs1("7792100012345");
        assert!(!ean_comun.es_datamatrix);
        assert_eq!(ean_comun.gtin, None);
        assert_eq!(ean_comun.serie, None);
    }
}

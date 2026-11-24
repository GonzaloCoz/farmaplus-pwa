use std::collections::HashSet;

use serde::{Deserialize, Serialize};

/// Prefijos oficiales de sectores fisicos de sucursal para etiquetas QR de ubicacion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PrefijoSector {
    Gon,
    Esp,
    Hela,
    Caj,
    Mos,
    Dep,
}

impl PrefijoSector {
    /// Devuelve la sigla canonica en mayusculas usada en codigos de ubicacion.
    pub const fn codigo(&self) -> &'static str {
        match self {
            Self::Gon => "GON",
            Self::Esp => "ESP",
            Self::Hela => "HELA",
            Self::Caj => "CAJ",
            Self::Mos => "MOS",
            Self::Dep => "DEP",
        }
    }
}

/// Esquema de caras disponibles por cada modulo o mueble fisico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EsquemaCaras {
    Ninguna,
    AB,
    AC,
    AD,
}

impl EsquemaCaras {
    /// Lista ordenada de sufijos de cara para el esquema seleccionado.
    pub const fn caras(&self) -> &'static [&'static str] {
        match self {
            Self::Ninguna => &[],
            Self::AB => &["A", "B"],
            Self::AC => &["A", "B", "C"],
            Self::AD => &["A", "B", "C", "D"],
        }
    }
}

/// Configuracion de un rango correlativo de muebles y sus caras para generar codigos QR.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GrupoMueblesQr {
    pub prefijo: PrefijoSector,
    pub desde: u16,
    pub hasta: u16,
    pub caras: EsquemaCaras,
    pub excluidos: Vec<String>,
}

fn normalizar_etiqueta_exclusion(etiqueta: &str) -> String {
    let limpia = etiqueta.trim().to_ascii_uppercase();
    limpia
        .strip_prefix("POS:")
        .unwrap_or(&limpia)
        .trim()
        .to_string()
}

/// Expande grupos de muebles en codigos `POS:{PREFIJO}-{NUM:02}[-{CARA}]` respetando exclusiones y sin duplicados.
pub fn expandir_ubicaciones_qr(grupos: &[GrupoMueblesQr]) -> Vec<String> {
    let mut resultado = Vec::new();
    let mut vistos = HashSet::new();

    for grupo in grupos {
        let inicio = grupo.desde.max(1);
        if inicio > grupo.hasta {
            continue;
        }

        let prefijo = grupo.prefijo.codigo();
        let caras = grupo.caras.caras();
        let excluidos: HashSet<String> = grupo
            .excluidos
            .iter()
            .map(|e| normalizar_etiqueta_exclusion(e))
            .filter(|e| !e.is_empty())
            .collect();

        for num in inicio..=grupo.hasta {
            let etiqueta_base = format!("{}-{:02}", prefijo, num);
            if excluidos.contains(&etiqueta_base) {
                continue;
            }

            if caras.is_empty() {
                let codigo_qr = format!("POS:{}", etiqueta_base);
                if vistos.insert(codigo_qr.clone()) {
                    resultado.push(codigo_qr);
                }
            } else {
                for cara in caras {
                    let etiqueta_cara = format!("{}-{}", etiqueta_base, cara);
                    if excluidos.contains(&etiqueta_cara) {
                        continue;
                    }
                    let codigo_qr = format!("POS:{}", etiqueta_cara);
                    if vistos.insert(codigo_qr.clone()) {
                        resultado.push(codigo_qr);
                    }
                }
            }
        }
    }

    resultado
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expande_ubicaciones_qr_con_caras_exclusiones_y_sin_duplicados() {
        let grupos = vec![
            GrupoMueblesQr {
                prefijo: PrefijoSector::Gon,
                desde: 1,
                hasta: 2,
                caras: EsquemaCaras::AB,
                excluidos: vec![String::from("GON-01-B"), String::from("pos:gon-02-a")],
            },
            GrupoMueblesQr {
                prefijo: PrefijoSector::Gon,
                desde: 2,
                hasta: 2,
                caras: EsquemaCaras::AB,
                excluidos: Vec::new(),
            },
            GrupoMueblesQr {
                prefijo: PrefijoSector::Hela,
                desde: 1,
                hasta: 2,
                caras: EsquemaCaras::Ninguna,
                excluidos: vec![String::from("HELA-02")],
            },
            GrupoMueblesQr {
                prefijo: PrefijoSector::Esp,
                desde: 5,
                hasta: 3,
                caras: EsquemaCaras::AD,
                excluidos: Vec::new(),
            },
        ];

        let codigos = expandir_ubicaciones_qr(&grupos);
        assert_eq!(
            codigos,
            vec![
                String::from("POS:GON-01-A"),
                String::from("POS:GON-02-B"),
                String::from("POS:GON-02-A"),
                String::from("POS:HELA-01"),
            ]
        );
    }

    #[test]
    fn deduplica_codigos_repetidos_entre_grupos_solapados() {
        let grupos = vec![
            GrupoMueblesQr {
                prefijo: PrefijoSector::Dep,
                desde: 1,
                hasta: 2,
                caras: EsquemaCaras::AC,
                excluidos: Vec::new(),
            },
            GrupoMueblesQr {
                prefijo: PrefijoSector::Dep,
                desde: 2,
                hasta: 3,
                caras: EsquemaCaras::AC,
                excluidos: vec![String::from("DEP-03")],
            },
        ];

        let codigos = expandir_ubicaciones_qr(&grupos);
        assert_eq!(
            codigos,
            vec![
                String::from("POS:DEP-01-A"),
                String::from("POS:DEP-01-B"),
                String::from("POS:DEP-01-C"),
                String::from("POS:DEP-02-A"),
                String::from("POS:DEP-02-B"),
                String::from("POS:DEP-02-C"),
            ]
        );
    }
}

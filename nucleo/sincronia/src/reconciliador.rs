use std::collections::BTreeMap;

use almacen::ArticuloPadron;
use trama::ArbolIntegridad;

const DOMINIO_RAMA_LABORATORIO: &[u8] = b"MIPLUS_PADRON_LAB_1";
const LABORATORIO_VACIO: &str = "SIN_LABORATORIO";

/// Construye y compara arboles Merkle BLAKE3 particionados por laboratorio de farmacia.
#[derive(Debug, Clone, Copy, Default)]
pub struct ReconciliadorPadron;

impl ReconciliadorPadron {
    /// Agrupa el padron por laboratorio, ordena por `producto_id` y construye su `ArbolIntegridad`.
    pub fn construir_arbol(articulos: &[ArticuloPadron]) -> ArbolIntegridad {
        let mut por_laboratorio: BTreeMap<String, Vec<&ArticuloPadron>> = BTreeMap::new();
        for articulo in articulos {
            let rama = normalizar_laboratorio(articulo.laboratorio.as_deref());
            por_laboratorio.entry(rama).or_default().push(articulo);
        }

        let mut ramas = BTreeMap::new();
        for (laboratorio, mut lista) in por_laboratorio {
            lista.sort_by(|a, b| {
                a.producto_id
                    .cmp(&b.producto_id)
                    .then_with(|| a.sucursal_id.0.cmp(&b.sucursal_id.0))
                    .then_with(|| a.actualizado_en.cmp(&b.actualizado_en))
            });
            let huella = calcular_huella_laboratorio(&lista);
            ramas.insert(laboratorio, huella);
        }

        ArbolIntegridad::desde_hashes(ramas)
    }

    /// Compara dos arboles y devuelve en O(1) vacio si las raices coinciden o los laboratorios distintos.
    pub fn laboratorios_desactualizados(
        local: &ArbolIntegridad,
        remoto: &ArbolIntegridad,
    ) -> Vec<String> {
        local.ramas_diferentes(remoto)
    }
}

fn normalizar_laboratorio(laboratorio: Option<&str>) -> String {
    match laboratorio.map(str::trim) {
        Some(nombre) if !nombre.is_empty() => nombre.to_owned(),
        _ => String::from(LABORATORIO_VACIO),
    }
}

fn calcular_huella_laboratorio(articulos: &[&ArticuloPadron]) -> [u8; 32] {
    let mut resumidor = blake3::Hasher::new();
    resumidor.update(DOMINIO_RAMA_LABORATORIO);
    resumidor.update(&(articulos.len() as u64).to_le_bytes());

    for articulo in articulos {
        agregar_articulo(&mut resumidor, articulo);
    }

    *resumidor.finalize().as_bytes()
}

fn agregar_articulo(resumidor: &mut blake3::Hasher, articulo: &ArticuloPadron) {
    agregar_texto(resumidor, &articulo.producto_id);
    resumidor.update(&articulo.sucursal_id.0.to_le_bytes());
    agregar_opcional(resumidor, articulo.troquel.as_deref());
    agregar_texto(resumidor, &articulo.descripcion);
    agregar_opcional(resumidor, articulo.laboratorio.as_deref());
    agregar_opcional(resumidor, articulo.rubro.as_deref());
    agregar_opcional(resumidor, articulo.subrubro.as_deref());
    agregar_f64(resumidor, articulo.existencia);
    agregar_f64(resumidor, articulo.costo);
    agregar_f64(resumidor, articulo.precio);
    agregar_bool(resumidor, articulo.oculto);
    agregar_bool(resumidor, articulo.trazable);
    agregar_opcional(resumidor, articulo.gtin.as_deref());
    agregar_opcional(resumidor, articulo.padre_id.as_deref());
    resumidor.update(&articulo.unidades_padre.to_le_bytes());
    agregar_texto(resumidor, &articulo.actualizado_en);

    let mut barras: Vec<(&str, bool)> = articulo
        .codigos_barra
        .iter()
        .map(|barra| (barra.codigo.as_str(), barra.es_principal))
        .collect();
    barras.sort_unstable();
    resumidor.update(&(barras.len() as u64).to_le_bytes());
    for (codigo, es_principal) in barras {
        agregar_texto(resumidor, codigo);
        agregar_bool(resumidor, es_principal);
    }
}

fn agregar_texto(resumidor: &mut blake3::Hasher, texto: &str) {
    resumidor.update(&(texto.len() as u64).to_le_bytes());
    resumidor.update(texto.as_bytes());
}

fn agregar_opcional(resumidor: &mut blake3::Hasher, valor: Option<&str>) {
    match valor {
        Some(texto) => {
            resumidor.update(&[1]);
            agregar_texto(resumidor, texto);
        }
        None => {
            resumidor.update(&[0]);
        }
    }
}

fn agregar_bool(resumidor: &mut blake3::Hasher, valor: bool) {
    resumidor.update(&[u8::from(valor)]);
}

fn agregar_f64(resumidor: &mut blake3::Hasher, valor: f64) {
    let canonico = if valor == 0.0 {
        0.0_f64
    } else if valor.is_nan() {
        f64::NAN
    } else {
        valor
    };
    resumidor.update(&canonico.to_bits().to_le_bytes());
}

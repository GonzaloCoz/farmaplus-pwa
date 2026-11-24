use std::cmp::Ordering;
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

const DOMINIO_RAIZ_ARBOL: &[u8] = b"MIPLUS_ARBOL_INTEGRIDAD_1";

/// Arbol de integridad deterministico basado en BLAKE3 para comparar ramas sin transferir datos completos.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArbolIntegridad {
    pub ramas: BTreeMap<String, [u8; 32]>,
    pub raiz: [u8; 32],
}

impl ArbolIntegridad {
    /// Crea un arbol vacio con su raiz canonica calculada.
    pub fn vacio() -> Self {
        let ramas = BTreeMap::new();
        let raiz = calcular_raiz(&ramas);
        Self { ramas, raiz }
    }

    /// Construye el arbol calculando el hash BLAKE3 de cada rama a partir de sus bytes crudos.
    pub fn desde_datos<'a, I, S>(ramas: I) -> Self
    where
        I: IntoIterator<Item = (S, &'a [u8])>,
        S: Into<String>,
    {
        let mut mapa = BTreeMap::new();
        for (nombre, datos) in ramas {
            let huella = *blake3::hash(datos).as_bytes();
            mapa.insert(nombre.into(), huella);
        }
        let raiz = calcular_raiz(&mapa);
        Self { ramas: mapa, raiz }
    }

    /// Construye el arbol a partir de huellas BLAKE3 ya calculadas por rama.
    pub fn desde_hashes<I, S>(ramas: I) -> Self
    where
        I: IntoIterator<Item = (S, [u8; 32])>,
        S: Into<String>,
    {
        let mut mapa = BTreeMap::new();
        for (nombre, huella) in ramas {
            mapa.insert(nombre.into(), huella);
        }
        let raiz = calcular_raiz(&mapa);
        Self { ramas: mapa, raiz }
    }

    /// Inserta o actualiza una rama calculando su huella BLAKE3 y recalculando la raiz.
    pub fn fijar_rama(&mut self, nombre: impl Into<String>, datos: &[u8]) {
        let huella = *blake3::hash(datos).as_bytes();
        self.fijar_hash_rama(nombre, huella);
    }

    /// Inserta o actualiza una rama con su huella BLAKE3 y recalcula la raiz.
    pub fn fijar_hash_rama(&mut self, nombre: impl Into<String>, huella: [u8; 32]) {
        self.ramas.insert(nombre.into(), huella);
        self.raiz = calcular_raiz(&self.ramas);
    }

    /// Elimina una rama existente y recalcula la raiz.
    pub fn quitar_rama(&mut self, nombre: &str) -> Option<[u8; 32]> {
        let quitado = self.ramas.remove(nombre);
        if quitado.is_some() {
            self.raiz = calcular_raiz(&self.ramas);
        }
        quitado
    }

    /// Comprueba si la raiz almacenada coincide exactamente con las ramas actuales.
    pub fn es_consistente(&self) -> bool {
        self.raiz == calcular_raiz(&self.ramas)
    }

    /// Devuelve `Vec::new()` en O(1) si las raices coinciden, o las ramas que difieren en orden alfabetico.
    pub fn ramas_diferentes(&self, otro: &Self) -> Vec<String> {
        if self.raiz == otro.raiz {
            return Vec::new();
        }

        let mut diferencias = Vec::new();
        let mut iter_propio = self.ramas.iter().peekable();
        let mut iter_otro = otro.ramas.iter().peekable();

        while let (Some(&(rama_a, huella_a)), Some(&(rama_b, huella_b))) =
            (iter_propio.peek(), iter_otro.peek())
        {
            match rama_a.cmp(rama_b) {
                Ordering::Less => {
                    diferencias.push(rama_a.clone());
                    iter_propio.next();
                }
                Ordering::Greater => {
                    diferencias.push(rama_b.clone());
                    iter_otro.next();
                }
                Ordering::Equal => {
                    if huella_a != huella_b {
                        diferencias.push(rama_a.clone());
                    }
                    iter_propio.next();
                    iter_otro.next();
                }
            }
        }

        for (rama, _) in iter_propio {
            diferencias.push(rama.clone());
        }
        for (rama, _) in iter_otro {
            diferencias.push(rama.clone());
        }

        diferencias
    }
}

fn calcular_raiz(ramas: &BTreeMap<String, [u8; 32]>) -> [u8; 32] {
    let mut resumidor = blake3::Hasher::new();
    resumidor.update(DOMINIO_RAIZ_ARBOL);
    resumidor.update(&(ramas.len() as u64).to_le_bytes());
    for (nombre, huella) in ramas {
        resumidor.update(&(nombre.len() as u64).to_le_bytes());
        resumidor.update(nombre.as_bytes());
        resumidor.update(huella);
    }
    *resumidor.finalize().as_bytes()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn raiz_coincidente_devuelve_cero_diferencias() {
        let arbol_a = ArbolIntegridad::desde_datos([
            ("articulos", b"padron-inicial".as_slice()),
            ("codigos", b"ean-123".as_slice()),
            ("precios", b"lista-09".as_slice()),
        ]);
        let arbol_b = ArbolIntegridad::desde_datos([
            ("precios", b"lista-09".as_slice()),
            ("articulos", b"padron-inicial".as_slice()),
            ("codigos", b"ean-123".as_slice()),
        ]);

        assert_eq!(arbol_a.raiz, arbol_b.raiz);
        assert!(arbol_a.ramas_diferentes(&arbol_b).is_empty());
    }

    #[test]
    fn detecta_exactamente_la_unica_rama_alterada() {
        let local = ArbolIntegridad::desde_datos([
            ("articulos", b"bloque-a".as_slice()),
            ("codigos", b"bloque-b".as_slice()),
            ("laboratorios", b"bloque-c".as_slice()),
            ("stock", b"bloque-d".as_slice()),
            ("vencimientos", b"bloque-e".as_slice()),
        ]);
        let mut remoto = local.clone();
        remoto.fijar_rama("laboratorios", b"bloque-c-actualizado");

        assert_ne!(local.raiz, remoto.raiz);
        assert_eq!(
            local.ramas_diferentes(&remoto),
            vec!["laboratorios".to_string()]
        );
    }

    #[test]
    fn detecta_ramas_faltantes_y_agregadas() {
        let local = ArbolIntegridad::desde_datos([
            ("articulos", b"1".as_slice()),
            ("codigos", b"2".as_slice()),
        ]);
        let mut remoto = local.clone();
        remoto.quitar_rama("codigos");
        remoto.fijar_rama("zonas", b"3");

        assert_eq!(
            local.ramas_diferentes(&remoto),
            vec!["codigos".to_string(), "zonas".to_string()]
        );
    }

    #[test]
    fn verifica_consistencia_de_raiz() {
        let mut arbol = ArbolIntegridad::desde_datos([("padron", b"datos".as_slice())]);
        assert!(arbol.es_consistente());
        arbol.raiz[0] ^= 0xFF;
        assert!(!arbol.es_consistente());
    }
}

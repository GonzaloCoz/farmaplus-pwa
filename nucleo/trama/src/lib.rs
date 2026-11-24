//! Primitivas de sellado local, bloques autenticados, contenedores `.pak` e integridad Merkle.

pub mod arbol;
pub mod bloque;
pub mod paquete;
pub mod sello;
pub mod sobre;

pub use arbol::ArbolIntegridad;
pub use bloque::{cifrar_bloque, descifrar_bloque, TAMANO_ETIQUETA_BLOQUE, TAMANO_VECTOR_BLOQUE};
pub use paquete::{
    desempaquetar_pak, desempaquetar_pak_flujo, empaquetar_pak, empaquetar_pak_flujo,
    CredencialFirma, CredencialVerificacion, MAGIA_PAK, TAMANO_BLOQUE_PAK, TAMANO_CABECERA_PAK,
    TAMANO_CABECERA_SIN_FIRMA, VERSION_PAK,
};
pub use sello::{abrir_sello, sellar_local, MaterialSensible};
pub use sobre::{
    abrir_sobre_mensaje, asegurar_identidad_operador, cargar_extremo_privado_local,
    derivar_material_mensaje, nombre_archivo_extremo_operador, sellar_sobre_mensaje,
    verificar_extremo_publico, PaqueteExtremoPublico,
};

#[cfg(test)]
mod pruebas {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn integracion_sello_credencial_y_pak() {
        let firma_original = CredencialFirma::generar();
        let sellada = sellar_local(firma_original.como_bytes()).expect("sellado de credencial");
        let abierta = abrir_sello(&sellada).expect("apertura de credencial");
        let firma_restaurada =
            CredencialFirma::desde_bytes(abierta.como_bytes()).expect("credencial restaurada");

        let carga = b"lote-sincronizacion-sucursal-14";
        let paquete = empaquetar_pak(carga, &firma_restaurada).expect("empaquetado");
        let extraido =
            desempaquetar_pak(&paquete, &firma_original.verificacion()).expect("desempaquetado");
        assert_eq!(extraido.as_slice(), carga);
    }
}

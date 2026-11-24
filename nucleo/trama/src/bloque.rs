use chacha20poly1305::aead::Aead;
use chacha20poly1305::{ChaCha20Poly1305, KeyInit, Nonce};
use comun::ErrorNucleo;
use rand_core::{OsRng, RngCore};

/// Longitud en bytes del vector unico de bloque para ChaCha20-Poly1305.
pub const TAMANO_VECTOR_BLOQUE: usize = 12;

/// Longitud en bytes de la etiqueta de autenticacion Poly1305.
pub const TAMANO_ETIQUETA_BLOQUE: usize = 16;

/// Cifra y autentica un bloque plano devolviendo `[vector_unico_12_bytes || cuerpo_con_etiqueta]`.
pub fn cifrar_bloque(llave: &[u8; 32], plano: &[u8]) -> Result<Vec<u8>, ErrorNucleo> {
    let mut vector_unico = [0u8; TAMANO_VECTOR_BLOQUE];
    OsRng.fill_bytes(&mut vector_unico);

    let transformador = ChaCha20Poly1305::new(llave.into());
    let cifrado = transformador
        .encrypt(Nonce::from_slice(&vector_unico), plano)
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;

    let mut salida = Vec::with_capacity(TAMANO_VECTOR_BLOQUE + cifrado.len());
    salida.extend_from_slice(&vector_unico);
    salida.extend_from_slice(&cifrado);
    Ok(salida)
}

/// Verifica la etiqueta de autenticacion y descifra un bloque producido por `cifrar_bloque`.
pub fn descifrar_bloque(llave: &[u8; 32], bloque: &[u8]) -> Result<Vec<u8>, ErrorNucleo> {
    if bloque.len() < TAMANO_VECTOR_BLOQUE + TAMANO_ETIQUETA_BLOQUE {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let (vector_unico, cuerpo) = bloque.split_at(TAMANO_VECTOR_BLOQUE);
    let transformador = ChaCha20Poly1305::new(llave.into());
    transformador
        .decrypt(Nonce::from_slice(vector_unico), cuerpo)
        .map_err(|_| ErrorNucleo::IntegridadInvalida)
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn ida_y_vuelta_bloque_autenticado() {
        let llave = [0x42u8; 32];
        let plano = b"inventario-ciclico-sucursal-07-lote-9912";

        let bloque = cifrar_bloque(&llave, plano).expect("cifrado de bloque");
        assert_eq!(
            bloque.len(),
            TAMANO_VECTOR_BLOQUE + plano.len() + TAMANO_ETIQUETA_BLOQUE
        );

        let recuperado = descifrar_bloque(&llave, &bloque).expect("descifrado de bloque");
        assert_eq!(recuperado.as_slice(), plano);
    }

    #[test]
    fn ida_y_vuelta_bloque_vacio() {
        let llave = [0x11u8; 32];
        let bloque = cifrar_bloque(&llave, &[]).expect("cifrado vacio");
        assert_eq!(bloque.len(), TAMANO_VECTOR_BLOQUE + TAMANO_ETIQUETA_BLOQUE);

        let recuperado = descifrar_bloque(&llave, &bloque).expect("descifrado vacio");
        assert!(recuperado.is_empty());
    }

    #[test]
    fn cifrados_repetidos_usan_vectores_distintos() {
        let llave = [0x24u8; 32];
        let plano = b"misma-carga-en-dos-bloques";
        let primero = cifrar_bloque(&llave, plano).expect("primer bloque");
        let segundo = cifrar_bloque(&llave, plano).expect("segundo bloque");
        assert_ne!(
            &primero[..TAMANO_VECTOR_BLOQUE],
            &segundo[..TAMANO_VECTOR_BLOQUE]
        );
    }

    #[test]
    fn rechaza_alteracion_en_bloque_o_llave_incorrecta() {
        let llave = [0x77u8; 32];
        let otra_llave = [0x78u8; 32];
        let bloque = cifrar_bloque(&llave, b"payload-sensible").expect("bloque valido");

        assert!(matches!(
            descifrar_bloque(&otra_llave, &bloque),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let mut alterado_vector = bloque.clone();
        alterado_vector[0] ^= 0x01;
        assert!(matches!(
            descifrar_bloque(&llave, &alterado_vector),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let mut alterado_cuerpo = bloque.clone();
        let medio = TAMANO_VECTOR_BLOQUE + 2;
        alterado_cuerpo[medio] ^= 0x80;
        assert!(matches!(
            descifrar_bloque(&llave, &alterado_cuerpo),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let mut alterado_etiqueta = bloque.clone();
        let ultimo = alterado_etiqueta.len() - 1;
        alterado_etiqueta[ultimo] ^= 0x01;
        assert!(matches!(
            descifrar_bloque(&llave, &alterado_etiqueta),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        assert!(matches!(
            descifrar_bloque(
                &llave,
                &bloque[..TAMANO_VECTOR_BLOQUE + TAMANO_ETIQUETA_BLOQUE - 1]
            ),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }
}

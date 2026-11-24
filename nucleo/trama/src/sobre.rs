use std::path::Path;

use chacha20poly1305::aead::{Aead, Payload};
use chacha20poly1305::{ChaCha20Poly1305, KeyInit, Nonce};
use comun::ErrorNucleo;
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

use crate::bloque::{
    cifrar_bloque, descifrar_bloque, TAMANO_ETIQUETA_BLOQUE, TAMANO_VECTOR_BLOQUE,
};
use crate::paquete::{CredencialFirma, CredencialVerificacion};
use crate::sello::{abrir_sello, sellar_local, MaterialSensible};

const CONTEXTO_FIRMA_EXTREMO: &[u8] = b"miplus.extremo.v1|";
const CONTEXTO_RESPALDO_EXTREMO: &str = "miplus.respaldo.extremo.v1";
const CONTEXTO_SOBRE_MENSAJE: &str = "miplus.sobre.mensaje.v1";
const TAMANO_EXTREMO_BYTES: usize = 32;
const TAMANO_MATERIAL_IDENTIDAD: usize = 64;

/// Paquete publico y respaldo cifrado de extremo de mensajeria para un operador.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaqueteExtremoPublico {
    pub extremo_publico: Vec<u8>,
    pub firma_identidad: Vec<u8>,
    pub firma_extremo: Vec<u8>,
    pub respaldo_extremo: Vec<u8>,
}

/// Calcula el nombre canonico del archivo local de extremo para un operador.
pub fn nombre_archivo_extremo_operador(operador_id: &str) -> String {
    let huella = blake3::hash(operador_id.as_bytes()).to_hex();
    let prefijo_hex = &huella.as_str()[..16];
    format!("extremo_{prefijo_hex}.dat")
}

/// Verifica la firma Ed25519 que vincula el extremo X25519 con el identificador del operador.
pub fn verificar_extremo_publico(
    operador_id: &str,
    extremo_publico: &[u8],
    firma_identidad: &[u8],
    firma_extremo: &[u8],
) -> Result<(), ErrorNucleo> {
    if operador_id.is_empty() || extremo_publico.len() != TAMANO_EXTREMO_BYTES {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let firma_bytes: [u8; 64] = firma_extremo
        .try_into()
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
    let verificador = CredencialVerificacion::desde_bytes(firma_identidad)?;
    let mensaje = construir_mensaje_extremo(operador_id, extremo_publico);
    verificador.verificar(&mensaje, &firma_bytes)
}

/// Asegura la identidad criptografica del operador leyendo el sello local, restaurando el respaldo o generando uno inicial.
pub fn asegurar_identidad_operador(
    ruta_sello_local: &Path,
    operador_id: &str,
    semilla_roaming: &str,
    respaldo_remoto: Option<&[u8]>,
) -> Result<PaqueteExtremoPublico, ErrorNucleo> {
    if operador_id.is_empty() || semilla_roaming.is_empty() {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut llave_respaldo = derivar_llave_respaldo(operador_id, semilla_roaming);

    let material_local = if ruta_sello_local.exists() {
        let bytes_locales =
            std::fs::read(ruta_sello_local).map_err(|_| ErrorNucleo::AlmacenLocal)?;
        abrir_material_identidad(&bytes_locales, &llave_respaldo).ok()
    } else {
        None
    };

    let mut material_64b = if let Some(material) = material_local {
        material
    } else if let Some(remoto) = respaldo_remoto.filter(|b| !b.is_empty()) {
        let mut abierto = match descifrar_bloque(&llave_respaldo, remoto) {
            Ok(plano) => plano,
            Err(err) => {
                llave_respaldo.zeroize();
                return Err(err);
            }
        };
        if abierto.len() != TAMANO_MATERIAL_IDENTIDAD {
            abierto.zeroize();
            llave_respaldo.zeroize();
            return Err(ErrorNucleo::IntegridadInvalida);
        }
        let mut arreglo = [0u8; TAMANO_MATERIAL_IDENTIDAD];
        arreglo.copy_from_slice(&abierto);
        abierto.zeroize();
        if let Err(err) = guardar_material_identidad(ruta_sello_local, &arreglo, &llave_respaldo) {
            arreglo.zeroize();
            llave_respaldo.zeroize();
            return Err(err);
        }
        arreglo
    } else {
        let mut generado = [0u8; TAMANO_MATERIAL_IDENTIDAD];
        OsRng.fill_bytes(&mut generado);
        if let Err(err) = guardar_material_identidad(ruta_sello_local, &generado, &llave_respaldo) {
            generado.zeroize();
            llave_respaldo.zeroize();
            return Err(err);
        }
        generado
    };

    let mut semilla_x25519 = [0u8; TAMANO_EXTREMO_BYTES];
    semilla_x25519.copy_from_slice(&material_64b[..TAMANO_EXTREMO_BYTES]);
    let mut semilla_ed25519 = [0u8; TAMANO_EXTREMO_BYTES];
    semilla_ed25519.copy_from_slice(&material_64b[TAMANO_EXTREMO_BYTES..]);

    let privado_x25519 = StaticSecret::from(semilla_x25519);
    let extremo_publico = PublicKey::from(&privado_x25519).as_bytes().to_vec();
    semilla_x25519.zeroize();

    let credencial_firma = CredencialFirma::desde_semilla(semilla_ed25519);
    semilla_ed25519.zeroize();
    let firma_identidad = credencial_firma.verificacion().a_bytes().to_vec();
    let mensaje_extremo = construir_mensaje_extremo(operador_id, &extremo_publico);
    let firma_extremo = credencial_firma.firmar(&mensaje_extremo).to_vec();

    let respaldo_extremo = match respaldo_remoto.filter(|b| !b.is_empty()) {
        Some(remoto)
            if descifrar_bloque(&llave_respaldo, remoto)
                .map(|plano| plano.as_slice() == material_64b.as_slice())
                .unwrap_or(false) =>
        {
            remoto.to_vec()
        }
        _ => match cifrar_bloque(&llave_respaldo, &material_64b) {
            Ok(cifrado) => cifrado,
            Err(err) => {
                material_64b.zeroize();
                llave_respaldo.zeroize();
                return Err(err);
            }
        },
    };

    material_64b.zeroize();
    llave_respaldo.zeroize();

    Ok(PaqueteExtremoPublico {
        extremo_publico,
        firma_identidad,
        firma_extremo,
        respaldo_extremo,
    })
}

/// Carga los 32 bytes del escalar privado X25519 del operador desde su sello local (inicializandolo si no existe).
pub fn cargar_extremo_privado_local(
    ruta_sello_local: &Path,
    operador_id: &str,
    semilla_roaming: &str,
) -> Result<MaterialSensible, ErrorNucleo> {
    if !ruta_sello_local.exists() {
        let _ = asegurar_identidad_operador(ruta_sello_local, operador_id, semilla_roaming, None)?;
    }

    let mut llave_respaldo = derivar_llave_respaldo(operador_id, semilla_roaming);
    let bytes_locales = std::fs::read(ruta_sello_local).map_err(|_| {
        llave_respaldo.zeroize();
        ErrorNucleo::AlmacenLocal
    })?;

    let mut material_64b = match abrir_material_identidad(&bytes_locales, &llave_respaldo) {
        Ok(m) => m,
        Err(err) => {
            llave_respaldo.zeroize();
            return Err(err);
        }
    };
    llave_respaldo.zeroize();

    let privado = material_64b[..TAMANO_EXTREMO_BYTES].to_vec();
    material_64b.zeroize();
    Ok(MaterialSensible::desde_bytes(privado))
}

/// Deriva el material de 32 bytes especifico de un mensaje directo mediante X25519 + BLAKE3 KDF.
pub fn derivar_material_mensaje(
    privado_x25519: &[u8; 32],
    publico_par_x25519: &[u8; 32],
    conversacion_id: &str,
    mensaje_id: &str,
) -> [u8; 32] {
    let acuerdo = StaticSecret::from(*privado_x25519)
        .diffie_hellman(&PublicKey::from(*publico_par_x25519));
    blake3::derive_key(
        CONTEXTO_SOBRE_MENSAJE,
        &[
            acuerdo.as_bytes().as_slice(),
            b"|",
            conversacion_id.as_bytes(),
            b"|",
            mensaje_id.as_bytes(),
        ]
        .concat(),
    )
}

/// Sella y autentica la carga de un mensaje directo con ChaCha20-Poly1305 y contexto AAD.
pub fn sellar_sobre_mensaje(
    material: &[u8; 32],
    conversacion_id: &str,
    remitente_id: &str,
    mensaje_id: &str,
    carga_plana: &[u8],
) -> Result<Vec<u8>, ErrorNucleo> {
    let mut vector_unico = [0u8; TAMANO_VECTOR_BLOQUE];
    OsRng.fill_bytes(&mut vector_unico);

    let aad = format!("{conversacion_id}|{remitente_id}|{mensaje_id}");
    let transformador = ChaCha20Poly1305::new(material.into());
    let cuerpo = transformador
        .encrypt(
            Nonce::from_slice(&vector_unico),
            Payload {
                msg: carga_plana,
                aad: aad.as_bytes(),
            },
        )
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;

    let mut sobre = Vec::with_capacity(TAMANO_VECTOR_BLOQUE + cuerpo.len());
    sobre.extend_from_slice(&vector_unico);
    sobre.extend_from_slice(&cuerpo);
    Ok(sobre)
}

/// Abre y verifica un sobre de mensaje directo comprobando la etiqueta Poly1305 y el contexto AAD.
pub fn abrir_sobre_mensaje(
    material: &[u8; 32],
    conversacion_id: &str,
    remitente_id: &str,
    mensaje_id: &str,
    sobre: &[u8],
) -> Result<Vec<u8>, ErrorNucleo> {
    if sobre.len() < TAMANO_VECTOR_BLOQUE + TAMANO_ETIQUETA_BLOQUE {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let (vector_unico, cuerpo) = sobre.split_at(TAMANO_VECTOR_BLOQUE);
    let aad = format!("{conversacion_id}|{remitente_id}|{mensaje_id}");
    let transformador = ChaCha20Poly1305::new(material.into());
    transformador
        .decrypt(
            Nonce::from_slice(vector_unico),
            Payload {
                msg: cuerpo,
                aad: aad.as_bytes(),
            },
        )
        .map_err(|_| ErrorNucleo::IntegridadInvalida)
}

fn construir_mensaje_extremo(operador_id: &str, extremo_publico: &[u8]) -> Vec<u8> {
    [
        CONTEXTO_FIRMA_EXTREMO,
        operador_id.as_bytes(),
        b"|",
        extremo_publico,
    ]
    .concat()
}

fn derivar_llave_respaldo(operador_id: &str, semilla_roaming: &str) -> [u8; 32] {
    blake3::derive_key(
        CONTEXTO_RESPALDO_EXTREMO,
        format!("{operador_id}|{semilla_roaming}").as_bytes(),
    )
}

fn abrir_material_identidad(
    bytes_locales: &[u8],
    llave_respaldo: &[u8; 32],
) -> Result<[u8; TAMANO_MATERIAL_IDENTIDAD], ErrorNucleo> {
    if let Ok(abierto) = abrir_sello(bytes_locales) {
        if abierto.como_bytes().len() == TAMANO_MATERIAL_IDENTIDAD {
            let mut arreglo = [0u8; TAMANO_MATERIAL_IDENTIDAD];
            arreglo.copy_from_slice(abierto.como_bytes());
            return Ok(arreglo);
        }
    }

    let mut descifrado = descifrar_bloque(llave_respaldo, bytes_locales)?;
    if descifrado.len() != TAMANO_MATERIAL_IDENTIDAD {
        descifrado.zeroize();
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut arreglo = [0u8; TAMANO_MATERIAL_IDENTIDAD];
    arreglo.copy_from_slice(&descifrado);
    descifrado.zeroize();
    Ok(arreglo)
}

fn guardar_material_identidad(
    ruta_sello_local: &Path,
    material_64b: &[u8; TAMANO_MATERIAL_IDENTIDAD],
    llave_respaldo: &[u8; 32],
) -> Result<(), ErrorNucleo> {
    if let Some(padre) = ruta_sello_local.parent() {
        if !padre.as_os_str().is_empty() {
            std::fs::create_dir_all(padre).map_err(|_| ErrorNucleo::AlmacenLocal)?;
        }
    }

    let sellado = match sellar_local(material_64b) {
        Ok(bloque) => bloque,
        Err(_) => cifrar_bloque(llave_respaldo, material_64b)?,
    };

    std::fs::write(ruta_sello_local, &sellado).map_err(|_| ErrorNucleo::AlmacenLocal)
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static CONTADOR_PRUEBAS: AtomicU64 = AtomicU64::new(1);

    fn ruta_prueba_aislada(etiqueta: &str) -> PathBuf {
        let secuencia = CONTADOR_PRUEBAS.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        std::env::temp_dir()
            .join("miplus_pruebas_sobre")
            .join(format!("{etiqueta}_{pid}_{secuencia}.dat"))
    }

    #[test]
    fn ida_y_vuelta_entre_dos_operadores() {
        let ruta_a = ruta_prueba_aislada("operador_a");
        let ruta_b = ruta_prueba_aislada("operador_b");
        let _ = std::fs::remove_file(&ruta_a);
        let _ = std::fs::remove_file(&ruta_b);

        let id_a = "11111111-1111-1111-1111-111111111111";
        let id_b = "22222222-2222-2222-2222-222222222222";

        let paquete_a =
            asegurar_identidad_operador(&ruta_a, id_a, "operador.a", None).expect("identidad A");
        let paquete_b =
            asegurar_identidad_operador(&ruta_b, id_b, "operador.b", None).expect("identidad B");

        verificar_extremo_publico(
            id_a,
            &paquete_a.extremo_publico,
            &paquete_a.firma_identidad,
            &paquete_a.firma_extremo,
        )
        .expect("firma extremo A valida");
        verificar_extremo_publico(
            id_b,
            &paquete_b.extremo_publico,
            &paquete_b.firma_identidad,
            &paquete_b.firma_extremo,
        )
        .expect("firma extremo B valida");

        let privado_a_sensible =
            cargar_extremo_privado_local(&ruta_a, id_a, "operador.a").expect("privado A");
        let privado_b_sensible =
            cargar_extremo_privado_local(&ruta_b, id_b, "operador.b").expect("privado B");

        let privado_a: [u8; 32] = privado_a_sensible
            .como_bytes()
            .try_into()
            .expect("32 bytes A");
        let privado_b: [u8; 32] = privado_b_sensible
            .como_bytes()
            .try_into()
            .expect("32 bytes B");
        let publico_a: [u8; 32] = paquete_a
            .extremo_publico
            .as_slice()
            .try_into()
            .expect("publico A");
        let publico_b: [u8; 32] = paquete_b
            .extremo_publico
            .as_slice()
            .try_into()
            .expect("publico B");

        let conversacion_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        let mensaje_id = "99999999-8888-7777-6666-555555555555";
        let carga = br#"{"text":"Necesito confirmar lote de insulina sucursal 14"}"#;

        let material_emisor =
            derivar_material_mensaje(&privado_a, &publico_b, conversacion_id, mensaje_id);
        let material_receptor =
            derivar_material_mensaje(&privado_b, &publico_a, conversacion_id, mensaje_id);
        assert_eq!(material_emisor, material_receptor);

        let sobre =
            sellar_sobre_mensaje(&material_emisor, conversacion_id, id_a, mensaje_id, carga)
                .expect("sellado de mensaje");
        let abierto = abrir_sobre_mensaje(
            &material_receptor,
            conversacion_id,
            id_a,
            mensaje_id,
            &sobre,
        )
        .expect("apertura de mensaje");
        assert_eq!(abierto.as_slice(), carga);

        let _ = std::fs::remove_file(&ruta_a);
        let _ = std::fs::remove_file(&ruta_b);
    }

    #[test]
    fn restauracion_desde_respaldo_extremo_en_otra_pc() {
        let ruta_pc1 = ruta_prueba_aislada("pc1");
        let ruta_pc2 = ruta_prueba_aislada("pc2");
        let _ = std::fs::remove_file(&ruta_pc1);
        let _ = std::fs::remove_file(&ruta_pc2);

        let operador_id = "33333333-3333-3333-3333-333333333333";
        let semilla_roaming = "farmaceutico.central";

        let paquete_pc1 =
            asegurar_identidad_operador(&ruta_pc1, operador_id, semilla_roaming, None)
                .expect("creacion en PC 1");
        let paquete_pc2 = asegurar_identidad_operador(
            &ruta_pc2,
            operador_id,
            semilla_roaming,
            Some(&paquete_pc1.respaldo_extremo),
        )
        .expect("restauracion en PC 2");

        assert_eq!(paquete_pc1.extremo_publico, paquete_pc2.extremo_publico);
        assert_eq!(paquete_pc1.firma_identidad, paquete_pc2.firma_identidad);
        assert_eq!(paquete_pc1.firma_extremo, paquete_pc2.firma_extremo);
        assert_eq!(paquete_pc1.respaldo_extremo, paquete_pc2.respaldo_extremo);

        // Una segunda invocacion en PC 2 lee directamente el sello local persistido.
        let paquete_pc2_relectura =
            asegurar_identidad_operador(&ruta_pc2, operador_id, semilla_roaming, None)
                .expect("relectura local en PC 2");
        assert_eq!(
            paquete_pc1.extremo_publico,
            paquete_pc2_relectura.extremo_publico
        );
        assert_eq!(
            paquete_pc1.firma_identidad,
            paquete_pc2_relectura.firma_identidad
        );
        assert_eq!(
            paquete_pc1.firma_extremo,
            paquete_pc2_relectura.firma_extremo
        );

        let _ = std::fs::remove_file(&ruta_pc1);
        let _ = std::fs::remove_file(&ruta_pc2);
    }

    #[test]
    fn rechaza_alteracion_de_contexto_aad_o_sobre() {
        let privado_a = [0x11u8; 32];
        let privado_b = [0x22u8; 32];
        let publico_b = *PublicKey::from(&StaticSecret::from(privado_b)).as_bytes();

        let conversacion_id = "conv-original";
        let remitente_id = "operador-emisor";
        let mensaje_id = "msg-original";
        let material =
            derivar_material_mensaje(&privado_a, &publico_b, conversacion_id, mensaje_id);

        let sobre = sellar_sobre_mensaje(
            &material,
            conversacion_id,
            remitente_id,
            mensaje_id,
            b"mensaje autenticado",
        )
        .expect("sellado valido");

        assert!(matches!(
            abrir_sobre_mensaje(
                &material,
                "conv-distinta",
                remitente_id,
                mensaje_id,
                &sobre
            ),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        assert!(matches!(
            abrir_sobre_mensaje(
                &material,
                conversacion_id,
                "remitente-distinto",
                mensaje_id,
                &sobre
            ),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        assert!(matches!(
            abrir_sobre_mensaje(
                &material,
                conversacion_id,
                remitente_id,
                "msg-distinto",
                &sobre
            ),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        assert!(matches!(
            abrir_sobre_mensaje(
                &material,
                conversacion_id,
                remitente_id,
                mensaje_id,
                &sobre[..27]
            ),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }
}

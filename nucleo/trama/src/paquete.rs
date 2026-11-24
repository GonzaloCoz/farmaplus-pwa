use std::io::{Cursor, Read, Seek, SeekFrom, Write};

use comun::ErrorNucleo;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Cabecera magica del formato binario `.pak`.
pub const MAGIA_PAK: [u8; 4] = *b"MPAK";

/// Version del formato binario `.pak`.
pub const VERSION_PAK: u8 = 1;

/// Tamanio de bloque para lectura y compresion por flujo (64 KB).
pub const TAMANO_BLOQUE_PAK: usize = 65_536;

/// Longitud en bytes de la porcion firmada de cabecera: `[magia(4) || version(1) || huella(32)]`.
pub const TAMANO_CABECERA_SIN_FIRMA: usize = 4 + 1 + 32;

/// Longitud total en bytes de la cabecera `.pak`: `[porcion_firmada(37) || firma_ed25519(64)]`.
pub const TAMANO_CABECERA_PAK: usize = TAMANO_CABECERA_SIN_FIRMA + 64;

const NIVEL_COMPRESION_PAK: i32 = 3;

/// Credencial privada Ed25519 para emitir firmas sobre paquetes `.pak`.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct CredencialFirma {
    semilla: [u8; 32],
}

impl CredencialFirma {
    /// Genera una nueva credencial aleatoria usando entropia del sistema operativo.
    pub fn generar() -> Self {
        let mut semilla = [0u8; 32];
        OsRng.fill_bytes(&mut semilla);
        Self { semilla }
    }

    /// Reconstruye una credencial de firma a partir de su semilla de 32 bytes.
    pub fn desde_semilla(semilla: [u8; 32]) -> Self {
        Self { semilla }
    }

    /// Reconstruye una credencial de firma validando un slice de exactamente 32 bytes.
    pub fn desde_bytes(bytes: &[u8]) -> Result<Self, ErrorNucleo> {
        let semilla: [u8; 32] = bytes
            .try_into()
            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        Ok(Self { semilla })
    }

    /// Expone los 32 bytes internos (por ejemplo, para resguardarlos con `sellar_local`).
    pub fn como_bytes(&self) -> &[u8; 32] {
        &self.semilla
    }

    /// Deriva la credencial publica correspondiente para verificacion.
    pub fn verificacion(&self) -> CredencialVerificacion {
        let firmante = SigningKey::from_bytes(&self.semilla);
        CredencialVerificacion {
            publica: firmante.verifying_key().to_bytes(),
        }
    }

    /// Firma un mensaje arbitrario con Ed25519 devolviendo los 64 bytes de firma.
    pub fn firmar(&self, mensaje: &[u8]) -> [u8; 64] {
        let firmante = SigningKey::from_bytes(&self.semilla);
        firmante.sign(mensaje).to_bytes()
    }
}

impl std::fmt::Debug for CredencialFirma {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("CredencialFirma([protegido])")
    }
}

/// Credencial publica Ed25519 para validar paquetes `.pak` antes de descomprimirlos.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CredencialVerificacion {
    publica: [u8; 32],
}

impl CredencialVerificacion {
    /// Construye una credencial de verificacion comprobando que representa un punto Ed25519 valido.
    pub fn desde_bytes(bytes: &[u8]) -> Result<Self, ErrorNucleo> {
        let publica: [u8; 32] = bytes
            .try_into()
            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let _ = VerifyingKey::from_bytes(&publica).map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        Ok(Self { publica })
    }

    /// Devuelve los 32 bytes canonicos de verificacion.
    pub fn a_bytes(&self) -> [u8; 32] {
        self.publica
    }

    /// Verifica una firma Ed25519 de 64 bytes contra `mensaje`.
    pub fn verificar(&self, mensaje: &[u8], firma: &[u8; 64]) -> Result<(), ErrorNucleo> {
        let verificadora =
            VerifyingKey::from_bytes(&self.publica).map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        let firma_ed = Signature::from_bytes(firma);
        verificadora
            .verify(mensaje, &firma_ed)
            .map_err(|_| ErrorNucleo::IntegridadInvalida)
    }
}

/// Empaqueta `datos` en formato `.pak` comprimiendo con `zstd` en bloques de 64 KB y firmando la cabecera.
pub fn empaquetar_pak(datos: &[u8], firma: &CredencialFirma) -> Result<Vec<u8>, ErrorNucleo> {
    let mut salida = vec![0u8; TAMANO_CABECERA_PAK];

    {
        let mut codificador = zstd::stream::write::Encoder::new(&mut salida, NIVEL_COMPRESION_PAK)
            .map_err(|_| ErrorNucleo::AlmacenLocal)?;
        for trozo in datos.chunks(TAMANO_BLOQUE_PAK) {
            codificador
                .write_all(trozo)
                .map_err(|_| ErrorNucleo::AlmacenLocal)?;
        }
        codificador
            .finish()
            .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    }

    let mut resumidor = blake3::Hasher::new();
    for trozo in salida[TAMANO_CABECERA_PAK..].chunks(TAMANO_BLOQUE_PAK) {
        resumidor.update(trozo);
    }
    let huella = *resumidor.finalize().as_bytes();

    escribir_cabecera(&mut salida[..TAMANO_CABECERA_PAK], &huella, firma);
    Ok(salida)
}

/// Verifica magia, version, firma Ed25519 y huella BLAKE3 antes de descomprimir un `.pak`.
pub fn desempaquetar_pak(
    paquete: &[u8],
    verificador: &CredencialVerificacion,
) -> Result<Vec<u8>, ErrorNucleo> {
    if paquete.len() <= TAMANO_CABECERA_PAK {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let (cabecera, carga_comprimida) = paquete.split_at(TAMANO_CABECERA_PAK);
    let huella_esperada = verificar_cabecera(cabecera, verificador)?;

    let mut resumidor = blake3::Hasher::new();
    for trozo in carga_comprimida.chunks(TAMANO_BLOQUE_PAK) {
        resumidor.update(trozo);
    }
    if resumidor.finalize() != blake3::Hash::from(huella_esperada) {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut decodificador = zstd::stream::read::Decoder::new(Cursor::new(carga_comprimida))
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
    let mut salida = Vec::new();
    let mut trozo = vec![0u8; TAMANO_BLOQUE_PAK];
    loop {
        let leidos = decodificador
            .read(&mut trozo)
            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        if leidos == 0 {
            break;
        }
        salida.extend_from_slice(&trozo[..leidos]);
    }

    Ok(salida)
}

/// Empaqueta un flujo de entrada hacia un destino posicionable usando memoria constante de ~64 KB.
pub fn empaquetar_pak_flujo<R: Read, W: Write + Seek>(
    mut lector: R,
    mut escritor: W,
    firma: &CredencialFirma,
) -> Result<(), ErrorNucleo> {
    let inicio = escritor
        .stream_position()
        .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    escritor
        .write_all(&[0u8; TAMANO_CABECERA_PAK])
        .map_err(|_| ErrorNucleo::AlmacenLocal)?;

    let huella = {
        let puente = EscritorConHuella {
            destino: &mut escritor,
            resumidor: blake3::Hasher::new(),
        };
        let mut codificador = zstd::stream::write::Encoder::new(puente, NIVEL_COMPRESION_PAK)
            .map_err(|_| ErrorNucleo::AlmacenLocal)?;
        let mut trozo = vec![0u8; TAMANO_BLOQUE_PAK];
        loop {
            let leidos = lector
                .read(&mut trozo)
                .map_err(|_| ErrorNucleo::AlmacenLocal)?;
            if leidos == 0 {
                break;
            }
            codificador
                .write_all(&trozo[..leidos])
                .map_err(|_| ErrorNucleo::AlmacenLocal)?;
        }
        let puente_final = codificador
            .finish()
            .map_err(|_| ErrorNucleo::AlmacenLocal)?;
        *puente_final.resumidor.finalize().as_bytes()
    };

    let fin = escritor
        .stream_position()
        .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    let mut cabecera = [0u8; TAMANO_CABECERA_PAK];
    escribir_cabecera(&mut cabecera, &huella, firma);

    escritor
        .seek(SeekFrom::Start(inicio))
        .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    escritor
        .write_all(&cabecera)
        .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    escritor
        .seek(SeekFrom::Start(fin))
        .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    escritor.flush().map_err(|_| ErrorNucleo::AlmacenLocal)?;

    Ok(())
}

/// Verifica firma y huella de un flujo `.pak` antes de descomprimir en bloques de 64 KB.
pub fn desempaquetar_pak_flujo<R: Read + Seek, W: Write>(
    mut lector: R,
    mut escritor: W,
    verificador: &CredencialVerificacion,
) -> Result<(), ErrorNucleo> {
    let inicio = lector
        .stream_position()
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
    let mut cabecera = [0u8; TAMANO_CABECERA_PAK];
    lector
        .read_exact(&mut cabecera)
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;

    let huella_esperada = verificar_cabecera(&cabecera, verificador)?;
    let inicio_carga = inicio
        .checked_add(TAMANO_CABECERA_PAK as u64)
        .ok_or(ErrorNucleo::IntegridadInvalida)?;

    let mut resumidor = blake3::Hasher::new();
    let mut trozo = vec![0u8; TAMANO_BLOQUE_PAK];
    let mut total_comprimido: u64 = 0;
    loop {
        let leidos = lector
            .read(&mut trozo)
            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        if leidos == 0 {
            break;
        }
        total_comprimido = total_comprimido
            .checked_add(leidos as u64)
            .ok_or(ErrorNucleo::IntegridadInvalida)?;
        resumidor.update(&trozo[..leidos]);
    }

    if total_comprimido == 0 || resumidor.finalize() != blake3::Hash::from(huella_esperada) {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    lector
        .seek(SeekFrom::Start(inicio_carga))
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
    let mut decodificador =
        zstd::stream::read::Decoder::new(lector).map_err(|_| ErrorNucleo::IntegridadInvalida)?;
    loop {
        let leidos = decodificador
            .read(&mut trozo)
            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        if leidos == 0 {
            break;
        }
        escritor
            .write_all(&trozo[..leidos])
            .map_err(|_| ErrorNucleo::AlmacenLocal)?;
    }
    escritor.flush().map_err(|_| ErrorNucleo::AlmacenLocal)?;

    Ok(())
}

fn escribir_cabecera(cabecera: &mut [u8], huella: &[u8; 32], firma: &CredencialFirma) {
    cabecera[0..4].copy_from_slice(&MAGIA_PAK);
    cabecera[4] = VERSION_PAK;
    cabecera[5..TAMANO_CABECERA_SIN_FIRMA].copy_from_slice(huella);
    let firma_bytes = firma.firmar(&cabecera[..TAMANO_CABECERA_SIN_FIRMA]);
    cabecera[TAMANO_CABECERA_SIN_FIRMA..TAMANO_CABECERA_PAK].copy_from_slice(&firma_bytes);
}

fn verificar_cabecera(
    cabecera: &[u8],
    verificador: &CredencialVerificacion,
) -> Result<[u8; 32], ErrorNucleo> {
    if cabecera.len() != TAMANO_CABECERA_PAK {
        return Err(ErrorNucleo::IntegridadInvalida);
    }
    if cabecera[0..4] != MAGIA_PAK || cabecera[4] != VERSION_PAK {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let huella_esperada: [u8; 32] = cabecera[5..TAMANO_CABECERA_SIN_FIRMA]
        .try_into()
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
    let firma_bytes: [u8; 64] = cabecera[TAMANO_CABECERA_SIN_FIRMA..TAMANO_CABECERA_PAK]
        .try_into()
        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;

    verificador.verificar(&cabecera[..TAMANO_CABECERA_SIN_FIRMA], &firma_bytes)?;
    Ok(huella_esperada)
}

struct EscritorConHuella<W> {
    destino: W,
    resumidor: blake3::Hasher,
}

impl<W: Write> Write for EscritorConHuella<W> {
    fn write(&mut self, datos: &[u8]) -> std::io::Result<usize> {
        let escritos = self.destino.write(datos)?;
        self.resumidor.update(&datos[..escritos]);
        Ok(escritos)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.destino.flush()
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    fn generar_datos_patron(longitud: usize) -> Vec<u8> {
        let mut salida = Vec::with_capacity(longitud);
        for indice in 0..longitud {
            salida.push(((indice % 251) ^ (indice / 64)) as u8);
        }
        salida
    }

    #[test]
    fn ida_y_vuelta_pak_varios_tamanios() {
        let firma = CredencialFirma::generar();
        let verificador = firma.verificacion();

        for tamanio in [0usize, 17, TAMANO_BLOQUE_PAK, TAMANO_BLOQUE_PAK * 3 + 123] {
            let original = generar_datos_patron(tamanio);
            let paquete = empaquetar_pak(&original, &firma).expect("empaquetado pak");
            assert_eq!(&paquete[0..4], &MAGIA_PAK);
            assert_eq!(paquete[4], VERSION_PAK);

            let extraido = desempaquetar_pak(&paquete, &verificador).expect("desempaquetado pak");
            assert_eq!(extraido, original);
        }
    }

    #[test]
    fn compatibilidad_entre_slice_y_flujo_streaming() {
        let firma = CredencialFirma::desde_semilla([0x3Au8; 32]);
        let verificador = firma.verificacion();
        let original = generar_datos_patron(TAMANO_BLOQUE_PAK * 2 + 513);

        let paquete_slice = empaquetar_pak(&original, &firma).expect("empaquetado slice");
        let mut paquete_flujo = Cursor::new(Vec::new());
        empaquetar_pak_flujo(Cursor::new(&original), &mut paquete_flujo, &firma)
            .expect("empaquetado flujo");

        assert_eq!(paquete_slice, paquete_flujo.get_ref().as_slice());

        let mut extraido_flujo = Vec::new();
        desempaquetar_pak_flujo(
            Cursor::new(&paquete_slice),
            &mut extraido_flujo,
            &verificador,
        )
        .expect("desempaquetado flujo");
        assert_eq!(extraido_flujo, original);
    }

    #[test]
    fn rechaza_inmediatamente_firma_alterada() {
        let firma = CredencialFirma::generar();
        let verificador = firma.verificacion();
        let mut paquete = empaquetar_pak(b"catalogo-farmacia-sucursal-01", &firma).expect("pak");

        paquete[TAMANO_CABECERA_SIN_FIRMA + 10] ^= 0x01;
        assert!(matches!(
            desempaquetar_pak(&paquete, &verificador),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }

    #[test]
    fn rechaza_inmediatamente_carga_comprimida_alterada() {
        let firma = CredencialFirma::generar();
        let verificador = firma.verificacion();
        let mut paquete = empaquetar_pak(&generar_datos_patron(90_000), &firma).expect("pak");

        paquete[TAMANO_CABECERA_PAK + 4] ^= 0x40;
        assert!(matches!(
            desempaquetar_pak(&paquete, &verificador),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }

    #[test]
    fn rechaza_magia_version_truncado_y_credencial_ajena() {
        let firma = CredencialFirma::generar();
        let otra_firma = CredencialFirma::generar();
        let paquete = empaquetar_pak(b"paquete-oficial", &firma).expect("pak");

        assert!(matches!(
            desempaquetar_pak(&paquete, &otra_firma.verificacion()),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let mut mala_magia = paquete.clone();
        mala_magia[0] = b'X';
        assert!(matches!(
            desempaquetar_pak(&mala_magia, &firma.verificacion()),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let mut mala_version = paquete.clone();
        mala_version[4] = 99;
        assert!(matches!(
            desempaquetar_pak(&mala_version, &firma.verificacion()),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        assert!(matches!(
            desempaquetar_pak(&paquete[..TAMANO_CABECERA_PAK], &firma.verificacion()),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }

    #[test]
    fn verificacion_previa_rechaza_carga_corrupta_antes_de_zstd() {
        let firma = CredencialFirma::generar();
        let verificador = firma.verificacion();
        let mut paquete = empaquetar_pak(b"datos-iniciales", &firma).expect("pak");

        // Sustituye toda la carga comprimida por bytes no validos para zstd manteniendo la cabecera firmada.
        paquete.truncate(TAMANO_CABECERA_PAK);
        paquete.extend_from_slice(&[0x00, 0xFF, 0x13, 0x37]);
        assert!(matches!(
            desempaquetar_pak(&paquete, &verificador),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }

    #[test]
    fn flujo_rechaza_carga_alterada_y_credencial_serializable() {
        let firma = CredencialFirma::generar();
        let verificador = firma.verificacion();
        let bytes_publicos = verificador.a_bytes();
        let verificador_restaurado =
            CredencialVerificacion::desde_bytes(&bytes_publicos).expect("verificador valido");
        assert_eq!(verificador, verificador_restaurado);
        assert!(matches!(
            CredencialVerificacion::desde_bytes(&[0u8; 31]),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        let mut paquete = empaquetar_pak(b"datos-de-flujo-verificable", &firma).expect("pak");
        paquete[TAMANO_CABECERA_PAK] ^= 0x01;
        let mut salida = Vec::new();
        assert!(matches!(
            desempaquetar_pak_flujo(Cursor::new(&paquete), &mut salida, &verificador_restaurado),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
        assert!(salida.is_empty());
    }
}

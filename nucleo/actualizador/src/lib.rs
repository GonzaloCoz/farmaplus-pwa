//! Verificador y preparador de actualizaciones firmadas con BLAKE3 y Ed25519.

use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};

use comun::ErrorNucleo;
use serde::{Deserialize, Serialize};
use trama::CredencialVerificacion;

/// Argumento seguro para ejecucion silenciosa de instaladores NSIS.
pub const ARGUMENTOS_NSIS_SILENCIOSO: [&str; 1] = ["/S"];

/// Manifiesto remoto de una version disponible para actualizacion de escritorio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManifiestoVersion {
    pub version_semantica: String,
    pub hash_blake3: String,
    pub firma_ed25519_hex: String,
    pub ruta_instalador_s3: String,
    pub obligatoria: bool,
}

impl ManifiestoVersion {
    /// Construye el mensaje canonico firmado por la autoridad de emision.
    pub fn mensaje_canonico(&self) -> String {
        format!("{}|{}", self.version_semantica, self.hash_blake3)
    }
}

/// Comando preparado para lanzar el instalador sin ejecutar procesos dentro de pruebas.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComandoInstalacion {
    pub ejecutable: PathBuf,
    pub argumentos: Vec<String>,
}

/// Compara dos versiones semanticas (`MAYOR.MENOR.PARCHE` con pre-lanzamiento opcional).
pub fn comparar_versiones_semanticas(actual: &str, candidata: &str) -> Result<Ordering, ErrorNucleo> {
    let parsed_actual = VersionSemantica::parsear(actual)?;
    let parsed_candidata = VersionSemantica::parsear(candidata)?;
    Ok(parsed_actual.cmp(&parsed_candidata))
}

/// Indica si el manifiesto representa una version estrictamente superior a `version_actual`.
pub fn hay_actualizacion_disponible(
    version_actual: &str,
    manifiesto: &ManifiestoVersion,
) -> Result<bool, ErrorNucleo> {
    let orden = comparar_versiones_semanticas(version_actual, &manifiesto.version_semantica)?;
    Ok(orden == Ordering::Less)
}

/// Verifica hash BLAKE3 en tiempo constante y firma Ed25519 sobre `"{version}|{hash}"`.
pub fn verificar_instalador_firmado(
    bytes_instalador: &[u8],
    manifiesto: &ManifiestoVersion,
    credencial_publica: &CredencialVerificacion,
) -> Result<(), ErrorNucleo> {
    let _ = VersionSemantica::parsear(&manifiesto.version_semantica)?;

    let hash_esperado = decodificar_hex_fijo::<32>(&manifiesto.hash_blake3)?;
    let hash_calculado = blake3::hash(bytes_instalador);
    if !comparacion_tiempo_constante(hash_calculado.as_bytes(), &hash_esperado) {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let firma_bytes = decodificar_hex_fijo::<64>(&manifiesto.firma_ed25519_hex)?;
    let mensaje = manifiesto.mensaje_canonico();
    credencial_publica.verificar(mensaje.as_bytes(), &firma_bytes)?;

    Ok(())
}

/// Verifica el instalador antes de escribirlo en disco y devuelve la ruta lista para ejecucion.
pub fn preparar_instalacion_silenciosa(
    ruta_destino: &Path,
    bytes_instalador: &[u8],
    manifiesto: &ManifiestoVersion,
    credencial_publica: &CredencialVerificacion,
) -> Result<PathBuf, ErrorNucleo> {
    verificar_instalador_firmado(bytes_instalador, manifiesto, credencial_publica)?;

    if let Some(directorio_padre) = ruta_destino.parent() {
        if !directorio_padre.as_os_str().is_empty() {
            fs::create_dir_all(directorio_padre).map_err(|_| ErrorNucleo::AlmacenLocal)?;
        }
    }

    fs::write(ruta_destino, bytes_instalador).map_err(|_| ErrorNucleo::AlmacenLocal)?;
    Ok(ruta_destino.to_path_buf())
}

/// Construye el comando NSIS silencioso (`["/S"]`) sin invocar ningun proceso del sistema.
pub fn construir_comando_nsis_silencioso(ruta_instalador: &Path) -> ComandoInstalacion {
    ComandoInstalacion {
        ejecutable: ruta_instalador.to_path_buf(),
        argumentos: ARGUMENTOS_NSIS_SILENCIOSO
            .iter()
            .map(|arg| (*arg).to_string())
            .collect(),
    }
}

/// Verifica, persiste el instalador y arma el comando NSIS silencioso listo para despacho.
pub fn preparar_comando_instalacion_silenciosa(
    ruta_destino: &Path,
    bytes_instalador: &[u8],
    manifiesto: &ManifiestoVersion,
    credencial_publica: &CredencialVerificacion,
) -> Result<ComandoInstalacion, ErrorNucleo> {
    let ruta_lista = preparar_instalacion_silenciosa(
        ruta_destino,
        bytes_instalador,
        manifiesto,
        credencial_publica,
    )?;
    Ok(construir_comando_nsis_silencioso(&ruta_lista))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct VersionSemantica {
    mayor: u64,
    menor: u64,
    parche: u64,
    pre_lanzamiento: Vec<IdentificadorPre>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum IdentificadorPre {
    Numerico(u64),
    Texto(String),
}

impl Ord for IdentificadorPre {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (Self::Numerico(a), Self::Numerico(b)) => a.cmp(b),
            (Self::Numerico(_), Self::Texto(_)) => Ordering::Less,
            (Self::Texto(_), Self::Numerico(_)) => Ordering::Greater,
            (Self::Texto(a), Self::Texto(b)) => a.cmp(b),
        }
    }
}

impl PartialOrd for IdentificadorPre {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for VersionSemantica {
    fn cmp(&self, other: &Self) -> Ordering {
        let base = (self.mayor, self.menor, self.parche).cmp(&(
            other.mayor,
            other.menor,
            other.parche,
        ));
        if base != Ordering::Equal {
            return base;
        }

        match (self.pre_lanzamiento.is_empty(), other.pre_lanzamiento.is_empty()) {
            (true, true) => Ordering::Equal,
            (true, false) => Ordering::Greater,
            (false, true) => Ordering::Less,
            (false, false) => self.pre_lanzamiento.cmp(&other.pre_lanzamiento),
        }
    }
}

impl PartialOrd for VersionSemantica {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl VersionSemantica {
    fn parsear(entrada: &str) -> Result<Self, ErrorNucleo> {
        let sin_metadatos = entrada.split('+').next().unwrap_or("");
        let (nucleo, pre) = match sin_metadatos.split_once('-') {
            Some((izq, der)) => {
                if der.is_empty() {
                    return Err(ErrorNucleo::IntegridadInvalida);
                }
                (izq, Some(der))
            }
            None => (sin_metadatos, None),
        };

        let partes: Vec<&str> = nucleo.split('.').collect();
        if partes.len() != 3 {
            return Err(ErrorNucleo::IntegridadInvalida);
        }

        let mayor = parsear_componente_numerico(partes[0])?;
        let menor = parsear_componente_numerico(partes[1])?;
        let parche = parsear_componente_numerico(partes[2])?;

        let mut pre_lanzamiento = Vec::new();
        if let Some(cadena_pre) = pre {
            for segmento in cadena_pre.split('.') {
                if segmento.is_empty() {
                    return Err(ErrorNucleo::IntegridadInvalida);
                }
                if segmento.bytes().all(|b| b.is_ascii_digit()) {
                    let numero = segmento
                        .parse::<u64>()
                        .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
                    pre_lanzamiento.push(IdentificadorPre::Numerico(numero));
                } else if segmento
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
                {
                    pre_lanzamiento.push(IdentificadorPre::Texto(segmento.to_string()));
                } else {
                    return Err(ErrorNucleo::IntegridadInvalida);
                }
            }
        }

        Ok(Self {
            mayor,
            menor,
            parche,
            pre_lanzamiento,
        })
    }
}

fn parsear_componente_numerico(parte: &str) -> Result<u64, ErrorNucleo> {
    if parte.is_empty() || !parte.bytes().all(|b| b.is_ascii_digit()) {
        return Err(ErrorNucleo::IntegridadInvalida);
    }
    parte
        .parse::<u64>()
        .map_err(|_| ErrorNucleo::IntegridadInvalida)
}

fn decodificar_hex_fijo<const N: usize>(hex: &str) -> Result<[u8; N], ErrorNucleo> {
    if hex.len() != N * 2 {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let bytes = hex.as_bytes();
    let mut salida = [0u8; N];
    for (i, byte_salida) in salida.iter_mut().enumerate() {
        let alto = valor_nibble(bytes[i * 2])?;
        let bajo = valor_nibble(bytes[i * 2 + 1])?;
        *byte_salida = (alto << 4) | bajo;
    }
    Ok(salida)
}

fn valor_nibble(caracter: u8) -> Result<u8, ErrorNucleo> {
    match caracter {
        b'0'..=b'9' => Ok(caracter - b'0'),
        b'a'..=b'f' => Ok(caracter - b'a' + 10),
        b'A'..=b'F' => Ok(caracter - b'A' + 10),
        _ => Err(ErrorNucleo::IntegridadInvalida),
    }
}

fn comparacion_tiempo_constante(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut acumulado: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        acumulado |= x ^ y;
    }
    std::hint::black_box(acumulado) == 0
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use trama::CredencialFirma;

    fn codificar_hex(bytes: &[u8]) -> String {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut salida = String::with_capacity(bytes.len() * 2);
        for &b in bytes {
            salida.push(HEX[(b >> 4) as usize] as char);
            salida.push(HEX[(b & 0x0f) as usize] as char);
        }
        salida
    }

    fn emitir_manifiesto_firmado(
        version: &str,
        bytes_instalador: &[u8],
        credencial: &CredencialFirma,
    ) -> ManifiestoVersion {
        let hash_hex = blake3::hash(bytes_instalador).to_hex().to_string();
        let mensaje = format!("{version}|{hash_hex}");
        let firma = credencial.firmar(mensaje.as_bytes());
        ManifiestoVersion {
            version_semantica: version.to_string(),
            hash_blake3: hash_hex,
            firma_ed25519_hex: codificar_hex(&firma),
            ruta_instalador_s3: format!("instaladores/MiPlus-{version}.exe"),
            obligatoria: false,
        }
    }

    fn directorio_pruebas(subcarpeta: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("target")
            .join("pruebas_actualizador")
            .join(subcarpeta)
    }

    #[test]
    fn comparacion_semantica_y_disponibilidad() {
        assert_eq!(
            comparar_versiones_semanticas("1.2.3", "1.2.3").expect("version igual"),
            Ordering::Equal
        );
        assert_eq!(
            comparar_versiones_semanticas("1.2.3", "1.2.4").expect("parche superior"),
            Ordering::Less
        );
        assert_eq!(
            comparar_versiones_semanticas("1.10.0", "1.2.9").expect("menor numerico"),
            Ordering::Greater
        );
        assert_eq!(
            comparar_versiones_semanticas("2.0.0-rc.1", "2.0.0").expect("prelanzamiento"),
            Ordering::Less
        );
        assert!(comparar_versiones_semanticas("1.2", "1.2.3").is_err());

        let credencial = CredencialFirma::generar();
        let manifiesto = emitir_manifiesto_firmado("1.3.0", b"instalador", &credencial);
        assert!(hay_actualizacion_disponible("1.2.9", &manifiesto).expect("disponible"));
        assert!(!hay_actualizacion_disponible("1.3.0", &manifiesto).expect("misma version"));
        assert!(!hay_actualizacion_disponible("1.4.0", &manifiesto).expect("version superior"));
    }

    #[test]
    fn verificacion_exitosa_blake3_y_ed25519() {
        let credencial = CredencialFirma::generar();
        let publica = credencial.verificacion();
        let carga = b"binario-instalador-miplus-firmado";
        let manifiesto = emitir_manifiesto_firmado("2.1.0", carga, &credencial);

        assert!(verificar_instalador_firmado(carga, &manifiesto, &publica).is_ok());
    }

    #[test]
    fn rechazo_por_hash_alterado() {
        let credencial = CredencialFirma::generar();
        let publica = credencial.verificacion();
        let carga = b"binario-instalador-original";
        let manifiesto = emitir_manifiesto_firmado("2.1.0", carga, &credencial);

        let carga_alterada = b"binario-instalador-corrupto";
        let resultado = verificar_instalador_firmado(carga_alterada, &manifiesto, &publica);
        assert!(matches!(resultado, Err(ErrorNucleo::IntegridadInvalida)));
    }

    #[test]
    fn rechazo_por_firma_alterada() {
        let credencial = CredencialFirma::generar();
        let publica = credencial.verificacion();
        let carga = b"binario-instalador-original";
        let mut manifiesto = emitir_manifiesto_firmado("2.1.0", carga, &credencial);

        let mut firma_alterada = manifiesto.firma_ed25519_hex.into_bytes();
        firma_alterada[0] = if firma_alterada[0] == b'0' { b'1' } else { b'0' };
        manifiesto.firma_ed25519_hex =
            String::from_utf8(firma_alterada).expect("hex valido");

        let resultado = verificar_instalador_firmado(carga, &manifiesto, &publica);
        assert!(matches!(resultado, Err(ErrorNucleo::IntegridadInvalida)));
    }

    #[test]
    fn rechazo_por_version_alterada_sin_refirmar() {
        let credencial = CredencialFirma::generar();
        let publica = credencial.verificacion();
        let carga = b"binario-instalador-original";
        let mut manifiesto = emitir_manifiesto_firmado("2.1.0", carga, &credencial);

        manifiesto.version_semantica = "9.9.9".to_string();

        let resultado = verificar_instalador_firmado(carga, &manifiesto, &publica);
        assert!(matches!(resultado, Err(ErrorNucleo::IntegridadInvalida)));
    }

    #[test]
    fn escritura_bloqueada_en_disco_ante_firma_invalida() {
        let credencial = CredencialFirma::generar();
        let publica = credencial.verificacion();
        let carga = b"binario-instalador-original";
        let mut manifiesto = emitir_manifiesto_firmado("2.1.0", carga, &credencial);
        manifiesto.firma_ed25519_hex = "00".repeat(64);

        let carpeta = directorio_pruebas("bloqueo_firma");
        let ruta_destino = carpeta.join("MiPlus-Setup.exe");
        let _ = fs::remove_file(&ruta_destino);

        let resultado =
            preparar_instalacion_silenciosa(&ruta_destino, carga, &manifiesto, &publica);
        assert!(matches!(resultado, Err(ErrorNucleo::IntegridadInvalida)));
        assert!(!ruta_destino.exists());
    }

    #[test]
    fn preparacion_exitosa_genera_archivo_y_comando_nsis_seguro() {
        let credencial = CredencialFirma::generar();
        let publica = credencial.verificacion();
        let carga = b"MZ-contenido-instalador-valido";
        let manifiesto = emitir_manifiesto_firmado("2.2.0", carga, &credencial);

        let carpeta = directorio_pruebas("exito_nsis");
        let ruta_destino = carpeta.join("MiPlus-2.2.0.exe");
        let _ = fs::remove_file(&ruta_destino);

        let comando = preparar_comando_instalacion_silenciosa(
            &ruta_destino,
            carga,
            &manifiesto,
            &publica,
        )
        .expect("preparacion valida");

        assert_eq!(comando.ejecutable, ruta_destino);
        assert_eq!(comando.argumentos, vec!["/S".to_string()]);
        assert_eq!(fs::read(&ruta_destino).expect("lectura"), carga);

        let _ = fs::remove_file(&ruta_destino);
        let _ = fs::remove_dir(&carpeta);
    }
}

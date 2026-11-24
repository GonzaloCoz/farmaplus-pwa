use std::ptr;

use comun::ErrorNucleo;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Contenedor en memoria para credenciales o llaves sensibles con borrado seguro al soltar.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct MaterialSensible(Vec<u8>);

impl MaterialSensible {
    /// Construye un contenedor sensible tomando posesion del vector de bytes.
    pub fn desde_bytes(datos: Vec<u8>) -> Self {
        Self(datos)
    }

    /// Expone el contenido como slice de solo lectura sin copiarlo.
    pub fn como_bytes(&self) -> &[u8] {
        &self.0
    }

    /// Cantidad de bytes protegidos en memoria.
    pub fn longitud(&self) -> usize {
        self.0.len()
    }

    /// Indica si el material almacenado esta vacio.
    pub fn esta_vacio(&self) -> bool {
        self.0.is_empty()
    }
}

impl AsRef<[u8]> for MaterialSensible {
    fn as_ref(&self) -> &[u8] {
        self.como_bytes()
    }
}

impl std::fmt::Debug for MaterialSensible {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("MaterialSensible([protegido])")
    }
}

/// Sella datos locales vinculados al usuario/equipo actual mediante Windows DPAPI.
#[cfg(windows)]
pub fn sellar_local(datos: &[u8]) -> Result<Vec<u8>, ErrorNucleo> {
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let tamanio = u32::try_from(datos.len()).map_err(|_| ErrorNucleo::AlmacenLocal)?;
    let entrada = CRYPT_INTEGER_BLOB {
        cbData: tamanio,
        pbData: datos.as_ptr().cast_mut(),
    };
    let mut salida = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    // SAFETY: `entrada` apunta a `datos` valido durante la llamada; `salida` es inicializada por Win32.
    let ok = unsafe {
        CryptProtectData(
            &entrada,
            ptr::null(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut salida,
        )
    };

    let _resguardo = ResguardoLocal {
        puntero: salida.pbData,
        largo: salida.cbData as usize,
        limpiar_al_liberar: false,
    };

    if ok == 0 {
        return Err(ErrorNucleo::AlmacenLocal);
    }
    if salida.cbData == 0 {
        return Ok(Vec::new());
    }
    if salida.pbData.is_null() {
        return Err(ErrorNucleo::AlmacenLocal);
    }

    // SAFETY: `CryptProtectData` tuvo exito y reporto `cbData` bytes validos en `pbData`.
    let bloque = unsafe { std::slice::from_raw_parts(salida.pbData, salida.cbData as usize) };
    Ok(bloque.to_vec())
}

/// Abre un bloque previamente sellado con `sellar_local` mediante Windows DPAPI.
#[cfg(windows)]
pub fn abrir_sello(bloque: &[u8]) -> Result<MaterialSensible, ErrorNucleo> {
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    if bloque.is_empty() {
        return Err(ErrorNucleo::AlmacenLocal);
    }

    let tamanio = u32::try_from(bloque.len()).map_err(|_| ErrorNucleo::AlmacenLocal)?;
    let entrada = CRYPT_INTEGER_BLOB {
        cbData: tamanio,
        pbData: bloque.as_ptr().cast_mut(),
    };
    let mut salida = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    // SAFETY: `entrada` apunta a `bloque` valido durante la llamada; `ppszDataDescr` es nulo para evitar asignacion extra.
    let ok = unsafe {
        CryptUnprotectData(
            &entrada,
            ptr::null_mut(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut salida,
        )
    };

    let _resguardo = ResguardoLocal {
        puntero: salida.pbData,
        largo: salida.cbData as usize,
        limpiar_al_liberar: true,
    };

    if ok == 0 {
        return Err(ErrorNucleo::AlmacenLocal);
    }
    if salida.cbData == 0 {
        return Ok(MaterialSensible::desde_bytes(Vec::new()));
    }
    if salida.pbData.is_null() {
        return Err(ErrorNucleo::AlmacenLocal);
    }

    // SAFETY: `CryptUnprotectData` tuvo exito y reporto `cbData` bytes validos en `pbData`.
    let plano = unsafe { std::slice::from_raw_parts(salida.pbData, salida.cbData as usize) };
    Ok(MaterialSensible::desde_bytes(plano.to_vec()))
}

#[cfg(windows)]
struct ResguardoLocal {
    puntero: *mut u8,
    largo: usize,
    limpiar_al_liberar: bool,
}

#[cfg(windows)]
impl Drop for ResguardoLocal {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::{LocalFree, HLOCAL};

        if !self.puntero.is_null() {
            if self.limpiar_al_liberar && self.largo > 0 {
                // SAFETY: `puntero` pertenece al bloque asignado por DPAPI con `largo` bytes validos.
                let porcion = unsafe { std::slice::from_raw_parts_mut(self.puntero, self.largo) };
                porcion.zeroize();
            }
            // SAFETY: `puntero` fue asignado por Windows DPAPI y debe liberarse con `LocalFree`.
            unsafe {
                let _ = LocalFree(self.puntero as HLOCAL);
            }
        }
    }
}

/// En plataformas distintas de Windows, el sellado DPAPI no esta disponible.
#[cfg(not(windows))]
pub fn sellar_local(_datos: &[u8]) -> Result<Vec<u8>, ErrorNucleo> {
    Err(ErrorNucleo::AlmacenLocal)
}

/// En plataformas distintas de Windows, la apertura de sellos DPAPI no esta disponible.
#[cfg(not(windows))]
pub fn abrir_sello(_bloque: &[u8]) -> Result<MaterialSensible, ErrorNucleo> {
    Err(ErrorNucleo::AlmacenLocal)
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn depuracion_no_expone_material_sensible() {
        let material = MaterialSensible::desde_bytes(b"cadena-muy-sensible".to_vec());
        let texto = format!("{material:?}");
        assert!(!texto.contains("cadena-muy-sensible"));
        assert!(texto.contains("protegido"));
    }

    #[test]
    fn borrado_manual_de_material_sensible() {
        let mut material = MaterialSensible::desde_bytes(vec![0xAA; 32]);
        assert_eq!(material.longitud(), 32);
        material.zeroize();
        assert!(material.esta_vacio());
    }

    #[cfg(windows)]
    #[test]
    fn ida_y_vuelta_dpapi_en_windows() {
        let original = b"credencial-local-sucursal-14-plex";
        let sellado = sellar_local(original).expect("DPAPI deberia sellar sin errores");
        assert_ne!(sellado.as_slice(), original);

        let abierto = abrir_sello(&sellado).expect("DPAPI deberia abrir el bloque sellado");
        assert_eq!(abierto.como_bytes(), original);
    }

    #[cfg(windows)]
    #[test]
    fn ida_y_vuelta_dpapi_vacio_en_windows() {
        let sellado = sellar_local(&[]).expect("DPAPI deberia sellar slice vacio");
        let abierto = abrir_sello(&sellado).expect("DPAPI deberia abrir slice vacio");
        assert!(abierto.esta_vacio());
    }

    #[cfg(windows)]
    #[test]
    fn abrir_sello_invalido_devuelve_error() {
        assert!(matches!(abrir_sello(&[]), Err(ErrorNucleo::AlmacenLocal)));

        let mut sellado = sellar_local(b"dato-valido").expect("sellado inicial");
        let indice = sellado.len() / 2;
        sellado[indice] ^= 0xFF;
        assert!(matches!(
            abrir_sello(&sellado),
            Err(ErrorNucleo::AlmacenLocal)
        ));
    }
}

use std::fs;
use std::path::PathBuf;

use comun::ErrorNucleo;
use serde::{Deserialize, Serialize};

/// Estado observable de la terminal local de Plex en el puesto de farmacia.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EstadoTerminalLocal {
    pub en_ejecucion: bool,
    pub sesion_iniciada: bool,
    pub operador: Option<String>,
    pub pantalla: Option<String>,
    pub pid: Option<u32>,
    pub terminal: Option<String>,
}

#[derive(Debug, Default)]
struct ResumenVentanas {
    principal_encontrada: bool,
    principal_visible: bool,
    principal_minimizada: bool,
    titulo_principal: Option<String>,
    tiene_modal_bloqueo: bool,
    titulo_modal_bloqueo: Option<String>,
}

/// Verifica en el sistema operativo local si Plex esta en ejecucion y con sesion activa.
pub fn verificar_terminal_local() -> Result<EstadoTerminalLocal, ErrorNucleo> {
    #[cfg(windows)]
    {
        verificar_terminal_windows()
    }

    #[cfg(not(windows))]
    {
        Ok(EstadoTerminalLocal {
            en_ejecucion: false,
            sesion_iniciada: false,
            operador: None,
            pantalla: Some(String::from("Entorno no Windows")),
            pid: None,
            terminal: None,
        })
    }
}

#[cfg(windows)]
fn verificar_terminal_windows() -> Result<EstadoTerminalLocal, ErrorNucleo> {
    let Some(pid) = win::buscar_pid_plex() else {
        return Ok(EstadoTerminalLocal {
            en_ejecucion: false,
            sesion_iniciada: false,
            operador: None,
            pantalla: None,
            pid: None,
            terminal: None,
        });
    };

    let resumen = win::inspeccionar_ventanas_pid(pid);
    let (ultimo_usuario, terminal) = buscar_config_ini(pid).unwrap_or((None, None));

    Ok(construir_estado_terminal(
        pid,
        resumen,
        ultimo_usuario,
        terminal,
    ))
}

fn construir_estado_terminal(
    pid: u32,
    resumen: ResumenVentanas,
    ultimo_usuario: Option<String>,
    terminal: Option<String>,
) -> EstadoTerminalLocal {
    let sesion_iniciada = !resumen.tiene_modal_bloqueo
        && resumen.principal_encontrada
        && (resumen.principal_visible || resumen.principal_minimizada);

    let pantalla = if resumen.tiene_modal_bloqueo {
        resumen
            .titulo_modal_bloqueo
            .unwrap_or_else(|| String::from("Pase su credencial por el lector..."))
    } else if sesion_iniciada {
        if resumen.principal_minimizada {
            String::from("Plex 25 (Minimizado)")
        } else {
            resumen
                .titulo_principal
                .unwrap_or_else(|| String::from("Plex 25 Activo"))
        }
    } else if resumen.principal_encontrada {
        String::from("Plex 25 en ejecucion")
    } else {
        String::from("Plex 25 Iniciando...")
    };

    let operador = if sesion_iniciada {
        ultimo_usuario.filter(|valor| !valor.trim().is_empty())
    } else {
        None
    };

    EstadoTerminalLocal {
        en_ejecucion: true,
        sesion_iniciada,
        operador,
        pantalla: Some(pantalla),
        pid: Some(pid),
        terminal: terminal.filter(|valor| !valor.trim().is_empty()),
    }
}

fn es_modal_bloqueo(clase: &str, titulo: &str, visible: bool) -> bool {
    if !visible {
        return false;
    }
    let clase_min = clase.to_ascii_lowercase();
    let titulo_min = titulo.to_ascii_lowercase();

    clase_min.contains("splash")
        || clase_min.contains("logon")
        || clase_min.contains("login")
        || clase_min.contains("credencial")
        || titulo_min.contains("credencial")
        || titulo_min.contains("plexdk")
        || titulo_min.contains("iniciar sesi")
        || titulo_min.contains("bloqueo")
        || titulo_min == "shappo"
}

fn registrar_ventana_en_resumen(
    resumen: &mut ResumenVentanas,
    clase: &str,
    titulo: &str,
    visible: bool,
    minimizada: bool,
) {
    if es_modal_bloqueo(clase, titulo, visible) {
        resumen.tiene_modal_bloqueo = true;
        let texto_modal = titulo.trim();
        resumen.titulo_modal_bloqueo = Some(if texto_modal.is_empty() {
            String::from("Pase su credencial por el lector...")
        } else {
            texto_modal.to_owned()
        });
    }

    if clase.eq_ignore_ascii_case("tformprincipal") {
        resumen.principal_encontrada = true;
        resumen.principal_visible = visible;
        resumen.principal_minimizada = minimizada;
        let texto_titulo = titulo.trim();
        if !texto_titulo.is_empty() {
            resumen.titulo_principal = Some(texto_titulo.to_owned());
        }
    }
}

fn parsear_config_ini(contenido: &str) -> (Option<String>, Option<String>) {
    let mut ultimo_usuario: Option<String> = None;
    let mut terminal: Option<String> = None;

    for linea in contenido.lines() {
        let limpia = linea.trim();
        if limpia.is_empty()
            || limpia.starts_with('[')
            || limpia.starts_with(';')
            || limpia.starts_with('#')
        {
            continue;
        }
        if let Some(pos) = limpia.find('=') {
            let campo = limpia[..pos].trim().to_ascii_lowercase();
            let valor = limpia[pos + 1..].trim();
            if campo == "lastuser" && !valor.is_empty() {
                ultimo_usuario = Some(valor.to_owned());
            } else if campo == "terminal" && !valor.is_empty() {
                terminal = Some(valor.to_owned());
            }
        }
    }

    (ultimo_usuario, terminal)
}

#[cfg(windows)]
fn buscar_config_ini(pid: u32) -> Option<(Option<String>, Option<String>)> {
    let mut directorios = win::directorios_desde_pid(pid);
    directorios.extend([
        PathBuf::from(r"C:\Plex 25\Gestion"),
        PathBuf::from(r"C:\Plex 25"),
        PathBuf::from(r"C:\Proyectos\RePlex\Gestion"),
        PathBuf::from(r"C:\Proyectos\RePlex"),
        PathBuf::from(r"C:\Plex\Gestion"),
        PathBuf::from(r"C:\Plex"),
        PathBuf::from(r"D:\Plex 25\Gestion"),
        PathBuf::from(r"D:\Plex\Gestion"),
    ]);

    for directorio in directorios {
        let ruta = directorio.join("Config.ini");
        if ruta.is_file() {
            if let Ok(bytes) = fs::read(&ruta) {
                let texto = String::from_utf8_lossy(&bytes);
                return Some(parsear_config_ini(&texto));
            }
        }
    }

    None
}

#[cfg(windows)]
mod win {
    use std::path::PathBuf;

    use windows_sys::Win32::Foundation::{
        CloseHandle, BOOL, HANDLE, HWND, INVALID_HANDLE_VALUE, LPARAM,
    };
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClassNameW, GetWindowTextW, GetWindowThreadProcessId, IsIconic,
        IsWindowVisible,
    };

    use super::{registrar_ventana_en_resumen, ResumenVentanas};

    struct GuardiaManejador(HANDLE);

    impl Drop for GuardiaManejador {
        fn drop(&mut self) {
            if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
                // SAFETY: El manejador fue obtenido de CreateToolhelp32Snapshot u OpenProcess y no ha sido cerrado.
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    struct ContextoEnumeracion {
        pid_objetivo: u32,
        resumen: ResumenVentanas,
    }

    pub fn buscar_pid_plex() -> Option<u32> {
        // SAFETY: CreateToolhelp32Snapshot con TH32CS_SNAPPROCESS y pid 0 no requiere punteros de entrada.
        let captura = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if captura.is_null() || captura == INVALID_HANDLE_VALUE {
            return None;
        }
        let _guardia = GuardiaManejador(captura);

        let mut entrada: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
        entrada.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        // SAFETY: `entrada` tiene dwSize inicializado al tamanio exacto de PROCESSENTRY32W.
        if unsafe { Process32FirstW(captura, &mut entrada) } == 0 {
            return None;
        }

        loop {
            let longitud = entrada
                .szExeFile
                .iter()
                .position(|&caracter| caracter == 0)
                .unwrap_or(entrada.szExeFile.len());
            let ejecutable = String::from_utf16_lossy(&entrada.szExeFile[..longitud]);
            if ejecutable.eq_ignore_ascii_case("plexonze.exe")
                || ejecutable.eq_ignore_ascii_case("plexonze")
            {
                return Some(entrada.th32ProcessID);
            }

            // SAFETY: `captura` y `entrada` siguen siendo validos durante toda la iteracion.
            if unsafe { Process32NextW(captura, &mut entrada) } == 0 {
                break;
            }
        }

        None
    }

    pub fn inspeccionar_ventanas_pid(pid: u32) -> ResumenVentanas {
        let mut contexto = ContextoEnumeracion {
            pid_objetivo: pid,
            resumen: ResumenVentanas::default(),
        };

        // SAFETY: El puntero a `contexto` vive durante toda la ejecucion sincrona de EnumWindows.
        unsafe {
            EnumWindows(
                Some(enumerar_ventanas_callback),
                &mut contexto as *mut ContextoEnumeracion as LPARAM,
            );
        }

        contexto.resumen
    }

    pub fn directorios_desde_pid(pid: u32) -> Vec<PathBuf> {
        let mut directorios = Vec::new();
        // SAFETY: OpenProcess con PROCESS_QUERY_LIMITED_INFORMATION devuelve un manejador valido o nulo.
        let proceso = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if proceso.is_null() || proceso == INVALID_HANDLE_VALUE {
            return directorios;
        }
        let _guardia = GuardiaManejador(proceso);

        let mut respaldo = [0u16; 1024];
        let mut longitud = respaldo.len() as u32;
        // SAFETY: `respaldo` tiene capacidad suficiente y `longitud` refleja su tamanio en UTF-16.
        let exito =
            unsafe { QueryFullProcessImageNameW(proceso, 0, respaldo.as_mut_ptr(), &mut longitud) };
        if exito != 0 && longitud > 0 {
            let ruta_texto = String::from_utf16_lossy(&respaldo[..longitud as usize]);
            let ruta = PathBuf::from(ruta_texto);
            if let Some(carpeta_padre) = ruta.parent() {
                directorios.push(carpeta_padre.to_path_buf());
                directorios.push(carpeta_padre.join("Gestion"));
            }
        }

        directorios
    }

    unsafe extern "system" fn enumerar_ventanas_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if lparam == 0 {
            return 0;
        }
        // SAFETY: `lparam` apunta a un ContextoEnumeracion valido en la pila del llamador.
        let contexto = &mut *(lparam as *mut ContextoEnumeracion);

        let mut pid_ventana: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid_ventana);
        if pid_ventana != contexto.pid_objetivo {
            return 1;
        }

        let visible = IsWindowVisible(hwnd) != 0;
        let minimizada = IsIconic(hwnd) != 0;

        let mut clase_buf = [0u16; 256];
        let clase_len = GetClassNameW(hwnd, clase_buf.as_mut_ptr(), clase_buf.len() as i32);
        let clase = if clase_len > 0 {
            String::from_utf16_lossy(&clase_buf[..clase_len as usize])
        } else {
            String::new()
        };

        let mut titulo_buf = [0u16; 512];
        let titulo_len = GetWindowTextW(hwnd, titulo_buf.as_mut_ptr(), titulo_buf.len() as i32);
        let titulo = if titulo_len > 0 {
            String::from_utf16_lossy(&titulo_buf[..titulo_len as usize])
        } else {
            String::new()
        };

        registrar_ventana_en_resumen(&mut contexto.resumen, &clase, &titulo, visible, minimizada);
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verificar_terminal_local_ejecuta_sin_fallos() {
        let estado = verificar_terminal_local().expect("inspeccion segura de terminal local");
        if !estado.en_ejecucion {
            assert!(!estado.sesion_iniciada);
            assert!(estado.pid.is_none());
        } else {
            assert!(estado.pid.is_some());
        }
    }

    #[test]
    fn deteccion_de_modales_de_bloqueo_y_estado_ventanas() {
        assert!(es_modal_bloqueo("TFormSplash", "Plex", true));
        assert!(es_modal_bloqueo("TFormLogon", "", true));
        assert!(es_modal_bloqueo("TFormLogin", "", true));
        assert!(es_modal_bloqueo("TFormCredencial", "", true));
        assert!(es_modal_bloqueo(
            "TForm",
            "Iniciar sesion con credencial",
            true
        ));
        assert!(es_modal_bloqueo("TForm", "PlexDK Bloqueo", true));
        assert!(es_modal_bloqueo("TForm", "shappo", true));
        assert!(!es_modal_bloqueo("TFormSplash", "Plex", false));

        let mut bloqueada = ResumenVentanas::default();
        registrar_ventana_en_resumen(&mut bloqueada, "TFormPrincipal", "Plex 25", true, false);
        registrar_ventana_en_resumen(
            &mut bloqueada,
            "TForm",
            "Bloqueo por inactividad",
            true,
            false,
        );
        let estado_bloqueado = construir_estado_terminal(
            1234,
            bloqueada,
            Some(String::from("OPERADOR1")),
            Some(String::from("TERM-01")),
        );
        assert!(estado_bloqueado.en_ejecucion);
        assert!(!estado_bloqueado.sesion_iniciada);
        assert!(estado_bloqueado.operador.is_none());
        assert_eq!(estado_bloqueado.terminal.as_deref(), Some("TERM-01"));

        let mut activa_minimizada = ResumenVentanas::default();
        registrar_ventana_en_resumen(
            &mut activa_minimizada,
            "TFormPrincipal",
            "Plex 25",
            false,
            true,
        );
        let estado_activo = construir_estado_terminal(
            1234,
            activa_minimizada,
            Some(String::from("GCOZ")),
            Some(String::from("168")),
        );
        assert!(estado_activo.en_ejecucion);
        assert!(estado_activo.sesion_iniciada);
        assert_eq!(estado_activo.operador.as_deref(), Some("GCOZ"));
        assert_eq!(
            estado_activo.pantalla.as_deref(),
            Some("Plex 25 (Minimizado)")
        );
    }

    #[test]
    fn parsea_config_ini_extrayendo_lastuser_y_terminal() {
        let contenido = "\
            ; comentario inicial\n\
            [General]\n\
            LastUser = GONZALO\n\
            Terminal = 168\n\
            OtroCampo = Valor\n\
        ";
        let (usuario, terminal) = parsear_config_ini(contenido);
        assert_eq!(usuario.as_deref(), Some("GONZALO"));
        assert_eq!(terminal.as_deref(), Some("168"));
    }
}

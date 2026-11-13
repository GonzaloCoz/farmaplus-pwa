use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlexSessionStatus {
    pub running: bool,
    pub logged_in: bool,
    pub user: Option<String>,
    pub screen: Option<String>,
    pub pid: Option<u32>,
    pub terminal: Option<String>,
    pub config_path: Option<String>,
}

#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    pub const TH32CS_SNAPPROCESS: u32 = 0x00000002;
    pub const INVALID_HANDLE_VALUE: *mut c_void = -1isize as *mut c_void;

    #[repr(C)]
    pub struct PROCESSENTRY32W {
        pub dw_size: u32,
        pub cnt_usage: u32,
        pub th32_process_id: u32,
        pub th32_default_heap_id: usize,
        pub th32_module_id: u32,
        pub cnt_threads: u32,
        pub th32_parent_process_id: u32,
        pub pc_pri_class_base: i32,
        pub dw_flags: u32,
        pub sz_exe_file: [u16; 260],
    }

    extern "system" {
        pub fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut c_void;
        pub fn Process32FirstW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        pub fn Process32NextW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        pub fn CloseHandle(h_object: *mut c_void) -> i32;
        pub fn GetWindowThreadProcessId(h_wnd: *mut c_void, lpdw_process_id: *mut u32) -> u32;
        pub fn EnumWindows(
            lp_enum_func: Option<unsafe extern "system" fn(*mut c_void, isize) -> i32>,
            l_param: isize,
        ) -> i32;
        pub fn GetClassNameW(h_wnd: *mut c_void, lp_class_name: *mut u16, n_max_count: i32) -> i32;
        pub fn GetWindowTextW(h_wnd: *mut c_void, lp_string: *mut u16, n_max_count: i32) -> i32;
        pub fn IsWindowVisible(h_wnd: *mut c_void) -> i32;
        pub fn IsWindowEnabled(h_wnd: *mut c_void) -> i32;
        pub fn IsIconic(h_wnd: *mut c_void) -> i32;
        pub fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut c_void;
        pub fn QueryFullProcessImageNameW(h_process: *mut c_void, dw_flags: u32, lp_exe_name: *mut u16, lpdw_size: *mut u32) -> i32;
    }
}

#[derive(Default)]
struct WinState {
    target_pid: u32,
    form_principal_found: bool,
    form_principal_visible: bool,
    form_principal_enabled: bool,
    form_principal_iconic: bool,
    form_principal_title: Option<String>,
    has_login_modal: bool,
    login_modal_title: Option<String>,
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_callback(h_wnd: *mut std::ffi::c_void, l_param: isize) -> i32 {
    let state = &mut *(l_param as *mut WinState);
    let mut pid: u32 = 0;
    win::GetWindowThreadProcessId(h_wnd, &mut pid);

    if pid == state.target_pid {
        let is_visible = win::IsWindowVisible(h_wnd) != 0;
        let is_enabled = win::IsWindowEnabled(h_wnd) != 0;
        let is_iconic = win::IsIconic(h_wnd) != 0;

        let mut class_buf = [0u16; 256];
        let class_len = win::GetClassNameW(h_wnd, class_buf.as_mut_ptr(), 256);
        let class_name = if class_len > 0 {
            String::from_utf16_lossy(&class_buf[..class_len as usize])
        } else {
            String::new()
        };

        let mut title_buf = [0u16; 512];
        let title_len = win::GetWindowTextW(h_wnd, title_buf.as_mut_ptr(), 512);
        let title = if title_len > 0 {
            String::from_utf16_lossy(&title_buf[..title_len as usize])
        } else {
            String::new()
        };

        let cls_lower = class_name.to_lowercase();
        let title_lower = title.to_lowercase();

        // Detección precisa de pantalla de inicio / credencial / bloqueo (TFormSplash, etc.)
        let is_login_modal = is_visible && (
            cls_lower.contains("splash")
            || cls_lower.contains("logon")
            || cls_lower.contains("login")
            || cls_lower.contains("credencial")
            || title_lower.contains("credencial")
            || title_lower.contains("plexdk")
            || title_lower.contains("iniciar sesi")
            || title_lower.contains("bloqueo")
            || title_lower == "shappo"
        );

        if is_login_modal {
            state.has_login_modal = true;
            state.login_modal_title = Some(if !title.is_empty() {
                title.clone()
            } else {
                "Pase su credencial por el lector...".to_string()
            });
        }

        if cls_lower == "tformprincipal" {
            state.form_principal_found = true;
            state.form_principal_visible = is_visible;
            state.form_principal_enabled = is_enabled;
            state.form_principal_iconic = is_iconic;
            if !title.is_empty() {
                state.form_principal_title = Some(title);
            }
        }
    }

    1 // continuar enumeración
}

/// Busca el PID de PlexOnze.exe
#[cfg(windows)]
fn find_plex_pid() -> Option<u32> {
    unsafe {
        let snapshot = win::CreateToolhelp32Snapshot(win::TH32CS_SNAPPROCESS, 0);
        if snapshot == win::INVALID_HANDLE_VALUE {
            return None;
        }

        let mut entry = win::PROCESSENTRY32W {
            dw_size: std::mem::size_of::<win::PROCESSENTRY32W>() as u32,
            cnt_usage: 0,
            th32_process_id: 0,
            th32_default_heap_id: 0,
            th32_module_id: 0,
            cnt_threads: 0,
            th32_parent_process_id: 0,
            pc_pri_class_base: 0,
            dw_flags: 0,
            sz_exe_file: [0u16; 260],
        };

        let mut found_pid: Option<u32> = None;
        if win::Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let null_pos = entry
                    .sz_exe_file
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.sz_exe_file.len());
                let exe_name = String::from_utf16_lossy(&entry.sz_exe_file[..null_pos]).to_lowercase();

                if exe_name == "plexonze.exe" || exe_name == "plexonze" {
                    found_pid = Some(entry.th32_process_id);
                    break;
                }

                if win::Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        win::CloseHandle(snapshot);
        found_pid
    }
}

#[cfg(not(windows))]
fn find_plex_pid() -> Option<u32> {
    None
}

/// Obtiene las carpetas candidatas de ejecución de Plex
fn get_plex_dirs(pid: Option<u32>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    if let Some(p) = pid {
        unsafe {
            let h = win::OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, 0, p);
            if !h.is_null() && h != win::INVALID_HANDLE_VALUE {
                let mut buf = [0u16; 1024];
                let mut size = buf.len() as u32;
                if win::QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut size) != 0 && size > 0 {
                    let exe_path_str = String::from_utf16_lossy(&buf[..size as usize]);
                    let exe_path = PathBuf::from(exe_path_str);
                    if let Some(parent) = exe_path.parent() {
                        dirs.push(parent.to_path_buf());
                        dirs.push(parent.join("Gestion"));
                    }
                }
                win::CloseHandle(h);
            }
        }
    }

    dirs.extend([
        PathBuf::from(r"C:\Plex 25\Gestion"),
        PathBuf::from(r"C:\Plex 25"),
        PathBuf::from(r"C:\Proyectos\RePlex\Gestion"),
        PathBuf::from(r"C:\Proyectos\RePlex"),
        PathBuf::from(r"C:\Plex\Gestion"),
        PathBuf::from(r"C:\Plex"),
        PathBuf::from(r"D:\Plex 25\Gestion"),
        PathBuf::from(r"D:\Plex\Gestion"),
    ]);

    dirs
}

/// Localiza el archivo Config.ini de Plex para extraer Terminal y último usuario
fn find_plex_config_file(pid: Option<u32>) -> Option<(PathBuf, String, String)> {
    let dirs = get_plex_dirs(pid);

    for dir in dirs {
        let p = dir.join("Config.ini");
        if p.exists() {
            if let Ok(content) = fs::read_to_string(&p) {
                let mut last_user = String::new();
                let mut terminal = String::new();

                for line in content.lines() {
                    let trimmed = line.trim();
                    if let Some(pos) = trimmed.find('=') {
                        let key = trimmed[..pos].trim().to_lowercase();
                        let val = trimmed[pos + 1..].trim();
                        if key == "lastuser" {
                            last_user = val.to_string();
                        } else if key == "terminal" {
                            terminal = val.to_string();
                        }
                    }
                }

                return Some((p, last_user, terminal));
            }
        }
    }

    None
}

/// Detección limpia de Plex en la PC (Plex ejecutándose y ventana principal activa)
#[tauri::command]
pub fn check_plex_session() -> Result<PlexSessionStatus, String> {
    #[cfg(windows)]
    {
        let pid = find_plex_pid();
        if pid.is_none() {
            return Ok(PlexSessionStatus {
                running: false,
                logged_in: false,
                user: None,
                screen: None,
                pid: None,
                terminal: None,
                config_path: None,
            });
        }

        let pid_val = pid.unwrap();
        let mut state = WinState {
            target_pid: pid_val,
            ..Default::default()
        };

        unsafe {
            win::EnumWindows(
                Some(enum_windows_callback),
                &mut state as *mut WinState as isize,
            );
        }

        let (_cfg_path, cfg_user, cfg_term) = find_plex_config_file(pid)
            .unwrap_or((PathBuf::new(), String::new(), String::new()));

        let is_logged_in = !state.has_login_modal && state.form_principal_found && (state.form_principal_visible || state.form_principal_iconic);

        let screen = if state.has_login_modal {
            state.login_modal_title.unwrap_or_else(|| "Pase su credencial por el lector...".to_string())
        } else if is_logged_in {
            if state.form_principal_iconic {
                "Plex 25 (Minimizado)".to_string()
            } else {
                state.form_principal_title.unwrap_or_else(|| "Plex 25 Activo".to_string())
            }
        } else if state.form_principal_found {
            "Plex 25 en ejecución".to_string()
        } else {
            "Plex 25 Iniciando...".to_string()
        };

        Ok(PlexSessionStatus {
            running: true,
            logged_in: is_logged_in,
            user: if is_logged_in && !cfg_user.is_empty() { Some(cfg_user) } else { None },
            screen: Some(screen),
            pid: Some(pid_val),
            terminal: if !cfg_term.is_empty() { Some(cfg_term) } else { None },
            config_path: None,
        })
    }

    #[cfg(not(windows))]
    {
        Ok(PlexSessionStatus {
            running: false,
            logged_in: false,
            user: None,
            screen: Some("No-Windows OS".to_string()),
            pid: None,
            terminal: None,
            config_path: None,
        })
    }
}

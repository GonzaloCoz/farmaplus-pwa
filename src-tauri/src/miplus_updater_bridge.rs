use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn check_miplus_updater_status() -> bool {
    // Native cmd updater is always available
    true
}

#[tauri::command]
pub async fn apply_miplus_update(download_url: String) -> Result<(), String> {
    let trimmed_url = download_url.trim();
    let allowed_origins = [
        "https://github.com/GonzaloCoz/Farmaplus/releases/",
        "https://objects.githubusercontent.com/",
        "https://supabase.halu.com.ar/",
    ];
    if !allowed_origins.iter().any(|prefix| trimmed_url.starts_with(prefix)) {
        return Err("Origen de actualización no autorizado por política de seguridad.".to_string());
    }

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_dir = current_exe
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "No se pudo determinar el directorio de instalación.".to_string())?;

    let temp_dir = current_dir.join("temp");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Error al crear carpeta temporal: {}", e))?;

    let is_zip = trimmed_url.to_lowercase().ends_with(".zip");

    if is_zip {
        let zip_file = temp_dir.join("update.zip");
        let mut curl = Command::new("curl.exe");
        curl.args(["--proto", "=https", "--tlsv1.2", "-L", "-f", "-s", "-S", "-o", zip_file.to_str().unwrap(), trimmed_url]);
        #[cfg(windows)]
        curl.creation_flags(CREATE_NO_WINDOW);

        let status = curl.status().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Error descargando el paquete de actualización.".to_string());
        }

        let mut tar = Command::new("tar.exe");
        tar.args(["-xf", zip_file.to_str().unwrap(), "-C", temp_dir.to_str().unwrap()]);
        #[cfg(windows)]
        tar.creation_flags(CREATE_NO_WINDOW);
        let _ = tar.status();
        let _ = fs::remove_file(&zip_file);
    } else {
        let target_new = temp_dir.join("MiPlus.exe");
        let mut curl = Command::new("curl.exe");
        curl.args(["--proto", "=https", "--tlsv1.2", "-L", "-f", "-s", "-S", "-o", target_new.to_str().unwrap(), trimmed_url]);
        #[cfg(windows)]
        curl.creation_flags(CREATE_NO_WINDOW);

        let status = curl.status().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Error descargando MiPlus.exe.".to_string());
        }
    }

    // Verificar que el ejecutable extraído exista y tenga cabecera PE válida ("MZ") antes de reemplazar
    let extracted_exe = temp_dir.join("MiPlus.exe");
    let exe_bytes = fs::read(&extracted_exe)
        .map_err(|_| "El paquete descargado no contiene un ejecutable MiPlus.exe válido.".to_string())?;
    if exe_bytes.len() < 1024 || &exe_bytes[0..2] != b"MZ" {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("Verificación de integridad fallida: el binario descargado no es un ejecutable Windows válido.".to_string());
    }

    // Native Windows cmd command: wait for exit -> replace -> cleanup -> relaunch
    let swap_cmd = "timeout /t 2 /nobreak >nul & move /y temp\\MiPlus.exe MiPlus.exe & rmdir /s /q temp & start \"\" MiPlus.exe";
    let mut cmd = Command::new("cmd.exe");
    cmd.args(["/C", swap_cmd]);
    cmd.current_dir(&current_dir);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn().map_err(|e| e.to_string())?;

    std::process::exit(0);
}

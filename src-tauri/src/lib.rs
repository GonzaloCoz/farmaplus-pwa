#![allow(linker_messages)]

use tauri::Manager;

mod plex;
mod mysql_bridge;
mod local_db;
mod plex_session;
mod miplus_updater_bridge;

#[cfg(windows)]
fn ensure_shortcuts(force: bool) {
  use std::os::windows::process::CommandExt;

  let Ok(current_exe) = std::env::current_exe() else { return; };
  let Some(parent_dir) = current_exe.parent() else { return; };

  let exe_path_str = current_exe.to_string_lossy();
  if exe_path_str.contains(r"target\debug") {
    return;
  }

  let desktop_exists = std::env::var("USERPROFILE")
    .map(|u| std::path::Path::new(&u).join("Desktop").join("MiPlus.lnk").exists())
    .unwrap_or(false);
  let startup_exists = std::env::var("APPDATA")
    .map(|a| std::path::Path::new(&a).join(r"Microsoft\Windows\Start Menu\Programs\Startup").join("MiPlus.lnk").exists())
    .unwrap_or(false);

  if !force && desktop_exists && startup_exists {
    return;
  }

  let temp_vbs = std::env::temp_dir().join(format!("miplus_sc_{}.vbs", std::process::id()));
  let vbs_content = format!(
    "Set oWS = CreateObject(\"WScript.Shell\")\r\n\
     sDesk = oWS.SpecialFolders(\"Desktop\") & \"\\MiPlus.lnk\"\r\n\
     Set lk1 = oWS.CreateShortcut(sDesk)\r\n\
     lk1.TargetPath = \"{exe}\"\r\n\
     lk1.WorkingDirectory = \"{dir}\"\r\n\
     lk1.IconLocation = \"{exe},0\"\r\n\
     lk1.Save\r\n\
     sStart = oWS.SpecialFolders(\"Startup\") & \"\\MiPlus.lnk\"\r\n\
     Set lk2 = oWS.CreateShortcut(sStart)\r\n\
     lk2.TargetPath = \"{exe}\"\r\n\
     lk2.Arguments = \"--minimized\"\r\n\
     lk2.WorkingDirectory = \"{dir}\"\r\n\
     lk2.WindowStyle = 7\r\n\
     lk2.IconLocation = \"{exe},0\"\r\n\
     lk2.Save\r\n",
    exe = current_exe.to_string_lossy(),
    dir = parent_dir.to_string_lossy()
  );

  if std::fs::write(&temp_vbs, vbs_content).is_ok() {
    let _ = std::process::Command::new("wscript.exe")
      .arg("//B")
      .arg("//nologo")
      .arg(&temp_vbs)
      .creation_flags(0x08000000)
      .status();
    let _ = std::fs::remove_file(&temp_vbs);
  }
}

#[cfg(not(windows))]
fn ensure_shortcuts(_force: bool) {}

#[tauri::command]
fn create_desktop_and_startup_shortcuts() -> Result<bool, String> {
  ensure_shortcuts(true);
  Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      #[cfg(windows)]
      ensure_shortcuts(false);

      if std::env::args().any(|a| a == "--minimized") {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.minimize();
        }
      }
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      plex::test_plex_connection,
      plex::fetch_plex_stock,
      plex::export_plex_inventory,
      mysql_bridge::test_mysql_connection,
      mysql_bridge::list_mysql_tables,
      mysql_bridge::describe_mysql_table,
      mysql_bridge::execute_mysql_raw_query,
      mysql_bridge::fetch_mysql_stock,
      mysql_bridge::create_plex_inventory_session,
      mysql_bridge::get_plex_open_inventory_sessions,
      mysql_bridge::send_plex_inventory_api_batch,
      mysql_bridge::restore_plex_trazables,
      mysql_bridge::check_plex_batch_status,
      mysql_bridge::check_plex_inventory_adjustment,
      local_db::init_local_stock_db,
      local_db::sync_mysql_to_local_db,
      local_db::import_catalog_to_local_db,
      local_db::search_local_barcode,
      local_db::record_local_scan,
      local_db::get_local_session_summary,
      local_db::export_local_session_to_file,
      plex_session::check_plex_session,
      mysql_bridge::verify_plex_operator,
      mysql_bridge::get_plex_branch_operators,
      mysql_bridge::get_next_plex_adjustment_ids,
      mysql_bridge::execute_plex_cyclic_adjustments,
      miplus_updater_bridge::check_miplus_updater_status,
      miplus_updater_bridge::apply_miplus_update,
      create_desktop_and_startup_shortcuts
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

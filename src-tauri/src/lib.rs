mod plex;
mod mysql_bridge;
mod local_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
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
      local_db::export_local_session_to_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

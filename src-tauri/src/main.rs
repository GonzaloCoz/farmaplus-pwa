// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Disable ECH and bypass corporate VPN / FortiClient SSL inspection conflicts in WebView2
  std::env::set_var(
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "--disable-features=EncryptedClientHello --ignore-certificate-errors --allow-running-insecure-content",
  );

  farmaplus_lib::run();
}

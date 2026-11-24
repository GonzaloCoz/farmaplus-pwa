//! Anfitrion de escritorio Tauri v2 para MiPlus.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use almacen::AlmacenLocal;
use comun::{ErrorNucleo, SucursalId};
use despacho::{DespachadorComandos, ManejadorConcentrador};
use reglas::MotorReglas;
use serde_json::Value;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Manager, RunEvent, Runtime, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent,
};

/// Etiqueta canonica de la ventana principal del escritorio.
pub const ETIQUETA_VENTANA_PRINCIPAL: &str = "principal";

/// Politica de seguridad de contenido obligatoria para WebView2.
pub const CSP_OBLIGATORIA: &str = "default-src 'self'; img-src 'self' data: blob: asset: https://asset.localhost https://*.halu.com.ar; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' data: blob: https://*.halu.com.ar wss://*.halu.com.ar; worker-src 'self' blob:";

/// Decision de ciclo de vida al cerrar o minimizar una ventana del anfitrion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccionCierreVentana {
    OcultarEnBandeja,
    Ignorar,
}

/// Estado compartido del proceso anfitrion administrado por Tauri.
pub struct EstadoAnfitrion {
    despachador: Arc<Mutex<DespachadorComandos>>,
    concentrador: Mutex<Option<ManejadorConcentrador>>,
    salir_solicitado: AtomicBool,
}

impl EstadoAnfitrion {
    /// Construye el estado compartido a partir del despachador y concentrador opcional.
    pub fn crear(
        despachador: Arc<Mutex<DespachadorComandos>>,
        concentrador: Option<ManejadorConcentrador>,
    ) -> Self {
        Self {
            despachador,
            concentrador: Mutex::new(concentrador),
            salir_solicitado: AtomicBool::new(false),
        }
    }

    /// Expone la referencia compartida al despachador de comandos de negocio.
    pub fn despachador(&self) -> &Arc<Mutex<DespachadorComandos>> {
        &self.despachador
    }

    /// Indica si existe un concentrador LAN activo asociado al anfitrion.
    pub fn concentrador_activo(&self) -> bool {
        self.concentrador
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    /// Detiene el concentrador LAN de forma ordenada si se encuentra en ejecucion.
    pub fn detener_concentrador(&self) {
        if let Ok(mut guard) = self.concentrador.lock() {
            if let Some(mut manejador) = guard.take() {
                manejador.detener();
            }
        }
    }

    /// Marca una solicitud explicita de salida desde la bandeja del sistema.
    pub fn marcar_salida(&self) {
        self.salir_solicitado.store(true, Ordering::SeqCst);
        self.detener_concentrador();
    }

    /// Indica si el usuario solicito cerrar completamente el proceso Rust.
    pub fn salida_solicitada(&self) -> bool {
        self.salir_solicitado.load(Ordering::SeqCst)
    }
}

/// Comandos Tauri expuestos hacia la interfaz WebView2.
pub mod comandos {
    use actualizador::{verificar_instalador_firmado, ManifiestoVersion};
    use almacen::{ArticuloPadron, AsientoMayor};
    use ciclicos::{BajaLaboratorioAprobada, RenglonCiclico, ResumenLaboratorio};
    use comun::{ErrorNucleo, SucursalId};
    use despacho::{
        EntradaCierreCiclico, EstadoSaludSistema, PaqueteSalidasColector, ResultadoEscaneo,
    };
    use informes::{EtiquetaQrUbicacion, TarjetaQrA4};
    use reglas::SujetoOperador;
    use tauri::State;
    use trama::{
        abrir_sobre_mensaje, asegurar_identidad_operador, cargar_extremo_privado_local,
        derivar_material_mensaje, sellar_sobre_mensaje, CredencialVerificacion,
        PaqueteExtremoPublico,
    };
    use vencimientos::{LoteVencimiento, ResultadoPase};

    use crate::{ruta_extremo_operador_local, EstadoAnfitrion};

    #[tauri::command]
    pub fn estado_salud(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
    ) -> Result<EstadoSaludSistema, String> {
        let guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard.estado_salud(&sujeto).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn buscar_articulos_paginados(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        filtro: String,
        limite: usize,
    ) -> Result<Vec<ArticuloPadron>, String> {
        let guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .buscar_articulos_paginados(&sujeto, &filtro, limite)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn procesar_entrada_escaner(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        sesion_id: String,
        entrada_cruda: String,
        ubicacion: String,
        terminal_id: String,
        creado_en: String,
    ) -> Result<ResultadoEscaneo, String> {
        let mut guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .procesar_entrada_escaner(
                &sujeto,
                &sesion_id,
                &entrada_cruda,
                &ubicacion,
                &terminal_id,
                &creado_en,
            )
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn evaluar_laboratorio_ciclico(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        laboratorio: String,
        renglones: Vec<RenglonCiclico>,
        bajas_aprobadas: Vec<BajaLaboratorioAprobada>,
    ) -> Result<Option<ResumenLaboratorio>, String> {
        let guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .evaluar_laboratorio_ciclico(&sujeto, &laboratorio, &renglones, &bajas_aprobadas)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn cerrar_ciclico_laboratorio(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        entrada: EntradaCierreCiclico,
        carga_salida: String,
        creado_en: String,
    ) -> Result<AsientoMayor, String> {
        let mut guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .cerrar_ciclico_laboratorio(&sujeto, entrada, &carga_salida, &creado_en)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn transferir_lote_vencimiento(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        lote_origen: LoteVencimiento,
        sucursal_destino: SucursalId,
        sesion_destino_id: String,
        numero_envio_local: String,
        lotes_destino: Vec<LoteVencimiento>,
    ) -> Result<ResultadoPase, String> {
        let mut guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .transferir_lote_vencimiento(
                &sujeto,
                &lote_origen,
                sucursal_destino,
                &sesion_destino_id,
                &numero_envio_local,
                &lotes_destino,
            )
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn generar_salidas_colector(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        sesion_id: String,
        articulos_sucursal: Vec<ArticuloPadron>,
    ) -> Result<PaqueteSalidasColector, String> {
        let guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .generar_salidas_colector(&sujeto, &sesion_id, &articulos_sucursal)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn listar_libro_mayor(
        estado: State<'_, EstadoAnfitrion>,
        sujeto: SujetoOperador,
        limite: usize,
    ) -> Result<Vec<AsientoMayor>, String> {
        let guard = estado
            .despachador()
            .lock()
            .map_err(|_| ErrorNucleo::AlmacenLocal.to_string())?;
        guard
            .listar_libro_mayor(&sujeto, limite)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn distribuir_laminas_qr_a4(etiquetas: Vec<EtiquetaQrUbicacion>) -> Vec<TarjetaQrA4> {
        informes::distribuir_laminas_qr_a4(&etiquetas)
    }

    #[tauri::command]
    pub fn verificar_instalador_actualizacion(
        bytes_instalador: Vec<u8>,
        manifiesto: ManifiestoVersion,
        credencial_publica_bytes: Vec<u8>,
    ) -> Result<(), String> {
        let credencial = CredencialVerificacion::desde_bytes(&credencial_publica_bytes)
            .map_err(|e| e.to_string())?;
        verificar_instalador_firmado(&bytes_instalador, &manifiesto, &credencial)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn asegurar_extremo_mensajeria(
        operador_id: String,
        semilla_roaming: String,
        respaldo_remoto: Option<Vec<u8>>,
    ) -> Result<PaqueteExtremoPublico, String> {
        let ruta = ruta_extremo_operador_local(&operador_id);
        asegurar_identidad_operador(
            &ruta,
            &operador_id,
            &semilla_roaming,
            respaldo_remoto.as_deref(),
        )
        .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn sellar_mensaje_directo(
        operador_id: String,
        semilla_roaming: String,
        extremo_par_publico: Vec<u8>,
        conversacion_id: String,
        remitente_id: String,
        mensaje_id: String,
        carga_json: String,
    ) -> Result<Vec<u8>, String> {
        let ruta = ruta_extremo_operador_local(&operador_id);
        let privado_local = cargar_extremo_privado_local(&ruta, &operador_id, &semilla_roaming)
            .map_err(|e| e.to_string())?;
        let privado_x25519: [u8; 32] = privado_local
            .como_bytes()
            .try_into()
            .map_err(|_| ErrorNucleo::IntegridadInvalida.to_string())?;
        let publico_par_x25519: [u8; 32] = extremo_par_publico
            .as_slice()
            .try_into()
            .map_err(|_| ErrorNucleo::IntegridadInvalida.to_string())?;

        let material = derivar_material_mensaje(
            &privado_x25519,
            &publico_par_x25519,
            &conversacion_id,
            &mensaje_id,
        );
        sellar_sobre_mensaje(
            &material,
            &conversacion_id,
            &remitente_id,
            &mensaje_id,
            carga_json.as_bytes(),
        )
        .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn abrir_mensaje_directo(
        operador_id: String,
        semilla_roaming: String,
        extremo_par_publico: Vec<u8>,
        conversacion_id: String,
        remitente_id: String,
        mensaje_id: String,
        sobre_sellado: Vec<u8>,
    ) -> Result<String, String> {
        let ruta = ruta_extremo_operador_local(&operador_id);
        let privado_local = cargar_extremo_privado_local(&ruta, &operador_id, &semilla_roaming)
            .map_err(|e| e.to_string())?;
        let privado_x25519: [u8; 32] = privado_local
            .como_bytes()
            .try_into()
            .map_err(|_| ErrorNucleo::IntegridadInvalida.to_string())?;
        let publico_par_x25519: [u8; 32] = extremo_par_publico
            .as_slice()
            .try_into()
            .map_err(|_| ErrorNucleo::IntegridadInvalida.to_string())?;

        let material = derivar_material_mensaje(
            &privado_x25519,
            &publico_par_x25519,
            &conversacion_id,
            &mensaje_id,
        );
        let bytes_planos = abrir_sobre_mensaje(
            &material,
            &conversacion_id,
            &remitente_id,
            &mensaje_id,
            &sobre_sellado,
        )
        .map_err(|e| e.to_string())?;

        String::from_utf8(bytes_planos).map_err(|_| ErrorNucleo::IntegridadInvalida.to_string())
    }

    #[tauri::command]
    pub async fn cargar_interfarmacias_plex(
        host: String,
        port: u16,
        user: String,
        password: String,
        database: String,
        desde: String,
    ) -> Result<enlace::ResultadoInterfarmaciasMysql, String> {
        let credencial = if !password.trim().is_empty() {
            Some(password)
        } else {
            std::env::var("PLEX_ACE_PASS")
                .or_else(|_| std::env::var("PLEX_MYSQL_PASS"))
                .or_else(|_| std::env::var("PLEX_PASS"))
                .ok()
                .filter(|v| !v.trim().is_empty())
        };
        let config = enlace::ConfiguracionMysql {
            anfitrion: host,
            puerto: port,
            usuario: user,
            credencial,
            base_datos: database,
            tiempo_espera_ms: 8_000,
        };
        tauri::async_runtime::spawn_blocking(move || {
            enlace::cargar_interfarmacias_desde_mysql(&config, &desde).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

/// Determina la politica de cierre de ventana para la ventana del anfitrion.
pub fn decidir_accion_cierre_ventana(etiqueta_ventana: &str) -> AccionCierreVentana {
    if etiqueta_ventana != ETIQUETA_VENTANA_PRINCIPAL {
        return AccionCierreVentana::Ignorar;
    }

    AccionCierreVentana::OcultarEnBandeja
}

/// Valida que la configuracion de Tauri defina una CSP estricta no nula y sin banderas inseguras.
pub fn validar_configuracion_seguridad(contenido_json: &str) -> Result<(), ErrorNucleo> {
    let raiz: Value =
        serde_json::from_str(contenido_json).map_err(|_| ErrorNucleo::IntegridadInvalida)?;

    let csp = raiz
        .get("app")
        .and_then(|app| app.get("security"))
        .and_then(|seg| seg.get("csp"))
        .and_then(Value::as_str)
        .ok_or(ErrorNucleo::IntegridadInvalida)?;

    if csp != CSP_OBLIGATORIA {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    if contenido_json.contains("--ignore-certificate-errors") {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    Ok(())
}

/// Aplica la politica de ciclo de vida WebView2 al cerrar o minimizar la ventana principal.
pub fn manejar_cierre_ventana<R: Runtime>(ventana: &Window<R>, evento: &WindowEvent) {
    let accion = decidir_accion_cierre_ventana(ventana.label());
    if accion == AccionCierreVentana::Ignorar {
        return;
    }

    match evento {
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = ventana.hide();
        }
        WindowEvent::Resized(_) if ventana.is_minimized().unwrap_or(false) => {
            let _ = ventana.hide();
        }
        _ => {}
    }
}

/// Muestra la ventana principal existente o la recrea cuando fue destruida en modo liviano.
pub fn abrir_o_recrear_ventana_principal<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(ventana) = app.get_webview_window(ETIQUETA_VENTANA_PRINCIPAL) {
        let _ = ventana.unminimize();
        let _ = ventana.show();
        let _ = ventana.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        ETIQUETA_VENTANA_PRINCIPAL,
        WebviewUrl::App("index.html".into()),
    )
    .title("MiPlus")
    .inner_size(1360.0, 860.0)
    .min_inner_size(900.0, 600.0)
    .resizable(true)
    .build()?;

    Ok(())
}

fn configurar_bandeja<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let item_abrir = MenuItem::with_id(app, "abrir", "Abrir MiPlus", true, None::<&str>)?;
    let item_salir = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&item_abrir, &item_salir])?;

    TrayIconBuilder::with_id("bandeja-principal")
        .menu(&menu)
        .tooltip("MiPlus")
        .on_menu_event(|app, evento| match evento.id.as_ref() {
            "abrir" => {
                let _ = abrir_o_recrear_ventana_principal(app);
            }
            "salir" => {
                if let Some(estado) = app.try_state::<EstadoAnfitrion>() {
                    estado.marcar_salida();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|bandeja, evento| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = evento
            {
                let _ = abrir_o_recrear_ventana_principal(bandeja.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Ejecuta la aplicacion Tauri v2 usando un estado ya inicializado.
pub fn ejecutar_con_estado(estado: EstadoAnfitrion) {
    let aplicacion = tauri::Builder::default()
        .manage(estado)
        .invoke_handler(tauri::generate_handler![
            comandos::estado_salud,
            comandos::buscar_articulos_paginados,
            comandos::procesar_entrada_escaner,
            comandos::evaluar_laboratorio_ciclico,
            comandos::cerrar_ciclico_laboratorio,
            comandos::transferir_lote_vencimiento,
            comandos::generar_salidas_colector,
            comandos::listar_libro_mayor,
            comandos::distribuir_laminas_qr_a4,
            comandos::verificar_instalador_actualizacion,
            comandos::asegurar_extremo_mensajeria,
            comandos::sellar_mensaje_directo,
            comandos::abrir_mensaje_directo,
            comandos::cargar_interfarmacias_plex
        ])
        .setup(|app| {
            configurar_bandeja(app)?;
            abrir_o_recrear_ventana_principal(app.handle())?;
            Ok(())
        })
        .on_window_event(|ventana, evento| {
            manejar_cierre_ventana(ventana, evento);
        })
        .build(tauri::generate_context!())
        .expect("No fue posible inicializar el anfitrion de escritorio MiPlus");

    aplicacion.run(|app, evento| {
        if let RunEvent::ExitRequested { api, .. } = evento {
            let permitir_salida = app
                .try_state::<EstadoAnfitrion>()
                .map(|estado| estado.salida_solicitada())
                .unwrap_or(true);
            if !permitir_salida {
                api.prevent_exit();
            }
        }
    });
}

/// Punto de entrada principal del escritorio MiPlus con almacenamiento local por defecto.
pub fn ejecutar() {
    let almacen = AlmacenLocal::abrir(&ruta_base_datos_local())
        .or_else(|_| AlmacenLocal::abrir_en_memoria())
        .expect("No fue posible abrir el almacen local de MiPlus");
    let despachador = Arc::new(Mutex::new(DespachadorComandos::crear(
        almacen,
        MotorReglas::crear(),
        SucursalId(1),
    )));
    let estado = EstadoAnfitrion::crear(despachador, None);
    ejecutar_con_estado(estado);
}

fn ruta_base_datos_local() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("MiPlus").join("nucleo.db")
}

pub(crate) fn ruta_extremo_operador_local(operador_id: &str) -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("MiPlus")
        .join(trama::nombre_archivo_extremo_operador(operador_id))
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use despacho::ConcentradorLanColector;
    use informes::EtiquetaQrUbicacion;

    fn crear_despachador_en_memoria() -> Arc<Mutex<DespachadorComandos>> {
        let almacen = AlmacenLocal::abrir_en_memoria().expect("almacen en memoria");
        Arc::new(Mutex::new(DespachadorComandos::crear(
            almacen,
            MotorReglas::crear(),
            SucursalId(14),
        )))
    }

    #[test]
    fn politica_cierre_ventana_oculta_principal_en_bandeja() {
        assert_eq!(
            decidir_accion_cierre_ventana(ETIQUETA_VENTANA_PRINCIPAL),
            AccionCierreVentana::OcultarEnBandeja
        );
        assert_eq!(
            decidir_accion_cierre_ventana("secundaria"),
            AccionCierreVentana::Ignorar
        );
    }

    #[test]
    fn configuracion_tauri_tiene_csp_estricta_y_rutas_esperadas() {
        let contenido = include_str!("../tauri.conf.json");
        validar_configuracion_seguridad(contenido).expect("tauri.conf.json endurecido");

        let json: Value = serde_json::from_str(contenido).expect("json valido");
        assert_eq!(json["build"]["frontendDist"], "../../interfaz/dist");
        assert_eq!(json["build"]["devUrl"], "http://127.0.0.1:1420");
        assert_eq!(json["app"]["windows"][0]["label"], "principal");
        assert_eq!(json["bundle"]["active"], false);
    }

    #[test]
    fn configuracion_rechaza_csp_nula_o_bandera_insegura() {
        let con_csp_nula = r#"{"app":{"security":{"csp":null}}}"#;
        assert!(validar_configuracion_seguridad(con_csp_nula).is_err());

        let con_ignore_cert = format!(
            r#"{{"app":{{"windows":[{{"additionalBrowserArgs":"--ignore-certificate-errors"}}],"security":{{"csp":"{CSP_OBLIGATORIA}"}}}}}}"#
        );
        assert!(validar_configuracion_seguridad(&con_ignore_cert).is_err());
    }

    #[test]
    fn construccion_estado_anfitrion_y_ciclo_concentrador() {
        let despachador = crear_despachador_en_memoria();
        let concentrador =
            ConcentradorLanColector::vincular("127.0.0.1:0", "123456", Arc::clone(&despachador))
                .expect("enlace lan")
                .iniciar()
                .expect("inicio concentrador");

        let estado = EstadoAnfitrion::crear(despachador, Some(concentrador));
        assert!(estado.concentrador_activo());
        assert!(!estado.salida_solicitada());

        estado.marcar_salida();
        assert!(estado.salida_solicitada());
        assert!(!estado.concentrador_activo());
    }

    #[test]
    fn comando_distribuir_laminas_qr_a4_maqueta_hoja() {
        let etiquetas = vec![EtiquetaQrUbicacion {
            codigo_ubicacion: "POS:A-01".to_string(),
            titulo: "Gondola A".to_string(),
            subtitulo: Some("Nivel 1".to_string()),
        }];
        let tarjetas = comandos::distribuir_laminas_qr_a4(etiquetas);
        assert_eq!(tarjetas.len(), 1);
        assert_eq!(tarjetas[0].pagina, 0);
        assert_eq!(tarjetas[0].etiqueta.codigo_ubicacion, "POS:A-01");
    }

    #[test]
    fn comandos_mensajeria_directa_sellan_y_abren_entre_operadores() {
        let operador_a = "op-prueba-anfitrion-a".to_string();
        let operador_b = "op-prueba-anfitrion-b".to_string();
        let ruta_a = ruta_extremo_operador_local(&operador_a);
        let ruta_b = ruta_extremo_operador_local(&operador_b);
        let _ = std::fs::remove_file(&ruta_a);
        let _ = std::fs::remove_file(&ruta_b);

        let paquete_a =
            comandos::asegurar_extremo_mensajeria(operador_a.clone(), "usuario.a".to_string(), None)
                .expect("extremo A");
        let paquete_b =
            comandos::asegurar_extremo_mensajeria(operador_b.clone(), "usuario.b".to_string(), None)
                .expect("extremo B");

        let carga = r#"{"text":"Stock verificado en sucursal 14"}"#.to_string();
        let sobre = comandos::sellar_mensaje_directo(
            operador_a.clone(),
            "usuario.a".to_string(),
            paquete_b.extremo_publico.clone(),
            "conv-14".to_string(),
            operador_a.clone(),
            "msg-01".to_string(),
            carga.clone(),
        )
        .expect("sellado directo");

        let abierto = comandos::abrir_mensaje_directo(
            operador_b.clone(),
            "usuario.b".to_string(),
            paquete_a.extremo_publico,
            "conv-14".to_string(),
            operador_a,
            "msg-01".to_string(),
            sobre,
        )
        .expect("apertura directa");
        assert_eq!(abierto, carga);

        let _ = std::fs::remove_file(&ruta_a);
        let _ = std::fs::remove_file(&ruta_b);
    }
}

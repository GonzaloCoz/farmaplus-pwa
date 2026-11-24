//! Servidor TCP/HTTP local para recepcion de lecturas desde colectores moviles en LAN.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use comun::{ErrorNucleo, SucursalId};
use reglas::{RolOperador, SujetoOperador};
use serde::{Deserialize, Serialize};

use crate::DespachadorComandos;

const TAMANO_MAXIMO_CUERPO_LAN: usize = 65_536;
const ENCABEZADO_EMPAREJAMIENTO: &str = "x-miplus-codigo";

/// Carga JSON enviada por un colector movil al endpoint `POST /lectura`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SolicitudLecturaLan {
    pub operador_id: String,
    pub sesion_id: String,
    pub entrada_cruda: String,
    pub ubicacion: String,
    pub terminal_id: String,
    pub creado_en: String,
}

/// Respuesta de estado del concentrador local de la farmacia.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RespuestaEstadoLan {
    pub activo: bool,
    pub sucursal_id: SucursalId,
    pub nombre_sucursal: String,
    pub pendientes_salida: usize,
    pub cadena_mayor_integra: bool,
}

/// Servidor ligero para colectores Zebra en red local con emparejamiento por PIN de 6 digitos.
pub struct ConcentradorLanColector {
    listener: TcpListener,
    codigo_pin: [u8; 6],
    despachador: Arc<Mutex<DespachadorComandos>>,
}

/// Manejador vivo del hilo concentrador que permite consultar su direccion y detenerlo limpiamente.
pub struct ManejadorConcentrador {
    direccion: SocketAddr,
    detener_bandera: Arc<AtomicBool>,
    hilo: Option<JoinHandle<()>>,
}

impl ManejadorConcentrador {
    /// Devuelve la direccion y puerto local asignado donde escucha el concentrador.
    pub fn direccion(&self) -> SocketAddr {
        self.direccion
    }

    /// Solicita la detencion ordenada del concentrador y aguarda el cierre del hilo servidor.
    pub fn detener(&mut self) {
        self.detener_bandera.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(self.direccion);
        if let Some(hilo) = self.hilo.take() {
            let _ = hilo.join();
        }
    }
}

impl Drop for ManejadorConcentrador {
    fn drop(&mut self) {
        self.detener();
    }
}

impl ConcentradorLanColector {
    /// Crea y enlaza el concentrador LAN validando un codigo de emparejamiento de 6 digitos ASCII.
    pub fn vincular(
        direccion: &str,
        codigo_pin: &str,
        despachador: Arc<Mutex<DespachadorComandos>>,
    ) -> Result<Self, ErrorNucleo> {
        let pin_bytes = codigo_pin.trim().as_bytes();
        if pin_bytes.len() != 6 || !pin_bytes.iter().all(|b| b.is_ascii_digit()) {
            return Err(ErrorNucleo::IntegridadInvalida);
        }
        let mut pin = [0_u8; 6];
        pin.copy_from_slice(pin_bytes);

        let listener = TcpListener::bind(direccion).map_err(|_| ErrorNucleo::SinConexion)?;
        Ok(Self {
            listener,
            codigo_pin: pin,
            despachador,
        })
    }

    /// Devuelve la direccion IP y puerto enlazados por el concentrador.
    pub fn direccion_local(&self) -> Result<SocketAddr, ErrorNucleo> {
        self.listener
            .local_addr()
            .map_err(|_| ErrorNucleo::SinConexion)
    }

    /// Inicia la escucha en un hilo de fondo y retorna el manejador de ciclo de vida.
    pub fn iniciar(self) -> Result<ManejadorConcentrador, ErrorNucleo> {
        let direccion = self.direccion_local()?;
        let detener_bandera = Arc::new(AtomicBool::new(false));
        let bandera_hilo = Arc::clone(&detener_bandera);
        let listener = self.listener;
        let pin = self.codigo_pin;
        let despachador = self.despachador;

        let hilo = thread::spawn(move || {
            for flujo_res in listener.incoming() {
                if bandera_hilo.load(Ordering::SeqCst) {
                    break;
                }
                if let Ok(mut flujo) = flujo_res {
                    if bandera_hilo.load(Ordering::SeqCst) {
                        break;
                    }
                    atender_conexion_lan(&mut flujo, &pin, &despachador);
                }
            }
        });

        Ok(ManejadorConcentrador {
            direccion,
            detener_bandera,
            hilo: Some(hilo),
        })
    }
}

fn atender_conexion_lan(
    flujo: &mut TcpStream,
    codigo_pin: &[u8; 6],
    despachador: &Arc<Mutex<DespachadorComandos>>,
) {
    let _ = flujo.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = flujo.set_write_timeout(Some(Duration::from_secs(2)));

    let Ok(solicitud) = leer_solicitud_http(flujo) else {
        escribir_respuesta_http(flujo, "400 Bad Request", r#"{"error":"solicitud_invalida"}"#);
        return;
    };

    if !es_pin_valido(&solicitud.pin_recibido, codigo_pin) {
        escribir_respuesta_http(flujo, "401 Unauthorized", r#"{"error":"emparejamiento_invalido"}"#);
        return;
    }

    match (solicitud.metodo.as_str(), solicitud.ruta.as_str()) {
        ("GET", "/estado") => manejar_estado_lan(flujo, despachador),
        ("POST", "/lectura") => manejar_lectura_lan(flujo, &solicitud.cuerpo, despachador),
        _ => escribir_respuesta_http(flujo, "404 Not Found", r#"{"error":"ruta_inexistente"}"#),
    }
}

fn manejar_estado_lan(flujo: &mut TcpStream, despachador: &Arc<Mutex<DespachadorComandos>>) {
    let Ok(guard) = despachador.lock() else {
        escribir_respuesta_http(flujo, "500 Internal Server Error", r#"{"error":"bloqueo"}"#);
        return;
    };

    let sujeto_colector = SujetoOperador {
        operador_id: String::from("colector-lan"),
        rol: RolOperador::Colector,
        sucursal_origen: guard.sucursal_id(),
        sucursales_asignadas: Vec::new(),
        sesion_local_activa: false,
    };

    match guard.estado_concentrador_lan(&sujeto_colector) {
        Ok(respuesta) => {
            let json = serde_json::to_string(&respuesta).unwrap_or_else(|_| String::from("{}"));
            escribir_respuesta_http(flujo, "200 OK", &json);
        }
        Err(_) => escribir_respuesta_http(flujo, "403 Forbidden", r#"{"error":"no_autorizado"}"#),
    }
}

fn manejar_lectura_lan(
    flujo: &mut TcpStream,
    cuerpo: &[u8],
    despachador: &Arc<Mutex<DespachadorComandos>>,
) {
    let Ok(entrada) = serde_json::from_slice::<SolicitudLecturaLan>(cuerpo) else {
        escribir_respuesta_http(flujo, "400 Bad Request", r#"{"error":"json_invalido"}"#);
        return;
    };

    let Ok(mut guard) = despachador.lock() else {
        escribir_respuesta_http(flujo, "500 Internal Server Error", r#"{"error":"bloqueo"}"#);
        return;
    };

    let sujeto_colector = SujetoOperador {
        operador_id: entrada.operador_id,
        rol: RolOperador::Colector,
        sucursal_origen: guard.sucursal_id(),
        sucursales_asignadas: Vec::new(),
        sesion_local_activa: false,
    };

    match guard.procesar_entrada_escaner(
        &sujeto_colector,
        &entrada.sesion_id,
        &entrada.entrada_cruda,
        &entrada.ubicacion,
        &entrada.terminal_id,
        &entrada.creado_en,
    ) {
        Ok(resultado) => {
            let json = serde_json::to_string(&resultado).unwrap_or_else(|_| String::from("{}"));
            escribir_respuesta_http(flujo, "200 OK", &json);
        }
        Err(ErrorNucleo::NoAutorizado) => {
            escribir_respuesta_http(flujo, "403 Forbidden", r#"{"error":"no_autorizado"}"#)
        }
        Err(_) => escribir_respuesta_http(flujo, "422 Unprocessable Entity", r#"{"error":"lectura_invalida"}"#),
    }
}

struct SolicitudHttpSimple {
    metodo: String,
    ruta: String,
    pin_recibido: String,
    cuerpo: Vec<u8>,
}

fn leer_solicitud_http(flujo: &mut TcpStream) -> Result<SolicitudHttpSimple, ErrorNucleo> {
    let mut lector = BufReader::new(flujo);
    let mut primera_linea = String::new();
    let leidos = lector
        .read_line(&mut primera_linea)
        .map_err(|_| ErrorNucleo::SinConexion)?;
    if leidos == 0 {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut partes = primera_linea.split_whitespace();
    let metodo = partes.next().ok_or(ErrorNucleo::IntegridadInvalida)?.to_string();
    let ruta = partes.next().ok_or(ErrorNucleo::IntegridadInvalida)?.to_string();

    let mut pin_recibido = String::new();
    let mut longitud_cuerpo: usize = 0;

    loop {
        let mut linea = String::new();
        let bytes_linea = lector
            .read_line(&mut linea)
            .map_err(|_| ErrorNucleo::SinConexion)?;
        if bytes_linea == 0 || linea == "\r\n" || linea == "\n" {
            break;
        }
        if let Some((nombre, valor)) = linea.split_once(':') {
            let nombre_min = nombre.trim().to_ascii_lowercase();
            if nombre_min == ENCABEZADO_EMPAREJAMIENTO {
                pin_recibido = valor.trim().to_string();
            } else if nombre_min == "content-length" {
                longitud_cuerpo = valor
                    .trim()
                    .parse::<usize>()
                    .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
            }
        }
    }

    if longitud_cuerpo > TAMANO_MAXIMO_CUERPO_LAN {
        return Err(ErrorNucleo::IntegridadInvalida);
    }

    let mut cuerpo = vec![0_u8; longitud_cuerpo];
    if longitud_cuerpo > 0 {
        lector
            .read_exact(&mut cuerpo)
            .map_err(|_| ErrorNucleo::SinConexion)?;
    }

    Ok(SolicitudHttpSimple {
        metodo,
        ruta,
        pin_recibido,
        cuerpo,
    })
}

fn escribir_respuesta_http(flujo: &mut TcpStream, estado: &str, json: &str) {
    let cabeceras = format!(
        "HTTP/1.1 {estado}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        json.len()
    );
    let _ = flujo.write_all(cabeceras.as_bytes());
    let _ = flujo.write_all(json.as_bytes());
    let _ = flujo.flush();
}

fn es_pin_valido(recibido: &str, esperado: &[u8; 6]) -> bool {
    let bytes = recibido.as_bytes();
    if bytes.len() != esperado.len() {
        return false;
    }
    let mut diferencia = 0_u8;
    for (&a, &b) in bytes.iter().zip(esperado.iter()) {
        diferencia |= a ^ b;
    }
    diferencia == 0
}

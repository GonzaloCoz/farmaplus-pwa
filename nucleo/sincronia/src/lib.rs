//! Coordinacion de bandeja transaccional, espera exponencial con desfasaje y deltas Merkle.

pub mod bandeja;
pub mod desfasaje;
pub mod presupuesto;
pub mod reconciliador;

pub use bandeja::{CoordinadorSincronia, LoteEmpaquetado, PaqueteBandeja, VERSION_PAQUETE_BANDEJA};
pub use desfasaje::{calcular_espera_desfasada, calcular_tope_desfasado};
pub use presupuesto::PresupuestoReintentos;
pub use reconciliador::ReconciliadorPadron;

#[cfg(test)]
mod pruebas {
    use super::*;
    use almacen::{AlmacenLocal, ArticuloPadron, CodigoBarra, DatosAsientoMayor};
    use comun::{ErrorNucleo, SucursalId};
    use trama::{desempaquetar_pak, ArbolIntegridad, CredencialFirma};

    fn articulo_muestra(
        id: &str,
        laboratorio: Option<&str>,
        precio: f64,
        existencia: f64,
    ) -> ArticuloPadron {
        ArticuloPadron {
            producto_id: String::from(id),
            sucursal_id: SucursalId(14),
            troquel: Some(format!("TRQ-{}", id)),
            descripcion: format!("PRODUCTO {}", id),
            laboratorio: laboratorio.map(String::from),
            rubro: Some(String::from("MEDICAMENTOS")),
            subrubro: Some(String::from("ETICOS")),
            existencia,
            costo: precio * 0.65,
            precio,
            oculto: false,
            trazable: false,
            gtin: Some(format!("07790001{:0>6}", id)),
            padre_id: None,
            unidades_padre: 1,
            actualizado_en: String::from("2026-11-16T12:00:00Z"),
            codigos_barra: vec![
                CodigoBarra {
                    codigo: format!("7790001{:0>6}", id),
                    es_principal: true,
                },
                CodigoBarra {
                    codigo: format!("ALT-{}", id),
                    es_principal: false,
                },
            ],
        }
    }

    fn registrar_asiento_muestra(
        almacen: &mut AlmacenLocal,
        indice: u64,
        laboratorio: &str,
        carga: &str,
    ) {
        almacen
            .registrar_cierre_transaccional(
                DatosAsientoMayor {
                    id: format!("asiento-{}", indice),
                    id_idempotencia: format!("01930000-0000-7000-8000-{:012}", indice),
                    sucursal_id: SucursalId(14),
                    laboratorio: String::from(laboratorio),
                    ronda: 1,
                    folio_remoto: Some(format!("FOL-{}", indice)),
                    operacion_baja_id: Some(format!("OPB-{}", indice)),
                    operacion_alta_id: None,
                    diferencia_neta: -250.0 * (indice as f64),
                    estado: String::from("registrado"),
                    destino_salida: String::from("cierre_ciclico"),
                },
                carga,
                "2026-11-16T12:05:00Z",
            )
            .expect("registro transaccional en almacen");
    }

    #[test]
    fn presupuesto_reintentos_se_agota_y_recarga_hasta_capacidad() {
        let mut presupuesto = PresupuestoReintentos::crear(10, 3, 4);
        assert_eq!(presupuesto.disponibles(), 10);
        assert_eq!(presupuesto.capacidad_maxima(), 10);
        assert_eq!(presupuesto.recarga_por_exito(), 3);
        assert_eq!(presupuesto.costo_reintento(), 4);

        assert!(presupuesto.consumir_intento());
        assert_eq!(presupuesto.disponibles(), 6);
        assert!(presupuesto.consumir_intento());
        assert_eq!(presupuesto.disponibles(), 2);

        // Con saldo insuficiente no consume parcialmente ni baja de 2.
        assert!(!presupuesto.consumir_intento());
        assert_eq!(presupuesto.disponibles(), 2);

        presupuesto.registrar_exito();
        assert_eq!(presupuesto.disponibles(), 5);
        assert!(presupuesto.consumir_intento());
        assert_eq!(presupuesto.disponibles(), 1);

        for _ in 0..10 {
            presupuesto.registrar_exito();
        }
        assert_eq!(presupuesto.disponibles(), 10);

        let mut sin_capacidad = PresupuestoReintentos::crear(0, 5, 1);
        assert!(!sin_capacidad.consumir_intento());
        sin_capacidad.registrar_exito();
        assert_eq!(sin_capacidad.disponibles(), 0);
    }

    #[test]
    fn espera_desfasada_respeta_cotas_determinismo_y_protege_overflow() {
        let base_ms = 250;
        let techo_ms = 10_000;

        for intento in 0..=20 {
            let tope = calcular_tope_desfasado(intento, base_ms, techo_ms);
            assert!(tope <= techo_ms);
            for semilla in 0..64_u64 {
                let espera = calcular_espera_desfasada(intento, base_ms, techo_ms, semilla);
                assert!((0..=tope).contains(&espera));
                assert_eq!(
                    espera,
                    calcular_espera_desfasada(intento, base_ms, techo_ms, semilla)
                );
            }
        }

        // Verifica dispersion real de Full Jitter sobre un intervalo amplio.
        let mut minimo = i64::MAX;
        let mut maximo = 0_i64;
        for semilla in 0..500_u64 {
            let valor = calcular_espera_desfasada(4, 250, 10_000, semilla);
            minimo = minimo.min(valor);
            maximo = maximo.max(valor);
        }
        assert!(minimo < 500 && maximo > 3_500);

        // Proteccion ante exponentes enormes y saturacion de i64.
        let saturado = calcular_espera_desfasada(u32::MAX, i64::MAX, i64::MAX, 42);
        assert!(saturado >= 0);
        assert_eq!(calcular_tope_desfasado(63, 1, i64::MAX), i64::MAX);
        assert_eq!(calcular_espera_desfasada(3, 0, 5_000, 1), 0);
        assert_eq!(calcular_espera_desfasada(3, -100, 5_000, 1), 0);
        assert_eq!(calcular_espera_desfasada(3, 100, -1, 1), 0);
    }

    #[test]
    fn reconciliacion_merkle_sin_diferencias_e_independiente_del_orden() {
        let padron_local = vec![
            articulo_muestra("1003", Some("ROEMMERS"), 3200.0, 4.0),
            articulo_muestra("1001", Some("BAGO"), 1500.0, 12.0),
            articulo_muestra("1002", Some("BAGO"), 2400.5, 0.0),
            articulo_muestra("1004", Some("BAYER"), 890.0, 7.0),
        ];

        let mut padron_remoto = vec![
            articulo_muestra("1004", Some("BAYER"), 890.0, 7.0),
            articulo_muestra("1002", Some("BAGO"), 2400.5, -0.0),
            articulo_muestra("1001", Some("BAGO"), 1500.0, 12.0),
            articulo_muestra("1003", Some("ROEMMERS"), 3200.0, 4.0),
        ];
        padron_remoto[2].codigos_barra.reverse();

        let arbol_local = ReconciliadorPadron::construir_arbol(&padron_local);
        let arbol_remoto = ReconciliadorPadron::construir_arbol(&padron_remoto);

        assert_eq!(arbol_local.raiz, arbol_remoto.raiz);
        assert!(
            ReconciliadorPadron::laboratorios_desactualizados(&arbol_local, &arbol_remoto)
                .is_empty()
        );
        assert_eq!(
            ReconciliadorPadron::construir_arbol(&[]),
            ArbolIntegridad::vacio()
        );
    }

    #[test]
    fn reconciliacion_merkle_detecta_unicamente_el_laboratorio_modificado() {
        let local = vec![
            articulo_muestra("1001", Some("BAGO"), 1500.0, 10.0),
            articulo_muestra("1002", Some("BAGO"), 2100.0, 5.0),
            articulo_muestra("2001", Some("ROEMMERS"), 3400.0, 8.0),
            articulo_muestra("3001", Some("BAYER"), 950.0, 15.0),
            articulo_muestra("4001", None, 420.0, 2.0),
        ];

        let mut remoto = local.clone();
        remoto[2].precio = 3650.0;

        let arbol_local = ReconciliadorPadron::construir_arbol(&local);
        let arbol_remoto = ReconciliadorPadron::construir_arbol(&remoto);

        assert_ne!(arbol_local.raiz, arbol_remoto.raiz);
        assert_eq!(
            ReconciliadorPadron::laboratorios_desactualizados(&arbol_local, &arbol_remoto),
            vec![String::from("ROEMMERS")]
        );

        // Si un laboratorio falta en remoto o se agrega sin laboratorio, informa ambos en orden.
        remoto.pop();
        let mut arbol_sin_ultimo = ReconciliadorPadron::construir_arbol(&remoto);
        arbol_sin_ultimo.fijar_rama("ELEA", b"delta-elea");
        assert_eq!(
            ReconciliadorPadron::laboratorios_desactualizados(&arbol_local, &arbol_sin_ultimo),
            vec![
                String::from("ELEA"),
                String::from("ROEMMERS"),
                String::from("SIN_LABORATORIO"),
            ]
        );
    }

    #[test]
    fn ciclo_completo_reclamo_pak_verificacion_fallo_y_confirmacion() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir almacen memoria");
        registrar_asiento_muestra(&mut almacen, 1, "BAGO", r#"{"folio":"FOL-1"}"#);
        registrar_asiento_muestra(&mut almacen, 2, "ROEMMERS", r#"{"folio":"FOL-2"}"#);

        let firma = CredencialFirma::generar();
        let verificador = firma.verificacion();
        let mut presupuesto = PresupuestoReintentos::crear(20, 4, 5);

        let ahora = 10_000;
        let (ids_lote_1, pak_1) =
            CoordinadorSincronia::preparar_envio(&mut almacen, 1, ahora, &firma)
                .expect("preparar primer envio")
                .expect("debe existir mensaje");
        assert_eq!(ids_lote_1, vec![String::from("sal-asiento-1")]);

        // Verifica el contenedor firmado con trama y deserializa el DTO de bandeja.
        let bytes_crudos = desempaquetar_pak(&pak_1, &verificador).expect("desempaquetar pak");
        let dto_directo: PaqueteBandeja =
            serde_json::from_slice(&bytes_crudos).expect("deserializar dto");
        let dto_leido =
            CoordinadorSincronia::leer_paquete(&pak_1, &verificador).expect("leer paquete");
        assert_eq!(dto_directo, dto_leido);
        assert_eq!(dto_leido.version, VERSION_PAQUETE_BANDEJA);
        assert_eq!(dto_leido.generado_en_ms, ahora);
        assert_eq!(dto_leido.mensajes.len(), 1);
        assert_eq!(dto_leido.mensajes[0].id, "sal-asiento-1");
        assert_eq!(dto_leido.mensajes[0].carga_json, r#"{"folio":"FOL-1"}"#);

        // Paquete alterado o verificador ajeno debe rechazarse antes de descomprimir.
        let mut pak_alterado = pak_1.clone();
        let ultimo = pak_alterado.len() - 1;
        pak_alterado[ultimo] ^= 0x5A;
        assert!(matches!(
            CoordinadorSincronia::leer_paquete(&pak_alterado, &verificador),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
        let otra_firma = CredencialFirma::generar();
        assert!(matches!(
            CoordinadorSincronia::leer_paquete(&pak_1, &otra_firma.verificacion()),
            Err(ErrorNucleo::IntegridadInvalida)
        ));

        // Simula fallo de red: descuenta presupuesto y reencola con desfasaje.
        CoordinadorSincronia::procesar_resultado(
            &mut almacen,
            &mut presupuesto,
            &ids_lote_1,
            false,
            ahora,
            200,
            2_000,
        )
        .expect("procesar fallo");
        assert_eq!(presupuesto.disponibles(), 15);

        // Pasado el techo maximo, ambos mensajes quedan habilitados para reclamo y confirmacion.
        let futuro = ahora + 2_000;
        let (ids_lote_2, pak_2) =
            CoordinadorSincronia::preparar_envio(&mut almacen, 10, futuro, &firma)
                .expect("preparar segundo envio")
                .expect("debe reclamar ambos mensajes");
        assert_eq!(
            ids_lote_2,
            vec![String::from("sal-asiento-2"), String::from("sal-asiento-1"),]
        );
        let dto_2 =
            CoordinadorSincronia::leer_paquete(&pak_2, &verificador).expect("leer segundo pak");
        assert_eq!(dto_2.mensajes.len(), 2);
        let msg_reintentado = dto_2
            .mensajes
            .iter()
            .find(|m| m.id == "sal-asiento-1")
            .expect("mensaje reintentado");
        assert_eq!(msg_reintentado.intentos, 1);

        CoordinadorSincronia::procesar_resultado(
            &mut almacen,
            &mut presupuesto,
            &ids_lote_2,
            true,
            futuro,
            200,
            2_000,
        )
        .expect("confirmar envio");
        assert_eq!(presupuesto.disponibles(), 19);

        let vacio = CoordinadorSincronia::preparar_envio(&mut almacen, 10, futuro + 10_000, &firma)
            .expect("consultar bandeja vacia");
        assert!(vacio.is_none());
    }

    #[test]
    fn procesar_resultado_con_presupuesto_agotado_devuelve_pendientes_sin_trabar() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir almacen");
        registrar_asiento_muestra(&mut almacen, 7, "BAYER", r#"{"folio":"FOL-7"}"#);

        let firma = CredencialFirma::generar();
        let mut presupuesto = PresupuestoReintentos::crear(4, 1, 5);
        assert_eq!(presupuesto.disponibles(), 4);

        let (ids, _) = CoordinadorSincronia::preparar_envio(&mut almacen, 5, 1_000, &firma)
            .expect("preparar envio")
            .expect("debe existir mensaje");

        CoordinadorSincronia::procesar_resultado(
            &mut almacen,
            &mut presupuesto,
            &ids,
            false,
            1_000,
            100,
            3_000,
        )
        .expect("procesar fallo sin saldo");
        assert_eq!(presupuesto.disponibles(), 4);

        let (reclamados, _) = CoordinadorSincronia::preparar_envio(&mut almacen, 5, 4_000, &firma)
            .expect("reclamar tras espera maxima")
            .expect("mensaje debe seguir pendiente y recuperable");
        assert_eq!(reclamados, ids);
    }

    #[test]
    fn casos_borde_coordinador_version_y_presupuesto_estandar() {
        let mut almacen =
            AlmacenLocal::abrir_en_memoria().expect("abrir almacen");
        registrar_asiento_muestra(&mut almacen, 9, "ELEA", r#"{"folio":"FOL-9"}"#);

        let firma = CredencialFirma::generar();
        let mut presupuesto = PresupuestoReintentos::default();
        let saldo_inicial = presupuesto.disponibles();
        assert_eq!(saldo_inicial, 100);

        let lote_cero: Result<Option<LoteEmpaquetado>, ErrorNucleo> =
            CoordinadorSincronia::preparar_envio(&mut almacen, 0, 1_000, &firma);
        assert!(lote_cero.expect("limite cero").is_none());

        CoordinadorSincronia::procesar_resultado(
            &mut almacen,
            &mut presupuesto,
            &[],
            true,
            1_000,
            100,
            2_000,
        )
        .expect("lista vacia no modifica saldo");
        assert_eq!(presupuesto.disponibles(), saldo_inicial);

        let paquete_invalido = PaqueteBandeja {
            version: 99,
            generado_en_ms: 1_000,
            mensajes: Vec::new(),
        };
        let pak_version_invalida = trama::empaquetar_pak(
            &serde_json::to_vec(&paquete_invalido).expect("serializar"),
            &firma,
        )
        .expect("empaquetar");
        assert!(matches!(
            CoordinadorSincronia::leer_paquete(&pak_version_invalida, &firma.verificacion()),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }
}

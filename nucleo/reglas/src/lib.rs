use comun::{ErrorNucleo, SucursalId};
use serde::{Deserialize, Serialize};

/// Roles operativos habilitados en el plano local y central.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RolOperador {
    Administrador,
    Zonal,
    Sucursal,
    Colector,
}

/// Acciones protegidas evaluadas antes de ejecutar comandos de negocio.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Accion {
    VerPanel,
    ContarCiclico,
    ImpactarAjusteLocal,
    AprobarBajaLaboratorio,
    RegistrarLecturaColector,
    CerrarUbicacionQr,
    TransferirVencimiento,
    AdministrarSistema,
}

/// Contexto autenticado del operador que solicita ejecutar una accion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SujetoOperador {
    pub operador_id: String,
    pub rol: RolOperador,
    pub sucursal_origen: SucursalId,
    pub sucursales_asignadas: Vec<SucursalId>,
    pub sesion_local_activa: bool,
}

/// Recurso de destino y metadatos operativos sobre los que recae la accion.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RecursoObjetivo {
    pub sucursal_destino: SucursalId,
    pub monto_ajuste_abs: Option<f64>,
    pub ubicacion_abierta_por: Option<String>,
}

/// Efecto declarativo de una regla adicional de autorizacion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EfectoRegla {
    Permitir,
    Denegar,
}

/// Predicados atomicos serializables para componer o evaluar condiciones de regla.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CondicionRegla {
    SucursalIgual(SucursalId),
    MontoMayorQue(f64),
    RolIgual(RolOperador),
    AccionIgual(Accion),
    RequiereSesionLocal,
}

impl CondicionRegla {
    /// Evalua deterministicamente la condicion contra el sujeto, accion y recurso.
    pub fn coincide(
        &self,
        sujeto: &SujetoOperador,
        accion: Accion,
        recurso: &RecursoObjetivo,
    ) -> bool {
        match self {
            Self::SucursalIgual(sucursal) => recurso.sucursal_destino == *sucursal,
            Self::MontoMayorQue(limite) => {
                if !limite.is_finite() || *limite < 0.0 {
                    return false;
                }
                matches!(
                    recurso.monto_ajuste_abs,
                    Some(monto) if monto.is_finite() && monto > *limite
                )
            }
            Self::RolIgual(rol) => sujeto.rol == *rol,
            Self::AccionIgual(objetivo) => accion == *objetivo,
            Self::RequiereSesionLocal => sujeto.sesion_local_activa,
        }
    }
}

/// Regla adicional serializable en JSON con filtros combinables por coincidencia exacta.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReglaAdicional {
    pub id: String,
    pub efecto: EfectoRegla,
    #[serde(default)]
    pub accion: Option<Accion>,
    #[serde(default)]
    pub rol: Option<RolOperador>,
    #[serde(default)]
    pub sucursal: Option<SucursalId>,
    #[serde(default)]
    pub monto_maximo: Option<f64>,
    #[serde(default)]
    pub descripcion: String,
}

impl ReglaAdicional {
    /// Determina si la regla aplica al contexto `(sujeto, accion, recurso)` actual.
    pub fn coincide(
        &self,
        sujeto: &SujetoOperador,
        accion: Accion,
        recurso: &RecursoObjetivo,
    ) -> bool {
        if let Some(accion_regla) = self.accion {
            if !CondicionRegla::AccionIgual(accion_regla).coincide(sujeto, accion, recurso) {
                return false;
            }
        }
        if let Some(rol_regla) = self.rol {
            if !CondicionRegla::RolIgual(rol_regla).coincide(sujeto, accion, recurso) {
                return false;
            }
        }
        if let Some(sucursal_regla) = self.sucursal {
            if !CondicionRegla::SucursalIgual(sucursal_regla).coincide(sujeto, accion, recurso) {
                return false;
            }
        }
        if let Some(tope) = self.monto_maximo {
            if !tope.is_finite() || tope < 0.0 {
                // Falla cerrado: una regla de denegacion mal formada bloquea; una de permiso no habilita.
                return self.efecto == EfectoRegla::Denegar;
            }
            let excede_tope = CondicionRegla::MontoMayorQue(tope).coincide(sujeto, accion, recurso);
            match self.efecto {
                EfectoRegla::Denegar => {
                    if !excede_tope {
                        return false;
                    }
                }
                EfectoRegla::Permitir => {
                    if excede_tope {
                        return false;
                    }
                }
            }
        }
        true
    }
}

/// Motor de autorizacion offline deterministico: denegado por defecto y denegacion explicita prioritaria.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MotorReglas {
    pub reglas: Vec<ReglaAdicional>,
}

impl MotorReglas {
    /// Construye un motor vacio solo con las guardas base innegociables.
    pub fn crear() -> Self {
        Self::default()
    }

    /// Deserializa un conjunto de reglas o un motor completo desde texto JSON.
    pub fn desde_json(contenido: &str) -> Result<Self, ErrorNucleo> {
        if let Ok(motor) = serde_json::from_str::<Self>(contenido) {
            return Ok(motor);
        }
        let reglas = serde_json::from_str::<Vec<ReglaAdicional>>(contenido)
            .map_err(|_| ErrorNucleo::IntegridadInvalida)?;
        Ok(Self { reglas })
    }

    /// Agrega una regla adicional al motor en memoria.
    pub fn agregar_regla(&mut self, regla: ReglaAdicional) {
        self.reglas.push(regla);
    }

    /// Evalua si el sujeto puede ejecutar la accion sobre el recurso objetivo.
    pub fn autorizar(
        &self,
        sujeto: &SujetoOperador,
        accion: Accion,
        recurso: &RecursoObjetivo,
    ) -> Result<(), ErrorNucleo> {
        if let Some(monto) = recurso.monto_ajuste_abs {
            if !monto.is_finite() || monto < 0.0 {
                return Err(ErrorNucleo::NoAutorizado);
            }
        }

        // 1. Precedencia absoluta de denegacion explicita (incluso sobre Administrador o Permitir).
        let denegado_explicitamente = self
            .reglas
            .iter()
            .filter(|regla| regla.efecto == EfectoRegla::Denegar)
            .any(|regla| regla.coincide(sujeto, accion, recurso));
        if denegado_explicitamente {
            return Err(ErrorNucleo::NoAutorizado);
        }

        // 2. Aislamiento celular estricto (MP-CELDA).
        if !alcance_celular_valido(sujeto, recurso) {
            return Err(ErrorNucleo::NoAutorizado);
        }

        // 3. Guardas antifraude de terminal local y matriz denegado-por-defecto (MP-ESTAB / MP-SEG).
        if !guarda_y_permiso_base_valido(sujeto, accion, recurso) {
            return Err(ErrorNucleo::NoAutorizado);
        }

        Ok(())
    }
}

fn alcance_celular_valido(sujeto: &SujetoOperador, recurso: &RecursoObjetivo) -> bool {
    match sujeto.rol {
        RolOperador::Administrador => true,
        RolOperador::Zonal => sujeto
            .sucursales_asignadas
            .contains(&recurso.sucursal_destino),
        RolOperador::Sucursal | RolOperador::Colector => {
            recurso.sucursal_destino == sujeto.sucursal_origen
        }
    }
}

fn guarda_y_permiso_base_valido(
    sujeto: &SujetoOperador,
    accion: Accion,
    recurso: &RecursoObjetivo,
) -> bool {
    if accion == Accion::ImpactarAjusteLocal
        && (!sujeto.sesion_local_activa || sujeto.rol == RolOperador::Colector)
    {
        return false;
    }

    if accion == Accion::CerrarUbicacionQr && sujeto.rol != RolOperador::Administrador {
        if let Some(ref autor) = recurso.ubicacion_abierta_por {
            if sujeto.operador_id.is_empty() || autor != &sujeto.operador_id {
                return false;
            }
        }
    }

    matches!(
        (sujeto.rol, accion),
        (RolOperador::Administrador, _)
            | (
                RolOperador::Zonal,
                Accion::VerPanel
                    | Accion::ContarCiclico
                    | Accion::ImpactarAjusteLocal
                    | Accion::AprobarBajaLaboratorio
                    | Accion::RegistrarLecturaColector
                    | Accion::CerrarUbicacionQr
                    | Accion::TransferirVencimiento
            )
            | (
                RolOperador::Sucursal,
                Accion::VerPanel
                    | Accion::ContarCiclico
                    | Accion::ImpactarAjusteLocal
                    | Accion::RegistrarLecturaColector
                    | Accion::CerrarUbicacionQr
                    | Accion::TransferirVencimiento
            )
            | (
                RolOperador::Colector,
                Accion::RegistrarLecturaColector | Accion::CerrarUbicacionQr
            )
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sujeto_base(rol: RolOperador, sucursal_origen: u16) -> SujetoOperador {
        SujetoOperador {
            operador_id: String::from("op-100"),
            rol,
            sucursal_origen: SucursalId(sucursal_origen),
            sucursales_asignadas: Vec::new(),
            sesion_local_activa: true,
        }
    }

    fn recurso_base(sucursal_destino: u16) -> RecursoObjetivo {
        RecursoObjetivo {
            sucursal_destino: SucursalId(sucursal_destino),
            monto_ajuste_abs: None,
            ubicacion_abierta_por: None,
        }
    }

    #[test]
    fn sucursal_aislada_en_su_propia_celda() {
        let motor = MotorReglas::crear();
        assert_eq!(motor, MotorReglas::default());
        let mut operador = sujeto_base(RolOperador::Sucursal, 5);
        operador.sucursales_asignadas = vec![SucursalId(12)];

        assert!(motor
            .autorizar(&operador, Accion::VerPanel, &recurso_base(5))
            .is_ok());
        assert!(motor
            .autorizar(&operador, Accion::ContarCiclico, &recurso_base(5))
            .is_ok());
        assert!(motor
            .autorizar(&operador, Accion::TransferirVencimiento, &recurso_base(5))
            .is_ok());

        let fuera_de_celda = motor.autorizar(&operador, Accion::VerPanel, &recurso_base(12));
        assert!(matches!(fuera_de_celda, Err(ErrorNucleo::NoAutorizado)));

        let ajuste_ajeno =
            motor.autorizar(&operador, Accion::ImpactarAjusteLocal, &recurso_base(12));
        assert!(matches!(ajuste_ajeno, Err(ErrorNucleo::NoAutorizado)));
    }

    #[test]
    fn impactar_ajuste_exige_sesion_local_activa() {
        let motor = MotorReglas::crear();

        let mut operador_sin_sesion = sujeto_base(RolOperador::Sucursal, 5);
        operador_sin_sesion.sesion_local_activa = false;
        let denegado = motor.autorizar(
            &operador_sin_sesion,
            Accion::ImpactarAjusteLocal,
            &recurso_base(5),
        );
        assert!(matches!(denegado, Err(ErrorNucleo::NoAutorizado)));

        let mut admin_sin_sesion = sujeto_base(RolOperador::Administrador, 1);
        admin_sin_sesion.sesion_local_activa = false;
        let denegado_admin = motor.autorizar(
            &admin_sin_sesion,
            Accion::ImpactarAjusteLocal,
            &recurso_base(5),
        );
        assert!(matches!(denegado_admin, Err(ErrorNucleo::NoAutorizado)));

        let operador_con_sesion = sujeto_base(RolOperador::Sucursal, 5);
        assert!(motor
            .autorizar(
                &operador_con_sesion,
                Accion::ImpactarAjusteLocal,
                &recurso_base(5)
            )
            .is_ok());
    }

    #[test]
    fn alcance_zonal_y_restriccion_de_administracion() {
        let motor = MotorReglas::crear();
        let mut zonal = sujeto_base(RolOperador::Zonal, 1);
        zonal.sucursales_asignadas = vec![SucursalId(3), SucursalId(7)];

        assert!(motor
            .autorizar(&zonal, Accion::VerPanel, &recurso_base(3))
            .is_ok());
        assert!(motor
            .autorizar(&zonal, Accion::AprobarBajaLaboratorio, &recurso_base(7))
            .is_ok());
        assert!(motor
            .autorizar(&zonal, Accion::ImpactarAjusteLocal, &recurso_base(3))
            .is_ok());

        let fuera_de_zona = motor.autorizar(&zonal, Accion::VerPanel, &recurso_base(12));
        assert!(matches!(fuera_de_zona, Err(ErrorNucleo::NoAutorizado)));

        let origen_no_asignado = motor.autorizar(&zonal, Accion::VerPanel, &recurso_base(1));
        assert!(matches!(origen_no_asignado, Err(ErrorNucleo::NoAutorizado)));

        let admin_denegado = motor.autorizar(&zonal, Accion::AdministrarSistema, &recurso_base(3));
        assert!(matches!(admin_denegado, Err(ErrorNucleo::NoAutorizado)));

        let sucursal = sujeto_base(RolOperador::Sucursal, 5);
        assert!(matches!(
            motor.autorizar(&sucursal, Accion::AprobarBajaLaboratorio, &recurso_base(5)),
            Err(ErrorNucleo::NoAutorizado)
        ));
        assert!(matches!(
            motor.autorizar(&sucursal, Accion::AdministrarSistema, &recurso_base(5)),
            Err(ErrorNucleo::NoAutorizado)
        ));
    }

    #[test]
    fn colector_confinado_a_lecturas_y_cierre_de_ubicacion_propia() {
        let motor = MotorReglas::crear();
        let colector = sujeto_base(RolOperador::Colector, 8);

        assert!(motor
            .autorizar(
                &colector,
                Accion::RegistrarLecturaColector,
                &recurso_base(8)
            )
            .is_ok());
        assert!(motor
            .autorizar(&colector, Accion::CerrarUbicacionQr, &recurso_base(8))
            .is_ok());

        let recurso_propio = RecursoObjetivo {
            sucursal_destino: SucursalId(8),
            monto_ajuste_abs: None,
            ubicacion_abierta_por: Some(String::from("op-100")),
        };
        assert!(motor
            .autorizar(&colector, Accion::CerrarUbicacionQr, &recurso_propio)
            .is_ok());

        let recurso_ajeno = RecursoObjetivo {
            sucursal_destino: SucursalId(8),
            monto_ajuste_abs: None,
            ubicacion_abierta_por: Some(String::from("op-999")),
        };
        assert!(matches!(
            motor.autorizar(&colector, Accion::CerrarUbicacionQr, &recurso_ajeno),
            Err(ErrorNucleo::NoAutorizado)
        ));

        assert!(matches!(
            motor.autorizar(&colector, Accion::ImpactarAjusteLocal, &recurso_base(8)),
            Err(ErrorNucleo::NoAutorizado)
        ));
        assert!(matches!(
            motor.autorizar(&colector, Accion::VerPanel, &recurso_base(8)),
            Err(ErrorNucleo::NoAutorizado)
        ));
        assert!(matches!(
            motor.autorizar(
                &colector,
                Accion::RegistrarLecturaColector,
                &recurso_base(9)
            ),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let admin = sujeto_base(RolOperador::Administrador, 1);
        assert!(motor
            .autorizar(&admin, Accion::CerrarUbicacionQr, &recurso_ajeno)
            .is_ok());
        assert!(motor
            .autorizar(&admin, Accion::AdministrarSistema, &recurso_base(71))
            .is_ok());
    }

    #[test]
    fn denegacion_explicita_prevalece_sobre_permitir_y_permisos_base() {
        let mut motor = MotorReglas::crear();

        motor.agregar_regla(ReglaAdicional {
            id: String::from("permitir-suc-5"),
            efecto: EfectoRegla::Permitir,
            accion: None,
            rol: None,
            sucursal: Some(SucursalId(5)),
            monto_maximo: Some(50_000.0),
            descripcion: String::from("Permiso nominal sobre sucursal 5"),
        });

        motor.agregar_regla(ReglaAdicional {
            id: String::from("bloqueo-suc-5"),
            efecto: EfectoRegla::Denegar,
            accion: None,
            rol: None,
            sucursal: Some(SucursalId(5)),
            monto_maximo: None,
            descripcion: String::from("Bloqueo preventivo de sucursal 5"),
        });

        motor.agregar_regla(ReglaAdicional {
            id: String::from("tope-ajuste-general"),
            efecto: EfectoRegla::Denegar,
            accion: Some(Accion::ImpactarAjusteLocal),
            rol: None,
            sucursal: None,
            monto_maximo: Some(10_000.0),
            descripcion: String::from("Tope maximo de ajuste local"),
        });

        let admin = sujeto_base(RolOperador::Administrador, 1);
        let sucursal_5 = sujeto_base(RolOperador::Sucursal, 5);

        assert!(matches!(
            motor.autorizar(&admin, Accion::VerPanel, &recurso_base(5)),
            Err(ErrorNucleo::NoAutorizado)
        ));
        assert!(matches!(
            motor.autorizar(&sucursal_5, Accion::VerPanel, &recurso_base(5)),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let ajuste_permitido = RecursoObjetivo {
            sucursal_destino: SucursalId(6),
            monto_ajuste_abs: Some(10_000.0),
            ubicacion_abierta_por: None,
        };
        assert!(motor
            .autorizar(&admin, Accion::ImpactarAjusteLocal, &ajuste_permitido)
            .is_ok());

        let ajuste_excedido = RecursoObjetivo {
            sucursal_destino: SucursalId(6),
            monto_ajuste_abs: Some(10_000.01),
            ubicacion_abierta_por: None,
        };
        assert!(matches!(
            motor.autorizar(&admin, Accion::ImpactarAjusteLocal, &ajuste_excedido),
            Err(ErrorNucleo::NoAutorizado)
        ));
    }

    #[test]
    fn montos_no_validos_fallan_cerrado() {
        let motor = MotorReglas::crear();
        let admin = sujeto_base(RolOperador::Administrador, 1);

        for monto_invalido in [f64::NAN, f64::INFINITY, -0.01] {
            let recurso = RecursoObjetivo {
                sucursal_destino: SucursalId(1),
                monto_ajuste_abs: Some(monto_invalido),
                ubicacion_abierta_por: None,
            };
            assert!(matches!(
                motor.autorizar(&admin, Accion::ImpactarAjusteLocal, &recurso),
                Err(ErrorNucleo::NoAutorizado)
            ));
        }
    }

    #[test]
    fn serializacion_y_deserializacion_desde_json() {
        let arreglo_json = r#"[
            {
                "id": "tope-ajuste-suc-10",
                "efecto": "Denegar",
                "accion": "ImpactarAjusteLocal",
                "rol": "Sucursal",
                "sucursal": 10,
                "monto_maximo": 2500.0,
                "descripcion": "Limite operativo para sucursal 10"
            },
            {
                "id": "bloqueo-suc-14",
                "efecto": "Denegar",
                "sucursal": 14,
                "descripcion": "Auditoria en curso"
            }
        ]"#;

        let motor = MotorReglas::desde_json(arreglo_json).expect("JSON valido de reglas");
        assert_eq!(motor.reglas.len(), 2);

        let serializado = serde_json::to_string(&motor).expect("Serializacion de motor");
        let recargado = MotorReglas::desde_json(&serializado).expect("Recarga de motor");
        assert_eq!(motor, recargado);

        let operador_10 = sujeto_base(RolOperador::Sucursal, 10);
        let ajuste_bajo = RecursoObjetivo {
            sucursal_destino: SucursalId(10),
            monto_ajuste_abs: Some(2500.0),
            ubicacion_abierta_por: None,
        };
        assert!(recargado
            .autorizar(&operador_10, Accion::ImpactarAjusteLocal, &ajuste_bajo)
            .is_ok());

        let ajuste_alto = RecursoObjetivo {
            sucursal_destino: SucursalId(10),
            monto_ajuste_abs: Some(2501.0),
            ubicacion_abierta_por: None,
        };
        assert!(matches!(
            recargado.autorizar(&operador_10, Accion::ImpactarAjusteLocal, &ajuste_alto),
            Err(ErrorNucleo::NoAutorizado)
        ));

        let admin = sujeto_base(RolOperador::Administrador, 1);
        assert!(matches!(
            recargado.autorizar(&admin, Accion::VerPanel, &recurso_base(14)),
            Err(ErrorNucleo::NoAutorizado)
        ));

        assert!(matches!(
            MotorReglas::desde_json("{json_roto"),
            Err(ErrorNucleo::IntegridadInvalida)
        ));
    }

    #[test]
    fn condicion_regla_serializa_y_evalua() {
        let condiciones = vec![
            CondicionRegla::SucursalIgual(SucursalId(5)),
            CondicionRegla::MontoMayorQue(1000.0),
            CondicionRegla::RolIgual(RolOperador::Sucursal),
            CondicionRegla::AccionIgual(Accion::ImpactarAjusteLocal),
            CondicionRegla::RequiereSesionLocal,
        ];

        let json = serde_json::to_string(&condiciones).expect("Serializar condiciones");
        let decodificadas: Vec<CondicionRegla> =
            serde_json::from_str(&json).expect("Deserializar condiciones");
        assert_eq!(condiciones, decodificadas);

        let sujeto = sujeto_base(RolOperador::Sucursal, 5);
        let recurso = RecursoObjetivo {
            sucursal_destino: SucursalId(5),
            monto_ajuste_abs: Some(1500.0),
            ubicacion_abierta_por: None,
        };
        for condicion in &decodificadas {
            assert!(condicion.coincide(&sujeto, Accion::ImpactarAjusteLocal, &recurso));
        }
    }
}

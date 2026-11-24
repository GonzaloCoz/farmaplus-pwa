use comun::SucursalId;
use serde::Serialize;

/// Metadatos canonicos de red y base local para cada sucursal de la red.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct InfoSucursal {
    pub id: SucursalId,
    pub codigo: &'static str,
    pub nombre: &'static str,
    pub anfitrion_primario: &'static str,
    pub anfitrion_secundario: &'static str,
    pub puerto: u16,
    pub base_datos: &'static str,
}

/// Padron oficial completo extraido de `branchNetworkMap.ts` (77 sucursales registradas).
/// Ninguna entrada define fallback cruzado entre subredes `10.0.X.10` y `192.168.X.10`.
pub const SUCURSALES_OFICIALES: &[InfoSucursal] = &[
    InfoSucursal {
        id: SucursalId(1),
        codigo: "S01",
        nombre: "FP ADM (Pruebas)",
        anfitrion_primario: "172.30.40.63",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(2),
        codigo: "S02",
        nombre: "PARQUE PATRICIOS",
        anfitrion_primario: "192.168.42.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(4),
        codigo: "S04",
        nombre: "RETIRO II",
        anfitrion_primario: "192.168.22.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(5),
        codigo: "S05",
        nombre: "RECOLETA IV",
        anfitrion_primario: "192.168.20.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(6),
        codigo: "S06",
        nombre: "RECOLETA II",
        anfitrion_primario: "192.168.14.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(7),
        codigo: "S07",
        nombre: "BELGRANO",
        anfitrion_primario: "192.168.25.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(8),
        codigo: "S08",
        nombre: "MICROCENTRO II",
        anfitrion_primario: "192.168.27.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(9),
        codigo: "S09",
        nombre: "CABALLITO III",
        anfitrion_primario: "192.168.24.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(10),
        codigo: "S10",
        nombre: "RECOLETA",
        anfitrion_primario: "192.168.26.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(11),
        codigo: "S11",
        nombre: "POMPEYA",
        anfitrion_primario: "192.168.17.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(12),
        codigo: "S12",
        nombre: "DEVOTO",
        anfitrion_primario: "10.0.12.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(13),
        codigo: "S13",
        nombre: "RECOLETA III",
        anfitrion_primario: "10.0.13.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(14),
        codigo: "S14",
        nombre: "LAS CANITAS",
        anfitrion_primario: "10.0.14.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(15),
        codigo: "S15",
        nombre: "PALERMO",
        anfitrion_primario: "192.168.12.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(16),
        codigo: "S16",
        nombre: "TRIBUNALES",
        anfitrion_primario: "192.168.19.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(17),
        codigo: "S17",
        nombre: "RETIRO",
        anfitrion_primario: "192.168.2.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(18),
        codigo: "S18",
        nombre: "NUNEZ",
        anfitrion_primario: "10.0.18.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(19),
        codigo: "S19",
        nombre: "RECOLETA V",
        anfitrion_primario: "192.168.3.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(20),
        codigo: "S20",
        nombre: "CABALLITO",
        anfitrion_primario: "10.0.20.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(21),
        codigo: "S21",
        nombre: "CABALLITO II",
        anfitrion_primario: "192.168.6.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(22),
        codigo: "S22",
        nombre: "FLORES",
        anfitrion_primario: "10.0.22.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(23),
        codigo: "S23",
        nombre: "SAN ISIDRO",
        anfitrion_primario: "10.0.23.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(24),
        codigo: "S24",
        nombre: "BECCAR",
        anfitrion_primario: "10.0.24.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(25),
        codigo: "S25",
        nombre: "SAN ISIDRO II",
        anfitrion_primario: "192.168.10.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(26),
        codigo: "S26",
        nombre: "BELGRANO VI",
        anfitrion_primario: "10.0.26.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(27),
        codigo: "S27",
        nombre: "MICROCENTRO",
        anfitrion_primario: "10.0.27.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(28),
        codigo: "S28",
        nombre: "BELGRANO V",
        anfitrion_primario: "10.0.28.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(29),
        codigo: "S29",
        nombre: "VILLA URQUIZA",
        anfitrion_primario: "10.0.29.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(30),
        codigo: "S30",
        nombre: "VILLA DEL PARQUE",
        anfitrion_primario: "192.168.31.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(31),
        codigo: "S31",
        nombre: "VILLA URQUIZA II",
        anfitrion_primario: "192.168.32.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(32),
        codigo: "S32",
        nombre: "VILLA URQUIZA III",
        anfitrion_primario: "10.0.32.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(34),
        codigo: "S34",
        nombre: "LOREAL G. PACIFICO",
        anfitrion_primario: "192.168.23.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(35),
        codigo: "S35",
        nombre: "BERAZATEGUI II",
        anfitrion_primario: "192.168.34.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(36),
        codigo: "S36",
        nombre: "BERAZATEGUI",
        anfitrion_primario: "10.0.36.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(37),
        codigo: "S37",
        nombre: "QUILMES",
        anfitrion_primario: "10.0.37.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(38),
        codigo: "S38",
        nombre: "BELGRANO IV",
        anfitrion_primario: "192.168.38.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(39),
        codigo: "S39",
        nombre: "BELGRANO III",
        anfitrion_primario: "192.168.37.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(40),
        codigo: "S40",
        nombre: "VILLA CRESPO",
        anfitrion_primario: "192.168.45.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(42),
        codigo: "S42",
        nombre: "BARRACAS",
        anfitrion_primario: "192.168.44.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(43),
        codigo: "S43",
        nombre: "BELGRANO II",
        anfitrion_primario: "192.168.18.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(44),
        codigo: "S44",
        nombre: "VILLA BALLESTER",
        anfitrion_primario: "10.0.44.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(45),
        codigo: "S45",
        nombre: "VILLA BALLESTER II",
        anfitrion_primario: "10.0.45.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(46),
        codigo: "S46",
        nombre: "SAN MIGUEL",
        anfitrion_primario: "10.0.46.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(47),
        codigo: "S47",
        nombre: "VILLA DEL PARQUE II",
        anfitrion_primario: "10.0.47.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(48),
        codigo: "S48",
        nombre: "PARQUE CENTENARIO",
        anfitrion_primario: "192.168.43.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(49),
        codigo: "S49",
        nombre: "PILAR",
        anfitrion_primario: "192.168.47.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(50),
        codigo: "S50",
        nombre: "ISDIN G. PACIFICO",
        anfitrion_primario: "10.0.50.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(51),
        codigo: "S51",
        nombre: "LOREAL ALTO PALERMO",
        anfitrion_primario: "10.0.51.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(52),
        codigo: "S52",
        nombre: "ISDIN PALERMO",
        anfitrion_primario: "10.0.52.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(53),
        codigo: "S53",
        nombre: "BELGRANO VII",
        anfitrion_primario: "10.0.48.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(54),
        codigo: "S54",
        nombre: "PALERMO II",
        anfitrion_primario: "10.0.49.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(55),
        codigo: "S55",
        nombre: "BELGRANO VIII",
        anfitrion_primario: "10.0.51.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(56),
        codigo: "S56",
        nombre: "CABALLITO IV",
        anfitrion_primario: "10.0.50.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(58),
        codigo: "S58",
        nombre: "VILLA LURO",
        anfitrion_primario: "10.0.52.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(59),
        codigo: "S59",
        nombre: "PALERMO III",
        anfitrion_primario: "10.0.54.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(60),
        codigo: "S60",
        nombre: "CHACARITA",
        anfitrion_primario: "10.0.53.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(61),
        codigo: "S61",
        nombre: "GONZALEZ CATAN",
        anfitrion_primario: "10.0.61.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(62),
        codigo: "S62",
        nombre: "MORON",
        anfitrion_primario: "10.0.62.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(63),
        codigo: "S63",
        nombre: "RAMOS MEJIA II",
        anfitrion_primario: "10.0.64.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(64),
        codigo: "S64",
        nombre: "RAMOS MEJIA",
        anfitrion_primario: "10.0.63.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(65),
        codigo: "S65",
        nombre: "BOEDO",
        anfitrion_primario: "10.0.65.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(66),
        codigo: "S66",
        nombre: "DEVOTO II",
        anfitrion_primario: "10.0.66.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(67),
        codigo: "S67",
        nombre: "GONZALEZ CATAN II",
        anfitrion_primario: "10.0.67.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(68),
        codigo: "S68",
        nombre: "GONZALEZ CATAN III",
        anfitrion_primario: "10.0.68.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(69),
        codigo: "S69",
        nombre: "RAMOS MEJIA III",
        anfitrion_primario: "10.0.69.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(70),
        codigo: "S70",
        nombre: "SALADILLO",
        anfitrion_primario: "10.0.70.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(71),
        codigo: "S71",
        nombre: "PADUA",
        anfitrion_primario: "10.0.71.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(72),
        codigo: "S72",
        nombre: "MERCEDES",
        anfitrion_primario: "10.0.72.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(73),
        codigo: "S73",
        nombre: "ESCOBAR",
        anfitrion_primario: "10.0.73.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(74),
        codigo: "S74",
        nombre: "PALERMO IV",
        anfitrion_primario: "10.0.74.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(75),
        codigo: "S75",
        nombre: "DEVOTO III",
        anfitrion_primario: "10.0.75.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(76),
        codigo: "S76",
        nombre: "PILAR II",
        anfitrion_primario: "10.0.76.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(104),
        codigo: "S104",
        nombre: "VILLA URQUIZA IV",
        anfitrion_primario: "10.0.104.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(105),
        codigo: "S105",
        nombre: "BALVANERA",
        anfitrion_primario: "10.0.105.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(106),
        codigo: "S106",
        nombre: "BALVANERA II",
        anfitrion_primario: "10.0.106.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(107),
        codigo: "S107",
        nombre: "COLEGIALES",
        anfitrion_primario: "10.0.107.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
    InfoSucursal {
        id: SucursalId(108),
        codigo: "S108",
        nombre: "RECOLETA VI",
        anfitrion_primario: "10.0.108.10",
        anfitrion_secundario: "",
        puerto: 3306,
        base_datos: "plex",
    },
];

/// Busca una sucursal oficial por su identificador canonico.
pub fn buscar_sucursal(id: SucursalId) -> Option<&'static InfoSucursal> {
    SUCURSALES_OFICIALES
        .iter()
        .find(|sucursal| sucursal.id == id)
}

/// Devuelve los anfitriones candidatos permitiendo unicamente fallback local `localhost <-> 127.0.0.1`.
/// Jamas cruza subredes privadas (`10.0.X.10` con `192.168.X.10`) para evitar impactos en otra farmacia.
pub fn candidatos_anfitrion(anfitrion: &str) -> Vec<String> {
    let limpio = anfitrion.trim();
    if limpio.is_empty() {
        return Vec::new();
    }

    let mut candidatos = vec![limpio.to_owned()];
    if limpio.eq_ignore_ascii_case("localhost") {
        candidatos.push(String::from("127.0.0.1"));
    } else if limpio == "127.0.0.1" {
        candidatos.push(String::from("localhost"));
    }
    candidatos
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn padron_oficial_completo_y_sin_colisiones() {
        assert_eq!(SUCURSALES_OFICIALES.len(), 77);

        let mut ids = HashSet::new();
        let mut codigos = HashSet::new();
        for sucursal in SUCURSALES_OFICIALES {
            assert!(ids.insert(sucursal.id), "id duplicado: {:?}", sucursal.id);
            assert!(
                codigos.insert(sucursal.codigo),
                "codigo duplicado: {}",
                sucursal.codigo
            );
            assert_eq!(sucursal.puerto, 3306);
            assert_eq!(sucursal.base_datos, "plex");
            assert!(
                sucursal.anfitrion_secundario.is_empty(),
                "sucursal {} no debe definir fallback cruzado de subred",
                sucursal.codigo
            );
        }

        let adm = buscar_sucursal(SucursalId(1)).expect("S01 presente");
        assert_eq!(adm.anfitrion_primario, "172.30.40.63");
        assert_eq!(adm.nombre, "FP ADM (Pruebas)");

        let retiro_dos = buscar_sucursal(SucursalId(4)).expect("S04 presente");
        assert_eq!(retiro_dos.anfitrion_primario, "192.168.22.10");
        assert_eq!(retiro_dos.nombre, "RETIRO II");

        let retiro = buscar_sucursal(SucursalId(17)).expect("S17 presente");
        assert_eq!(retiro.anfitrion_primario, "192.168.2.10");
        assert_eq!(retiro.nombre, "RETIRO");

        let flores = buscar_sucursal(SucursalId(22)).expect("S22 presente");
        assert_eq!(flores.anfitrion_primario, "10.0.22.10");
        assert_eq!(flores.nombre, "FLORES");

        let belgrano_siete = buscar_sucursal(SucursalId(53)).expect("S53 presente");
        assert_eq!(belgrano_siete.anfitrion_primario, "10.0.48.10");

        let recoleta_seis = buscar_sucursal(SucursalId(108)).expect("S108 presente");
        assert_eq!(recoleta_seis.anfitrion_primario, "10.0.108.10");

        assert!(buscar_sucursal(SucursalId(9999)).is_none());
    }

    #[test]
    fn candidatos_anfitrion_nunca_cruza_subredes_y_habilita_loopback() {
        let suc_4 = candidatos_anfitrion("10.0.4.10");
        assert_eq!(suc_4, vec!["10.0.4.10"]);
        assert!(!suc_4.iter().any(|ip| ip == "192.168.4.10"));

        let suc_22 = candidatos_anfitrion("192.168.22.10");
        assert_eq!(suc_22, vec!["192.168.22.10"]);
        assert!(!suc_22.iter().any(|ip| ip == "10.0.22.10"));

        let adm = candidatos_anfitrion("172.30.40.63");
        assert_eq!(adm, vec!["172.30.40.63"]);

        assert_eq!(
            candidatos_anfitrion("localhost"),
            vec!["localhost", "127.0.0.1"]
        );
        assert_eq!(
            candidatos_anfitrion(" 127.0.0.1 "),
            vec!["127.0.0.1", "localhost"]
        );
        assert!(candidatos_anfitrion("   ").is_empty());
    }
}

//! Conector local de sucursal, sesion de terminal y operaciones parametrizadas.

pub mod operaciones;
pub mod red;
pub mod sesion;

pub use operaciones::{
    calcular_id_global, cargar_interfarmacias_desde_mysql, cargar_padron_desde_mysql,
    conectar_mysql_sucursal, construir_lote_ajuste, consulta_padron_sucursal,
    contiene_huella_idempotencia, ejecutar_lote_ajuste_mysql, estampar_observacion_idempotente,
    parsear_productos_suspendidos, restaurar_trazables_mysql, verificar_ajuste_aplicado_mysql,
    ConfiguracionMysql, EnvioInterfarmaciaCrudo, LineaInterfarmaciaCruda, LoteAjusteLocal,
    MotivoAjusteLocal, RenglonAjusteLocal, ResultadoAjusteLocal, ResultadoInterfarmaciasMysql,
    CONFIG_SESSION_GROUP_CONCAT, FACTOR_ID_GLOBAL,
};
pub use red::{buscar_sucursal, candidatos_anfitrion, InfoSucursal, SUCURSALES_OFICIALES};
pub use sesion::{verificar_terminal_local, EstadoTerminalLocal};

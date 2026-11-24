CREATE TABLE IF NOT EXISTS articulos (
    producto_id TEXT PRIMARY KEY,
    sucursal_id INTEGER NOT NULL,
    troquel TEXT,
    descripcion TEXT NOT NULL,
    laboratorio TEXT,
    rubro TEXT,
    subrubro TEXT,
    existencia REAL NOT NULL DEFAULT 0,
    costo REAL NOT NULL DEFAULT 0,
    precio REAL NOT NULL DEFAULT 0,
    oculto INTEGER NOT NULL DEFAULT 0,
    trazable INTEGER NOT NULL DEFAULT 0,
    gtin TEXT,
    padre_id TEXT,
    unidades_padre INTEGER NOT NULL DEFAULT 1,
    actualizado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_articulos_troquel ON articulos(troquel);
CREATE INDEX IF NOT EXISTS idx_articulos_gtin ON articulos(gtin);
CREATE INDEX IF NOT EXISTS idx_articulos_laboratorio ON articulos(laboratorio);
CREATE INDEX IF NOT EXISTS idx_articulos_descripcion ON articulos(descripcion);

CREATE TABLE IF NOT EXISTS codigos_barra (
    codigo TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    es_principal INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (codigo, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_codigos_barra_codigo ON codigos_barra(codigo);
CREATE INDEX IF NOT EXISTS idx_codigos_barra_producto ON codigos_barra(producto_id);

CREATE TABLE IF NOT EXISTS lecturas_colector (
    id TEXT PRIMARY KEY,
    sesion_id TEXT NOT NULL,
    sucursal_id INTEGER NOT NULL,
    codigo TEXT NOT NULL,
    producto_id TEXT,
    descripcion TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    ubicacion TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    creado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lecturas_colector_sesion ON lecturas_colector(sesion_id);

CREATE TABLE IF NOT EXISTS series_trazables (
    id TEXT PRIMARY KEY,
    sesion_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    gtin TEXT NOT NULL,
    serie TEXT NOT NULL,
    lote TEXT,
    vencimiento TEXT,
    sin_matriz INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sesion_id, gtin, serie)
);

CREATE TABLE IF NOT EXISTS registro_intencion (
    identificador_unico TEXT PRIMARY KEY,
    sucursal_id INTEGER NOT NULL,
    operacion TEXT NOT NULL,
    trazables_suspendidos TEXT,
    estado TEXT NOT NULL,
    creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS libro_mayor (
    id TEXT PRIMARY KEY,
    id_idempotencia TEXT UNIQUE NOT NULL,
    sucursal_id INTEGER NOT NULL,
    laboratorio TEXT NOT NULL,
    ronda INTEGER NOT NULL,
    folio_remoto TEXT,
    operacion_baja_id TEXT,
    operacion_alta_id TEXT,
    diferencia_neta REAL NOT NULL,
    hash_previo TEXT NOT NULL,
    hash_actual TEXT NOT NULL,
    estado TEXT NOT NULL,
    creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bandeja_salida (
    id TEXT PRIMARY KEY,
    id_idempotencia TEXT UNIQUE NOT NULL,
    sucursal_id INTEGER NOT NULL,
    destino TEXT NOT NULL,
    carga_json TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    intentos INTEGER NOT NULL DEFAULT 0,
    proximo_intento_ms INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bandeja_salida_estado_proximo
    ON bandeja_salida(estado, proximo_intento_ms);

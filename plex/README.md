# 🔌 Módulo Conector Plex & Catálogo de Stock

Este directorio contiene toda la lógica, scripts, bases de datos de respaldo y documentación técnica necesaria para conectarse al servidor central **Plex (MySQL)** o consumir los datos de stock y productos de la farmacia/sucursal.

---

## 1. ⚙️ Parámetros de Conexión a Plex (MySQL)

Para conectarse directamente a la base de datos MySQL de Plex en la red local de la sucursal:

| Variable | Valor Predeterminado | Descripción |
| :--- | :--- | :--- |
| **HOST / IP** | `10.0.48.10` | IP del servidor Plex en la red LAN |
| **PORT** | `3306` | Puerto estándar MySQL |
| **DATABASE** | `plex` | Nombre de la base de datos de producción |
| **USER** | `root` | Usuario administrativo con acceso a tablas maestras |
| **PASSWORD** | `m@st3rpl3x0nz3` | Clave de acceso |
| **CHARSET** | `latin1` / `iso-8859-1` | **Crítico:** Necesario para evitar fallos de codificación con tildes, 'ñ' y caracteres especiales en descripciones y nombres |

> **Nota sobre Socket TCP alternativo:** Plex también expone un socket de stream en el puerto `3144` que responde a frames JSON `<JN>{"request": {"type": "GET_PRODUCTOS", ...}}`. Toda esa lógica está encapsulada en `test_plex_cli.py`.

---

## 2. 🗄️ Esquema de Tablas Clave en Plex (MySQL)

Las tablas principales de donde se extraen los datos de inventario son:

1. **`productos`**: Maestro de artículos (`IDProducto`, `Troquel`, `Codebar`, `Producto`, `Presentacion`, `UltimoPrecio`, `Costo`, `FechaUltimoPrecio`, `Activo`, `Ubicacion`, `IDLaboratorio`, `IDRubro`).
2. **`stock`**: Existencias (`IDProducto`, `Cantidad`, `Unidades`, `Minimo`, `maximo`).
3. **`productoscodebars`**: Códigos de barra adicionales/alternativos asociados a un mismo producto (`IDProducto`, `codebar`).
4. **`laboratorios`**: Catálogo de laboratorios farmacéuticos (`IDLaboratorio`, `Nombre`).
5. **`rubros`**: Categorías/rubros de los productos (`IDRubro`, `Nombre`).

---

## 3. 🔍 Consulta SQL Maestra (Extracción Completa y Normalizada)

Esta consulta extrae el 100% de los productos con sus códigos de barra primarios y secundarios agrupados, ubicación, rubro, laboratorio y stock:

```sql
SELECT 
    P.IDProducto,
    P.Troquel,
    P.Codebar AS CodigoPrincipal,
    CONCAT(P.Producto, ' ', IFNULL(P.Presentacion, '')) AS DescripcionCompleta,
    S.Cantidad AS CantidadStock,
    S.Unidades AS UnidadesStock,
    S.Minimo,
    S.maximo AS Maximo,
    R.Nombre AS Rubro,
    L.Nombre AS Laboratorio,
    P.UltimoPrecio AS PrecioVenta,
    P.Costo,
    P.FechaUltimoPrecio,
    P.Activo,
    P.Ubicacion,
    GROUP_CONCAT(DISTINCT PC.codebar SEPARATOR ', ') AS CodigosBarraAlternativos
FROM productos P
INNER JOIN stock S ON S.IDProducto = P.IDProducto
LEFT JOIN productoscodebars PC ON PC.IDProducto = P.IDProducto
LEFT JOIN laboratorios L ON L.IDLaboratorio = P.IDLaboratorio
LEFT JOIN rubros R ON R.IDRubro = P.IDRubro
GROUP BY P.IDProducto
ORDER BY P.IDProducto ASC;
```

---

## 4. 📂 Estructura de Archivos en esta Carpeta

* **`query_plex_mysql.py`**:
  Script ligero en Python que realiza un test de conexión directo a MySQL, imprime estadísticas de stock y muestra los 10 productos con mayor stock.
* **`test_plex_cli.py`**:
  Suite completa y modular. Contiene funciones para:
  - Descargar todo el catálogo vía MySQL directo (`fetch_from_mysql`).
  - Descargar vía Socket TCP puerto 3144 (`fetch_and_save_catalog_socket`).
  - Importar listados Excel de 17 columnas (`import_excel_listado_stock`).
  - Crear e indexar la base SQLite local (`init_sqlite_db`, `save_products_to_storage`).
  - Búsqueda en tiempo real por EAN, Troquel, ID o Nombre.
* **`productos_plex.db`**:
  Base de datos local SQLite con el esquema optimizado e índices en `idx_cb` (códigos de barra), `idx_desc` (descripción) y `idx_troq` (troquel). Ideal para operar offline o en modo desarrollo.
* **`productos_plex.json`**:
  Exportación en formato JSON del catálogo para pruebas rápidas sin conectores SQL.

---

## 5. 🔄 Guía para Adaptar / Conectar a Otra Base de Datos

Si necesitas conectar Farmaplus a otro motor (PostgreSQL, SQLite interno de Tauri, SQL Server u otro MySQL):

1. **Abstraer la Interfaz del Repositorio:**
   Crear una interfaz genérica `InventoryDataSource` con los métodos:
   - `searchByBarcode(code: string): Promise<Product | null>`
   - `searchByTroquel(troquel: string): Promise<Product | null>`
   - `getProductsByRubro(rubroId: string): Promise<Product[]>`
   - `getProductsByLocation(location: string): Promise<Product[]>`
   - `syncCatalog(): Promise<SyncResult>`

2. **Mapeo de Campos:**
   Asegurarse de que el modelo de datos de la aplicación use los campos normalizados:
   - `id`: `IDProducto`
   - `troquel`: `Troquel`
   - `barcode`: `Codebar` (y array de `CodigosBarraAlternativos`)
   - `name`: `DescripcionCompleta`
   - `stock_units`: `CantidadStock` (enteros) / `UnidadesStock` (fracción/unidades sueltas)
   - `price`: `PrecioVenta`
   - `cost`: `Costo`
   - `location`: `Ubicacion` (estantería, góndola)
   - `lab`: `Laboratorio`
   - `category`: `Rubro`

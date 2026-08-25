import sys
import pymysql

sys.stdout.reconfigure(encoding='utf-8')

conn = pymysql.connect(
    host='10.0.48.10',
    user='root',
    password='m@st3rpl3x0nz3',
    database='plex',
    port=3306,
    charset='latin1',
    cursorclass=pymysql.cursors.DictCursor
)

try:
    with conn.cursor() as cursor:
        print("=== CONSULTA SQL DIRECTA A TABLAS MAESTRAS DE PLEX ===\n")
        
        # 1. Conteo total de productos activos con stock
        cursor.execute("""
            SELECT 
                COUNT(*) AS TotalProductos,
                SUM(CASE WHEN S.Cantidad > 0 THEN 1 ELSE 0 END) AS ConStockPositivo,
                SUM(CASE WHEN S.Cantidad = 0 THEN 1 ELSE 0 END) AS ConStockCero,
                SUM(CASE WHEN P.Activo = 'S' THEN 1 ELSE 0 END) AS Activos
            FROM productos P
            INNER JOIN stock S ON S.IDProducto = P.IDProducto
        """)
        stats = cursor.fetchone()
        print(f"📊 Estadísticas de la Sucursal:")
        print(f"  * Total Productos en Stock: {stats['TotalProductos']:,}")
        print(f"  * Productos con Stock > 0: {stats['ConStockPositivo']:,}")
        print(f"  * Productos con Stock = 0: {stats['ConStockCero']:,}")
        print(f"  * Productos Marcados como Activos (Activo='S'): {stats['Activos']:,}\n")

        # 2. Obtener muestra enriquecida con las 17 columnas de Plex
        query = """
            SELECT 
                P.IDProducto,
                P.Troquel,
                P.Codebar AS CodigoEAN,
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
            WHERE S.Cantidad > 0
            GROUP BY P.IDProducto
            ORDER BY S.Cantidad DESC
            LIMIT 10
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        print("🌟 Muestra de 10 productos con mayor stock en la sucursal (Directo de MySQL):")
        for idx, row in enumerate(rows, 1):
            cbs = row['CodigosBarraAlternativos'] or row['CodigoEAN'] or "S/C"
            trq = f" | Troquel: {row['Troquel']}" if row['Troquel'] else ""
            ubi = f" | Ubicación: {row['Ubicacion']}" if row['Ubicacion'] else ""
            print(f"\n[{idx}] ID: {row['IDProducto']}{trq} | Stock: {row['CantidadStock']} u. | Precio: ${row['PrecioVenta']}")
            print(f"    Nombre: {row['DescripcionCompleta']}")
            print(f"    Lab: {row['Laboratorio']} | Rubro: {row['Rubro']}{ubi} | Activo: {row['Activo']}")
            print(f"    Códigos Barra: {cbs}")

finally:
    conn.close()

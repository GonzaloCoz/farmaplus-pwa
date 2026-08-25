#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
====================================================================
      PLEX ADVANCED STOCK & PROTOCOL TESTER CLI (SUITE COMPLETA)
====================================================================
Incorpora todas las vías de captura de Listado de Stock de Plex:
 1. Conexión Directa SQL a MySQL (Base 'plex' - Datos 100% Enriquecidos)
 2. Socket TCP Nativo (GET_PRODUCTOS - Puerto 3144)
 3. Importador del Listado Oficial de Stock Plex (Excel 17 columnas)
 4. Buscador y Escáner en tiempo real (EAN, Troquel, ID, Nombre)
"""

import sys
import os
import time
import socket
import json
import csv
import sqlite3
from datetime import datetime

# Garantizar compatibilidad UTF-8 en salida de terminal
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "plex_test_results.log")
JSON_EXPORT_FILE = os.path.join(BASE_DIR, "productos_plex.json")
CSV_EXPORT_FILE = os.path.join(BASE_DIR, "productos_plex.csv")
SQLITE_EXPORT_FILE = os.path.join(BASE_DIR, "productos_plex.db")

def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prefix_map = {
        "INFO": "[INFO] ",
        "SUCCESS": "[OK]   ",
        "WARN": "[WARN] ",
        "ERROR": "[FAIL] ",
        "DATA": "[DATA] "
    }
    prefix = prefix_map.get(level, "[LOG]  ")
    formatted = f"[{timestamp}] {prefix}{msg}"
    print(formatted)
    
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(formatted + "\n")
    except Exception:
        pass

def init_sqlite_db():
    conn = sqlite3.connect(SQLITE_EXPORT_FILE)
    cursor = conn.cursor()
    
    # Comprobar si la tabla tiene el esquema actualizado (con columna troquel)
    cursor.execute("PRAGMA table_info(productos)")
    cols = [r[1] for r in cursor.fetchall()]
    
    if cols and 'troquel' not in cols:
        cursor.execute("DROP TABLE IF EXISTS productos")
        cursor.execute("DROP TABLE IF EXISTS codigos_barra")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            idproducto TEXT PRIMARY KEY,
            troquel TEXT,
            descripcion TEXT,
            stock TEXT,
            unidades TEXT,
            minimo TEXT,
            maximo TEXT,
            grupo TEXT,
            rubro TEXT,
            precio TEXT,
            fecha_precio TEXT,
            costo TEXT,
            unidades_prod TEXT,
            laboratorio TEXT,
            id_laboratorio TEXT,
            origen TEXT,
            raw_json TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS codigos_barra (
            codbarra TEXT,
            idproducto TEXT,
            PRIMARY KEY(codbarra, idproducto)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cb ON codigos_barra(codbarra)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_desc ON productos(descripcion)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_troq ON productos(troquel)")
    conn.commit()
    conn.close()

# -------------------------------------------------------------
# 1. CAPTURA DIRECTA VÍA BASE DE DATOS MYSQL (MÉTODO OFICIAL PLEX)
# -------------------------------------------------------------
def fetch_from_mysql(host="10.0.48.10", port=3306, only_positive_stock=False):
    log("=================================================================", "INFO")
    log(f"Iniciando consulta directa SQL a base de datos MySQL en {host}:{port}...", "INFO")
    
    try:
        import pymysql
    except ImportError:
        log("Instalando módulo pymysql...", "INFO")
        os.system(f"{sys.executable} -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org pymysql -q")
        import pymysql

    try:
        t0 = time.time()
        conn = pymysql.connect(
            host=host,
            user="root",
            password="m@st3rpl3x0nz3",
            database="plex",
            port=int(port),
            charset="latin1",
            connect_timeout=5,
            cursorclass=pymysql.cursors.DictCursor
        )
        # Forzar decodificación iso-8859-1 para evitar errores con caracteres especiales/acentos
        conn.encoding = 'iso-8859-1'
        
        log(f"Conexión establecida con MySQL '{host}:{port}/plex'.", "SUCCESS")
        
        where_clause = "WHERE S.Cantidad > 0" if only_positive_stock else ""
        
        query = f"""
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
            {where_clause}
            GROUP BY P.IDProducto
            ORDER BY P.IDProducto ASC
        """
        
        with conn.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
            
        elapsed = time.time() - t0
        conn.close()
        
        log(f"Total productos obtenidos de MySQL: {len(rows):,} en {elapsed:.2f}s", "SUCCESS")
        
        # Mapear a formato estandarizado
        productos_parsed = []
        for r in rows:
            cbs = []
            if r["CodigoPrincipal"]: cbs.append(str(r["CodigoPrincipal"]).strip())
            if r["CodigosBarraAlternativos"]:
                for cb in r["CodigosBarraAlternativos"].split(","):
                    cbs.append(cb.strip())
                    
            productos_parsed.append({
                "idproducto": str(r["IDProducto"]),
                "troquel": str(r["Troquel"] or ""),
                "producto": str(r["DescripcionCompleta"] or ""),
                "stock": str(r["CantidadStock"] if r["CantidadStock"] is not None else 0),
                "unidades": str(r["UnidadesStock"] if r["UnidadesStock"] is not None else 0),
                "minimo": str(r["Minimo"] if r["Minimo"] is not None else 0),
                "maximo": str(r["Maximo"] if r["Maximo"] is not None else 0),
                "rubro": str(r["Rubro"] or ""),
                "laboratorio": str(r["Laboratorio"] or ""),
                "precio": str(r["PrecioVenta"] if r["PrecioVenta"] is not None else 0),
                "fechaultimoprecio": str(r["FechaUltimoPrecio"] or ""),
                "costo": str(r["Costo"] if r["Costo"] is not None else 0),
                "activo": str(r["Activo"] or "S"),
                "codebars": list(set(cbs))
            })
            
        if productos_parsed:
            save_products_to_storage(productos_parsed, origen="MYSQL_DIRECTO")
            log("Muestra de los primeros 3 productos importados:", "INFO")
            for i, p in enumerate(productos_parsed[:3]):
                log(f"  [{i+1}] ID: {p['idproducto']} | Troquel: {p['troquel']} | {p['producto']} | Stock: {p['stock']} u. | ${p['precio']}", "DATA")
            
    except Exception as e:
        log(f"Error en consulta MySQL: {e}", "ERROR")

# -------------------------------------------------------------
# 2. CAPTURA VÍA SOCKET TCP EN VIVO (GET_PRODUCTOS)
# -------------------------------------------------------------
def fetch_and_save_catalog_socket(host, port=3144, timeout=60.0):
    log("=================================================================", "INFO")
    log(f"Iniciando captura de Stock vía Socket TCP ({host}:{port})...", "INFO")
    
    request_payload = {
        "request": {
            "type": "GET_PRODUCTOS",
            "content": {
                "soloenstock": "N",
                "codrubro": "0",
                "codlab": "0",
                "desdeletra": "A",
                "hastaletra": "Z",
                "inactivos": "S",
                "incluirinactivos": "S",
                "bajas": "S",
                "incluirbajas": "S",
                "ocultos": "S",
                "activos": "T",
                "estado": "T",
                "todos": "S"
            }
        }
    }
    
    raw_frame = f"<JN>{json.dumps(request_payload)}\r\n".encode("utf-8")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    
    try:
        t0 = time.time()
        s.connect((host, int(port)))
        log(f"Conectado a Plex por socket. Solicitando stream...", "INFO")
        s.sendall(raw_frame)
        
        chunks = []
        bytes_received = 0
        while True:
            try:
                chunk = s.recv(65536)
                if not chunk: break
                chunks.append(chunk)
                bytes_received += len(chunk)
            except socket.timeout:
                break
        
        elapsed = time.time() - t0
        s.close()
        
        if bytes_received == 0:
            log("El servidor devolvió 0 bytes.", "WARN")
            return
            
        full_data = b"".join(chunks)
        mb = bytes_received / (1024.0 * 1024.0)
        log(f"Descarga completa: {bytes_received:,} bytes ({mb:.2f} MB) en {elapsed:.2f}s", "SUCCESS")
        
        text = full_data.decode("utf-8", errors="ignore")
        start_idx = text.find("{")
        end_idx = text.rfind("}")
        
        if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
            data = json.loads(text[start_idx:end_idx+1])
            productos = data.get("response", {}).get("content", {}).get("productos", [])
            log(f"Total productos recibidos de Plex: {len(productos):,}", "SUCCESS")
            
            if productos:
                save_products_to_storage(productos, origen="SOCKET_TCP")
        else:
            log("No se detectó un JSON completo en la respuesta.", "ERROR")
    except Exception as e:
        log(f"Error en socket TCP: {e}", "ERROR")

# -------------------------------------------------------------
# 3. CAPTURA VÍA ARCHIVO EXCEL OFICIAL DE PLEX (17 COLUMNAS)
# -------------------------------------------------------------
def import_excel_listado_stock():
    log("=================================================================", "INFO")
    print("\n--- IMPORTADOR DE LISTADO DE STOCK PLEX (EXCEL 17 COLUMNAS) ---")
    
    file_path = input("👉 Ingrese ruta completa o nombre del archivo Excel (.csv o .xlsx): ").strip()
    if not file_path: return
    file_path = file_path.replace('"', '').replace("'", "")
    
    if not os.path.exists(file_path):
        log(f"Archivo no encontrado: {file_path}", "ERROR")
        return

    log(f"Procesando archivo: {file_path}...", "INFO")
    productos_parsed = []
    
    try:
        if file_path.lower().endswith(".csv"):
            with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
                first_line = f.readline()
                delimiter = ";" if ";" in first_line else ("," if "," in first_line else "\t")
                f.seek(0)
                reader = csv.reader(f, delimiter=delimiter)
                for row in reader:
                    if not row or len(row) < 3: continue
                    p = map_17_columns_row(row)
                    if p: productos_parsed.append(p)
        elif file_path.lower().endswith((".xlsx", ".xls")):
            import openpyxl
            wb = openpyxl.load_workbook(file_path, data_only=True)
            sheet = wb.active
            for row in list(sheet.iter_rows(values_only=True))[1:]:
                if row:
                    p = map_17_columns_row(list(row))
                    if p: productos_parsed.append(p)

        log(f"Total registros leídos del Excel de Plex: {len(productos_parsed):,}", "SUCCESS")
        if productos_parsed:
            save_products_to_storage(productos_parsed, origen="EXCEL_LISTADO_STOCK")
    except Exception as e:
        log(f"Error procesando archivo Excel: {e}", "ERROR")

def map_17_columns_row(row):
    while len(row) < 17: row.append("")
    idprod = str(row[0] if row[0] is not None else "").strip()
    if not idprod or idprod.lower() in ("idproducto", "id", "codigo"): return None
    return {
        "idproducto": idprod,
        "troquel": str(row[1] if row[1] is not None else "").strip(),
        "codebar": str(row[2] if row[2] is not None else "").strip(),
        "producto": str(row[3] if row[3] is not None else "").strip(),
        "cantidad": str(row[4] if row[4] is not None else "").strip(),
        "unidades": str(row[5] if row[5] is not None else "").strip(),
        "minimo": str(row[6] if row[6] is not None else "").strip(),
        "maximo": str(row[7] if row[7] is not None else "").strip(),
        "grupo": str(row[8] if row[8] is not None else "").strip(),
        "rubro": str(row[9] if row[9] is not None else "").strip(),
        "precio": str(row[10] if row[10] is not None else "").strip(),
        "fechaultimoprecio": str(row[11] if row[11] is not None else "").strip(),
        "costo": str(row[12] if row[12] is not None else "").strip(),
        "unidadesprod": str(row[13] if row[13] is not None else "").strip(),
        "laboratorio": str(row[14] if row[14] is not None else "").strip(),
        "idlaboratorio": str(row[15] if row[15] is not None else "").strip(),
        "codigosbarra": str(row[16] if row[16] is not None else "").strip()
    }

# -------------------------------------------------------------
# 4. ALMACENAMIENTO UNIFICADO EN SQLITE, CSV Y JSON
# -------------------------------------------------------------
def save_products_to_storage(productos, origen="DESCONOCIDO"):
    init_sqlite_db()
    conn = sqlite3.connect(SQLITE_EXPORT_FILE)
    cursor = conn.cursor()
    
    prod_rows = []
    cb_rows = []
    
    for p in productos:
        cod = str(p.get("codproducto") or p.get("idproducto") or "").strip()
        if not cod: continue
        
        troq = str(p.get("troquel") or "").strip()
        nom = str(p.get("producto") or p.get("descripcion") or "").strip()
        stk = str(p.get("stock") if p.get("stock") is not None else p.get("cantidad") or "").strip()
        uni = str(p.get("unidades") or "").strip()
        mini = str(p.get("minimo") or "").strip()
        maxi = str(p.get("maximo") or "").strip()
        grp = str(p.get("grupo") or "").strip()
        rub = str(p.get("rubro") or "").strip()
        prc = str(p.get("precio") or "").strip()
        f_prc = str(p.get("fechaultimoprecio") or p.get("fecha_precio") or "").strip()
        cst = str(p.get("costo") or "").strip()
        u_prd = str(p.get("unidadesprod") or "").strip()
        lab = str(p.get("laboratorio") or "").strip()
        id_lab = str(p.get("idlaboratorio") or "").strip()
        
        prod_rows.append((cod, troq, nom, stk, uni, mini, maxi, grp, rub, prc, f_prc, cst, u_prd, lab, id_lab, origen, json.dumps(p, ensure_ascii=False)))
        
        cbs_candidates = []
        if p.get("codebars"): cbs_candidates.append(p["codebars"])
        if p.get("codebar"): cbs_candidates.append(p["codebar"])
        if p.get("codbarra"): cbs_candidates.append(p["codbarra"])
        if p.get("codigosbarra"): cbs_candidates.append(p["codigosbarra"])
        
        for cand in cbs_candidates:
            if isinstance(cand, list):
                for item in cand:
                    cb_s = str(item).strip()
                    if cb_s: cb_rows.append((cb_s, cod))
            elif isinstance(cand, str):
                for item in cand.split(","):
                    cb_s = item.strip()
                    if cb_s: cb_rows.append((cb_s, cod))

    cursor.executemany("""
        INSERT OR REPLACE INTO productos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, prod_rows)
    cursor.executemany("INSERT OR IGNORE INTO codigos_barra VALUES (?, ?)", cb_rows)
    conn.commit()
    conn.close()
    
    try:
        with open(JSON_EXPORT_FILE, "w", encoding="utf-8") as f:
            json.dump(productos, f, ensure_ascii=False, indent=2)
    except: pass
    
    log(f"Base consolidada guardada en: {SQLITE_EXPORT_FILE}", "SUCCESS")

# -------------------------------------------------------------
# 5. BUSCADOR / ESCÁNER EN TIEMPO REAL
# -------------------------------------------------------------
def search_products_local():
    if not os.path.exists(SQLITE_EXPORT_FILE):
        print("\n⚠️ Base de datos no encontrada. Primero captura datos vía MySQL, Socket o Excel.")
        return

    conn = sqlite3.connect(SQLITE_EXPORT_FILE)
    cursor = conn.cursor()
    
    print("\n=================================================================")
    print("      BUSCADOR & ESCÁNER INTEGRADO (EAN / TROQUEL / ID / NOMBRE)")
    print("=================================================================")
    print("Escanea con lector físico o escribe un código/nombre. ('q' para salir)\n")
    
    while True:
        query = input("🔍 Escanear / Buscar: ").strip()
        if not query or query.lower() == 'q':
            break
            
        cursor.execute("""
            SELECT p.idproducto, p.troquel, p.descripcion, p.stock, p.precio, p.laboratorio, p.rubro, cb.codbarra, p.origen
            FROM codigos_barra cb 
            JOIN productos p ON p.idproducto = cb.idproducto 
            WHERE cb.codbarra = ?
        """, (query,))
        results = cursor.fetchall()
        
        if not results:
            cursor.execute("""
                SELECT idproducto, troquel, descripcion, stock, precio, laboratorio, rubro, '', origen 
                FROM productos 
                WHERE idproducto = ? OR troquel = ?
            """, (query, query))
            results = cursor.fetchall()
            
        if not results:
            cursor.execute("""
                SELECT idproducto, troquel, descripcion, stock, precio, laboratorio, rubro, '', origen 
                FROM productos 
                WHERE descripcion LIKE ? LIMIT 10
            """, (f"%{query}%",))
            results = cursor.fetchall()
            
        if results:
            print(f"\n✅ {len(results)} resultado(s) encontrado(s):")
            for idx, r in enumerate(results, 1):
                stk = r[3] if r[3] != "" else "0"
                prc = f" | Precio: ${r[4]}" if r[4] else ""
                trq = f" | Troquel: {r[1]}" if r[1] else ""
                lab = f" | Lab: {r[5]}" if r[5] else ""
                cb = f" | EAN: {r[7]}" if r[7] else ""
                print(f"  [{idx}] ID: {r[0]}{trq} | Stock: {stk}{prc}{lab}")
                print(f"      Nombre: {r[2]}{cb} (Origen: {r[8]})")
            print()
        else:
            print(f"❌ No se encontró ningún producto con: '{query}'\n")
            
    conn.close()

# -------------------------------------------------------------
# MENÚ PRINCIPAL
# -------------------------------------------------------------
def main():
    print("""
====================================================================
      PLEX ADVANCED STOCK & PROTOCOL TESTER CLI (SUITE COMPLETA)
====================================================================
""")
    default_host = "10.0.48.10"
    host = default_host

    while True:
        print(f"\n--- SERVIDOR CONFIGURADO: {host} ---")
        print("1. [DIRECTO MYSQL] Sincronizar Stock Oficial desde Base de Datos MySQL (Plex)")
        print("2. [SOCKET TCP] Descargar Stock vía Socket TCP (Puerto 3144)")
        print("3. [EXCEL OFICIAL] Importar Listado de Stock Plex (17 Columnas)")
        print("4. [ESCANER / BUSCADOR] Buscar o Escanear Códigos de Barra en Tiempo Real")
        print("5. [CONFIG] Cambiar IP del Servidor")
        print("6. Salir")
        
        choice = input("\nSeleccione una opción (1-6): ").strip()
        
        if choice == "1":
            fetch_from_mysql(host=host, port=3306, only_positive_stock=False)
        elif choice == "2":
            fetch_and_save_catalog_socket(host=host, port=3144)
        elif choice == "3":
            import_excel_listado_stock()
        elif choice == "4":
            search_products_local()
        elif choice == "5":
            host = input(f"Nueva IP / Host [{host}]: ").strip() or host
        elif choice == "6" or choice.lower() in ("q", "exit"):
            print("\n¡Pruebas finalizadas con éxito!")
            break
        else:
            print("Opción inválida.")

if __name__ == "__main__":
    main()

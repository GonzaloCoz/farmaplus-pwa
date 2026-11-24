"""
Sincronizador solo-lectura de Interfarmacias: onze_center (MySQL) -> Supabase (PostgREST).
Lee los envios del mes actual (o desde --desde YYYY-MM-DD) y los sube por upsert a:
  - public.interfarmacias_envios
  - public.interfarmacias_lineas

Uso:
  set SUPABASE_SERVICE_ROLE_KEY=eyJ...
  python sincronizar_interfarmacias.py
  python sincronizar_interfarmacias.py --desde 2026-11-01
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

import pymysql

ACE_HOST = os.getenv("PLEX_ACE_HOST", "172.30.40.62")
ACE_PORT = int(os.getenv("PLEX_ACE_PORT", "3306"))
ACE_USER = os.getenv("PLEX_ACE_USER", "root")
ACE_PASS = os.getenv("PLEX_ACE_PASS", "").strip()
ACE_DB = os.getenv("PLEX_ACE_DB", "onze_center")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://supabase.halu.com.ar").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

TZ_AR = "-03:00"
BATCH_SIZE = 400


def clean_branch_name(raw: str | None, suc_id: int) -> str:
    if not raw:
        return f"Sucursal #{suc_id}"
    s = re.sub(r"^(?:Z\s+)?(?:BS\s+AS|GBA|INT)\s*-\s*", "", raw.strip(), flags=re.I)
    # Normaliza capitalizacion preservando numeros romanos
    words = []
    for w in s.split():
        if re.fullmatch(r"[IVX]+", w, flags=re.I):
            words.append(w.upper())
        elif w.lower() in ("de", "del", "la", "las", "los", "y"):
            words.append(w.lower())
        else:
            words.append(w.capitalize())
    return " ".join(words) or f"Sucursal #{suc_id}"


def fmt_ts(fecha: dt.date | None, hora: dt.timedelta | None) -> str | None:
    if not fecha:
        return None
    secs = int(hora.total_seconds()) if isinstance(hora, dt.timedelta) else 0
    hh, rem = divmod(max(0, secs) % 86400, 3600)
    mm, ss = divmod(rem, 60)
    return f"{fecha.isoformat()}T{hh:02d}:{mm:02d}:{ss:02d}{TZ_AR}"


def supabase_upsert(table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        req = urllib.request.Request(
            url,
            data=json.dumps(chunk, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status not in (200, 201, 204):
                    raise RuntimeError(f"HTTP {resp.status} en {table}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Error Supabase {table} (HTTP {e.code}): {body}") from e


def fetch_audited_ids(desde_iso: str) -> set[int]:
    """Lee que envios ya fueron marcados como auditados en Supabase para no pisar su estado."""
    url = (
        f"{SUPABASE_URL}/rest/v1/interfarmacias_envios"
        f"?select=id_envio_global&auditado=eq.true&fecha_envio=gte.{desde_iso}"
    )
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {int(r["id_envio_global"]) for r in data}
    except Exception:
        return set()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincroniza interfarmacias de onze_center a Supabase")
    today = dt.date.today()
    default_desde = today.replace(day=1).isoformat()
    parser.add_argument("--desde", default=default_desde, help="Fecha inicio YYYY-MM-DD (default: 1ro del mes)")
    parser.add_argument("--dry-run", action="store_true", help="Solo consulta MySQL y muestra resumen sin subir")
    args = parser.parse_args()

    if not args.dry_run and not SUPABASE_SERVICE_KEY:
        print("ERROR: falta definir SUPABASE_SERVICE_ROLE_KEY en el entorno.", file=sys.stderr)
        return 1

    print(f"[1/3] Conectando a onze_center ({ACE_HOST}) desde {args.desde}...")
    conn = pymysql.connect(
        host=ACE_HOST,
        port=ACE_PORT,
        user=ACE_USER,
        password=ACE_PASS,
        database=ACE_DB,
        charset="latin1",
        connect_timeout=8,
        read_timeout=60,
    )
    conn.encoding = "iso-8859-1"
    cur = conn.cursor(pymysql.cursors.DictCursor)

    cur.execute(
        """
        SELECT e.IDEnvio, e.IDEnvioGlobal, e.FechaEnvio, e.HoraEnvio,
               e.FechaRecepcion, e.HoraRecepcion, e.Descripcion,
               e.SucOrigen, so.NombreFantasia AS OrigenNom,
               e.SucDestino, sd.NombreFantasia AS DestinoNom,
               e.IDEstado,
               oe.Operador AS OperEnvio,
               orx.Operador AS OperRecep
        FROM envios e
        LEFT JOIN sucursales so ON so.Sucursal = e.SucOrigen
        LEFT JOIN sucursales sd ON sd.Sucursal = e.SucDestino
        LEFT JOIN operadores oe ON oe.IDOperador = e.IDOperador
        LEFT JOIN operadores orx ON orx.IDOperador = e.IDOperadorRecepcion
        WHERE e.FechaEnvio >= %s
        ORDER BY e.FechaEnvio DESC, e.IDEnvio DESC
        """,
        (args.desde,),
    )
    envios_raw = list(cur.fetchall())

    cur.execute(
        """
        SELECT el.IDEnvio, e.IDEnvioGlobal, el.Orden, el.IDProducto,
               COALESCE(m.codebar, '') AS EAN,
               TRIM(CONCAT(COALESCE(m.Producto, ''), ' ', COALESCE(m.Presentaci, ''))) AS Producto,
               COALESCE(l.Laborato, '') AS Laboratorio,
               COALESCE(r.Rubro, '') AS Rubro,
               COALESCE(el.Cantidad, 0) AS CantEnv,
               el.CantidadRecibida AS CantRec,
               COALESCE(el.CostoPPP, 0) AS CostoPPP,
               el.LoteVto, el.LoteFechaVto
        FROM envioslineas el
        JOIN envios e ON e.IDEnvio = el.IDEnvio
        LEFT JOIN medicamentos m ON m.CodPlex = el.IDProducto
        LEFT JOIN laboratorios l ON l.CodLab = m.CodLab
        LEFT JOIN rubros r ON r.CodRubro = m.CodRubro
        WHERE e.FechaEnvio >= %s
        ORDER BY e.IDEnvioGlobal, el.Orden
        """,
        (args.desde,),
    )
    lineas_raw = list(cur.fetchall())
    conn.close()

    print(f"[2/3] Leidos {len(envios_raw)} envios y {len(lineas_raw)} lineas desde onze_center.")

    # Agrupar lineas por IDEnvioGlobal para calcular totales y detectar diferencias
    by_envio: dict[int, list[dict[str, Any]]] = {}
    for ln in lineas_raw:
        eg = int(ln["IDEnvioGlobal"])
        by_envio.setdefault(eg, []).append(ln)

    audited_ids = set() if args.dry_run else fetch_audited_ids(f"{args.desde}T00:00:00{TZ_AR}")
    now_iso = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec="seconds")

    envios_payload: list[dict[str, Any]] = []
    lineas_payload: list[dict[str, Any]] = []

    for e in envios_raw:
        eg = int(e["IDEnvioGlobal"])
        lines = by_envio.get(eg, [])
        id_est = int(e["IDEstado"] or 9)
        tot_env = sum(float(x["CantEnv"] or 0) for x in lines)
        tot_rec = (
            None
            if id_est != 10
            else sum(float(x["CantRec"] or 0) for x in lines)
        )
        has_diff = id_est == 10 and any(
            float(x["CantRec"] or 0) != float(x["CantEnv"] or 0) for x in lines
        )

        if eg in audited_ids:
            estado = "Auditado"
        elif id_est == 11:
            estado = "Anulado"
        elif id_est == 9:
            estado = "En tránsito"
        elif has_diff:
            estado = "Con diferencia"
        else:
            estado = "Recibido"

        envios_payload.append(
            {
                "id_envio_global": eg,
                "id_envio": int(e["IDEnvio"]),
                "suc_origen_id": int(e["SucOrigen"] or 0),
                "suc_origen_nombre": clean_branch_name(e["OrigenNom"], int(e["SucOrigen"] or 0)),
                "suc_destino_id": int(e["SucDestino"] or 0),
                "suc_destino_nombre": clean_branch_name(e["DestinoNom"], int(e["SucDestino"] or 0)),
                "fecha_envio": fmt_ts(e["FechaEnvio"], e["HoraEnvio"]),
                "fecha_recepcion": fmt_ts(e["FechaRecepcion"], e["HoraRecepcion"]),
                "id_estado_plex": id_est,
                "estado": estado,
                "total_skus": len(lines),
                "unidades_enviadas": round(tot_env, 2),
                "unidades_recibidas": round(tot_rec, 2) if tot_rec is not None else None,
                "operador_envio": (e["OperEnvio"] or "").strip() or None,
                "operador_recepcion": (e["OperRecep"] or "").strip() or None,
                "descripcion": (e["Descripcion"] or "").strip() or None,
                "sincronizado_en": now_iso,
            }
        )

        for x in lines:
            vto = x["LoteFechaVto"]
            lineas_payload.append(
                {
                    "id_envio_global": eg,
                    "orden": int(x["Orden"] or 0),
                    "id_producto": int(x["IDProducto"]),
                    "ean": (x["EAN"] or "").strip(),
                    "producto": (x["Producto"] or f"Producto #{x['IDProducto']}").strip(),
                    "laboratorio": (x["Laboratorio"] or "").strip(),
                    "rubro": (x["Rubro"] or "").strip(),
                    "cantidad_enviada": round(float(x["CantEnv"] or 0), 2),
                    "cantidad_recibida": round(float(x["CantRec"] or 0), 2) if id_est == 10 else None,
                    "costo_ppp": round(float(x["CostoPPP"] or 0), 2),
                    "lote_vto": (x["LoteVto"] or "").strip() or None,
                    "lote_fecha_vto": vto.isoformat() if isinstance(vto, dt.date) else None,
                }
            )

    if args.dry_run:
        print(f"[DRY-RUN] Listos {len(envios_payload)} envios y {len(lineas_payload)} lineas.")
        if envios_payload:
            print("Ejemplo envio:", json.dumps(envios_payload[0], ensure_ascii=False))
        return 0

    print(f"[3/3] Subiendo {len(envios_payload)} envios y {len(lineas_payload)} lineas a {SUPABASE_URL}...")
    supabase_upsert("interfarmacias_envios", envios_payload, "id_envio_global")
    supabase_upsert("interfarmacias_lineas", lineas_payload, "id_envio_global,id_producto,orden")
    print("Sincronizacion completada con exito.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

---
trigger: always_on
---

# Constitución de Arquitectura — MiPlus

Estas reglas son leyes innegociables para todo diseño, módulo o línea de código en `C:\Proyectos\MiPlus`.

## 0. Frontera Absoluta con Producción (Intocable)
- **Prohibido modificar `C:\Proyectos\Farmaplus`:** Ese repositorio es únicamente archivo de lectura/consulta histórica. Cero ediciones, borrados o scripts ejecutados allí.
- **Prohibido tocar Supabase o Oracle en producción (`supabase.halu.com.ar` / `ubuntu@vnic-halu`):** Cero migraciones remotas, cero `db push`, cero escrituras SQL en vivo salvo orden explícita y verificada del usuario.

## 1. Ley de Nomenclatura, Idioma y Discreción Operativa
- **100% Español de Farmacia en `nucleo/` y `servidor/`:** Crates, archivos Rust, tablas SQL, structs, funciones y comandos del núcleo se nombran en español neutro sin tildes ni `ñ`. En `interfaz/src/`, se conservan los nombres originales de componentes, íconos, gráficos y páginas migrados desde `Farmaplus` por decisión expresa del usuario.
- **Sustantivo Único (Cero Versiones / Cero Adjetivos):** Prohibidos sufijos o prefijos como `_v2`, `nuevo_`, `rapido_`, `mejorado_`, `inteligente_`, `temp_`, `backup_` o `fix_`. Un concepto = un archivo canónico.
- **Discreción Operativa (OpSec):** Prohibido nombrar archivos, crates o artefactos con palabras que delaten secretos o mecanismos críticos (`crypto`, `vault`, `key`, `secret`, `bypass`, `token`).
  - Usar nombres neutros de plomería: `trama` (serialización/firmas/sellado), `reglas` (alcances y permisos), `almacen` (persistencia), `enlace` (conector local de sucursal).
  - En disco (`%LOCALAPPDATA%\MiPlus\`): solo nombres opacos (`indice.dat`, `perfil.cfg`, `bloques/*.pak`).

## 2. Topología Windows Desktop-First (90% Rust / 10% Interfaz)
- **Núcleo en Rust (`nucleo/`):** Toda regla farmacéutica (Padre-Hijo, trazables ANMAT GS1, libro mayor, ajustes en sucursal, reportes Excel/PDF y sincronización) vive en crates Rust independientes.
- **Interfaz Delgada (`interfaz/`):** React + Tailwind v4 dibuja únicamente filas visibles y captura teclado/escáner.
- **Prohibido en TypeScript/React:**
  - Cero lógica contable, parseo de planillas, compresión o reglas de negocio.
  - Cero bases en navegador (`Dexie`, `IndexedDB`, `localStorage` para datos o colas).
  - Cero listas masivas (> 500 ítems) en memoria JS; toda consulta es paginada por IPC (< 16 ms).

## 3. Presupuesto de Hardware y Rendimiento
- Mantener la ejecución ágil en equipos de mostrador operando simultáneamente Windows + `PlexOnze.exe` + MySQL:
  - SQLite WAL con `PRAGMA cache_size = -32000;`, `PRAGMA temp_store = MEMORY;` y streaming `zstd` en bloques de `64 KB`.
  - Al cerrar o minimizar la ventana principal, ocultar en la bandeja del sistema (*System Tray*) para mantener vivo el concentrador LAN y el monitor local.

## 4. Seguridad y Criptografía Nativa
- **En reposo:** SQLCipher AES-256 en `almacen` (`indice.dat` cifrado desde el byte 0). Prohibido SQLite en texto plano.
- **Sellado local:** Claves y datos de conexión local protegidos con **Windows DPAPI** (`CryptProtectData`). Cero credenciales o IPs privadas en JS ni RPCs que devuelvan claves.
- **Primitivas:** `aws-lc-rs`, `blake3` y firmas `Ed25519`. Verificar firma antes de descomprimir o aplicar paquetes/actualizaciones.
- **IPC y Políticas:** `csp` estricta obligatoria (prohibido `null` y `--ignore-certificate-errors`). Prohibido exponer SQL crudo al WebView; todo comando mutante evalúa `reglas` (`cedar-policy`) y verifica sesión activa local antes de impactar stock.

## 5. Los 5 Pilares Distribuidos (71 Sucursales + Servidor)
1. **Estabilidad Estática:** El plano local de cada farmacia opera 100% offline sin degradación cuando cae internet. Prohibidos fallbacks dinámicos no probados (ej. clientes demo).
2. **Aislamiento Celular (`sucursal_id`):** Cada farmacia es una célula estanca en almacenamiento local, políticas, RLS, prefijos S3 y límites de tráfico (`1/71`).
3. **Bandeja Transaccional + Saga + Idempotencia:** Mutación local + `libro_mayor` (*append-only* encadenado con `BLAKE3`) + `bandeja_salida` en un único `COMMIT` local, con registro de intención previo a mutar el ERP local e identificador único (`UUIDv7`) en todo envío.
4. **Espera Exponencial + Desfasaje Aleatorio (*Full Jitter*):** Prohibidos los intervalos fijos hacia el servidor; aplicar `rand(0, min(techo, base * 2^intento))`.
5. **Anti-Entropía Merkle (`BLAKE3`):** Prohibido guardar archivos Base64 o JSON gigantes en PostgreSQL. Los paquetes binarios y archivos fríos van a Object Storage S3 (+ caché LAN en la sucursal para colectoras).

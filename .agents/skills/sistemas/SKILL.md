---
name: sistemas
description: >-
  Guía de diseño y auditoría de sistemas distribuidos para MiPlus (Windows Desktop-First en Rust +
  71 sucursales + servidor Linux), destilada de la Amazon Builders' Library y Well-Architected Review
  sin servicios propietarios de AWS. Activar al diseñar, implementar o revisar crates del núcleo
  (`trama`, `almacen`, `reglas`, `enlace`, `sincronia`, `ciclicos`, `colector`, `vencimientos`),
  esquemas SQL, presupuesto de 4 GB RAM (Retiro) o el servicio de borde en Oracle Cloud (`Pingora`).
  No usar para plantillas CloudFormation, Lambda, IAM cloud ni SDKs propietarios de AWS.
---

# Filosofía de Sistemas y Revisión Técnica — MiPlus

Esta guía aplica ingeniería de alta confiabilidad sobre el stack nativo de MiPlus (`nucleo/` en Rust + `interfaz/` en React + `servidor/` en Oracle Cloud).

## 1. Modos de Trabajo
- **Diseño:** Antes de escribir un crate o migración SQL, validar que cumple los 7 controles (`MP-*`).
- **Revisión Rápida:** Auditar un módulo o diff contra los disparadores críticos (`ALTO`) citando `archivo:línea`.
- **Auditoría Completa:** Congelar lectura de archivos reales (`Cargo.toml`, `escritorio/tauri.conf.json`, crates, SQL) -> Evaluar `MP-*` -> Clasificar riesgo -> Ordenar remediación (Hacer Ahora / Planificar / Delegar / Posponer).

## 2. Lista de Control (`MP-*`)

### A. `MP-ESTAB` — Estabilidad Estática (Plano Local vs Plano Central)
- ¿Opera la sucursal al 100% (escaneo, Padre-Hijo, trazables ANMAT, ajustes locales) con `0%` de red hacia el servidor central?
- ¿Se eliminaron todos los fallbacks dinámicos peligrosos (clientes demo o bases paralelas en navegador)?

### B. `MP-CELDA` — Arquitectura Celular (71 Sucursales)
- ¿Está toda operación particionada explícitamente por `sucursal_id` en SQLCipher, `reglas` (Cedar), RLS PostgreSQL, prefijos S3 (`celdas/{sucursal_id}/`) y límites de Pingora?

### C. `MP-BANDEJA` — Bandeja Transaccional, Libro Mayor e Idempotencia
- ¿Se graban estado de negocio, asiento en `libro_mayor` (inmutable encadenado con `BLAKE3`) y mensaje en `bandeja_salida` dentro de una sola transacción ACID?
- ¿Registra el crate `enlace` un intento previo en SQLCipher antes de tocar el MySQL local (ej. bypass temporal de trazables o ajustes en 5 tablas) para recuperar cortes de luz?
- ¿Lleva cada mutación remota un `clave_idempotencia` (`UUIDv7`) verificado en destino?

### D. `MP-JITTER` — Espera Exponencial con Desfasaje Aleatorio y Protección del VPS
- ¿Aplica `sincronia` *Full Jitter* (`rand(0, min(techo, base * 2^n))`) y presupuesto de reintentos acotado para evitar estampidas de las 71 sucursales?
- ¿Protege el servicio de borde (`Pingora`) a PostgreSQL con límites por `sucursal_id` y corte de carga temprano (*load shedding*)?

### E. `MP-MERKLE` — Paquetes Binarios e Higiene de Datos
- ¿Se eliminó todo blob Base64 o JSON gigante de PostgreSQL y Realtime, delegando binarios (`.pak` / `.parquet`) a Object Storage S3 y distribución LAN en sucursal?
- ¿Compara `sincronia` raíces/ramas `BLAKE3` para descargar solo deltas modificados?

### F. `MP-MEM4G` — Presupuesto 4 GB RAM (Regla Sucursal Retiro)
- ¿Se mantiene el Working Set combinado `<= 180 MB` (`nucleo <= 60 MB`, `WebView2 <= 120 MB`) mediante `PRAGMA` austeros, streaming `zstd` de `64 KB`, paginación IPC y perfil visual `Liviano`?

### G. `MP-SEG` — Criptografía Nativa y Discreción
- ¿Están los datos locales en SQLCipher AES-256 con clave sellada en Windows DPAPI?
- ¿Verifica `trama` firmas `Ed25519` (`aws-lc-rs`) antes de descomprimir, evalúa `reglas` (`cedar-policy`) en comandos críticos, mantiene `csp` estricta y revoca `anon` en PostgreSQL?

## 3. Criterio de Bloqueo
Todo hallazgo `ALTO` (duplicación de ajustes en sucursal, pérdida de trazable, bloqueo por caída de red, fuga entre sucursales, secreto en JS/texto plano, `csp: null`, `GRANT anon` o consumo `> 180 MB` en perfil 4 GB) bloquea el avance hasta corregirse.

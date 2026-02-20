-- ==========================================
-- Script manual: corregir progreso en branch_laboratories
-- Ejecutar en Supabase SQL Editor si hay 100% falsos
-- ==========================================
-- Primero ejecuta la migración 20260220_recompute_lab_progress.sql
-- para crear la función, luego ejecuta una de las opciones abajo.

-- Opción A: Para un lab específico
-- SELECT recompute_lab_progress('TU_SUCURSAL', 'ALCON');

-- Opción B: Para TODOS los labs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT branch_name, laboratory 
    FROM public.branch_laboratories
  LOOP
    PERFORM recompute_lab_progress(r.branch_name, r.laboratory);
    RAISE NOTICE 'Recalculado: % - %', r.branch_name, r.laboratory;
  END LOOP;
END $$;

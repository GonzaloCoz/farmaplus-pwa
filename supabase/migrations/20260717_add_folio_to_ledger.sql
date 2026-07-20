-- Migration: Add round and folio to inventory_ledger and auto-generate folio
-- Date: 2026-07-17
-- Purpose: Support professional sequential Folios (e.g. HV01A0001) for inventory adjustments.

-- 1. Agregar las columnas si no existen
ALTER TABLE public.inventory_ledger 
ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS folio TEXT;

-- 2. Asignar Folios retroactivos a los registros existentes (que están en ronda 1)
DO $$
DECLARE
  r RECORD;
  v_seq INTEGER := 1;
BEGIN
  FOR r IN 
    SELECT id 
    FROM public.inventory_ledger 
    ORDER BY created_at ASC 
  LOOP
    UPDATE public.inventory_ledger 
    SET folio = 'HV01A' || TO_CHAR(v_seq, 'FM0000')
    WHERE id = r.id;
    v_seq := v_seq + 1;
  END LOOP;
END $$;

-- 3. Hacer que la columna folio sea UNIQUE
ALTER TABLE public.inventory_ledger 
ADD CONSTRAINT inventory_ledger_folio_unique UNIQUE (folio);

-- 4. Crear la función del Trigger para generar Folios automáticamente en nuevos registros
CREATE OR REPLACE FUNCTION public.generate_ledger_folio()
RETURNS TRIGGER AS $$
DECLARE
  v_seq_num INTEGER;
  v_round_str TEXT;
  v_prefix TEXT;
BEGIN
  -- Si no se especifica la ronda, por defecto es 1
  IF NEW.round IS NULL THEN
    NEW.round := 1;
  END IF;
  
  -- Formato de la ronda: V01, V02...
  v_round_str := 'V' || TO_CHAR(NEW.round, 'FM00');
  v_prefix := 'H' || v_round_str || 'A';
  
  -- Obtener el siguiente número de secuencia global para esa ronda
  SELECT COALESCE(
    MAX(SUBSTRING(folio FROM 7)::INTEGER), 
    0
  ) + 1
  INTO v_seq_num
  FROM public.inventory_ledger
  WHERE folio LIKE v_prefix || '%';
  
  -- Formatear ID final: HV01A0001
  NEW.folio := v_prefix || TO_CHAR(v_seq_num, 'FM0000');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear el Trigger
DROP TRIGGER IF EXISTS trg_generate_ledger_folio ON public.inventory_ledger;
CREATE TRIGGER trg_generate_ledger_folio
BEFORE INSERT ON public.inventory_ledger
FOR EACH ROW
EXECUTE FUNCTION public.generate_ledger_folio();

-- Otorgar permisos
GRANT ALL ON TABLE public.inventory_ledger TO anon, authenticated, service_role;

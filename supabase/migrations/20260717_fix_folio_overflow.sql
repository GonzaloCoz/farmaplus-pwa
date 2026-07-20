-- Migration: Fix folio overflow and clean up corrupted sequence numbers
-- Date: 2026-07-17
-- Purpose: 
--   1. Replace TO_CHAR(v_seq_num, 'FM0000') with LPAD(v_seq_num::text, 4, '0') to prevent '####' overflow.
--   2. Delete any corrupted test ledger records to restore the normal sequential sequence.

-- 1. Re-define trigger function with LPAD
CREATE OR REPLACE FUNCTION public.generate_ledger_folio()
RETURNS TRIGGER AS $$
DECLARE
  v_seq_num INTEGER;
  v_round_str TEXT;
  v_prefix TEXT;
BEGIN
  IF NEW.round IS NULL THEN
    NEW.round := 1;
  END IF;
  
  v_round_str := 'V' || TO_CHAR(NEW.round, 'FM00');
  v_prefix := 'H' || v_round_str || 'A';
  
  -- Obtener el siguiente número de secuencia global para esa ronda
  SELECT COALESCE(
    MAX(SUBSTRING(folio FROM 6)::INTEGER), 
    0
  ) + 1
  INTO v_seq_num
  FROM public.inventory_ledger
  WHERE folio LIKE v_prefix || '%';
  
  -- Formatear ID final: HV01A0001 (usando LPAD para evitar desbordamientos '####')
  NEW.folio := v_prefix || LPAD(v_seq_num::text, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up corrupted test ledger records to restore sequence health
-- Delete any rows containing '#' or with folio length longer than 9
DELETE FROM public.inventory_ledger_items 
WHERE ledger_id IN (
  SELECT id FROM public.inventory_ledger 
  WHERE folio LIKE '%#%' OR LENGTH(folio) > 9
);

DELETE FROM public.inventory_ledger 
WHERE folio LIKE '%#%' OR LENGTH(folio) > 9;

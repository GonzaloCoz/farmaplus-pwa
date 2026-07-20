-- Migration: Fix folio trigger substring index
-- Date: 2026-07-17
-- Purpose: Correct the substring index in generate_ledger_folio trigger function.
-- Since the prefix is 5 characters (e.g. 'HV01A'), the numeric sequence starts at index 6.
-- Using index 7 caused the first digit to be ignored once numbers reached 1000+, leading to sequence collisions.

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
  
  -- Obtener el siguiente número de secuencia global para esa ronda (empezando desde el carácter 6)
  SELECT COALESCE(
    MAX(SUBSTRING(folio FROM 6)::INTEGER), 
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

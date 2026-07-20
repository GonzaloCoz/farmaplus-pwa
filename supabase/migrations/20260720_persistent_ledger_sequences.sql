-- Migration: Create persistent ledger sequence table and update generate_ledger_folio trigger function
-- Date: 2026-07-20
-- Purpose: Prevent reuse of folios when laboratory history is reset/purged.

-- 1. Create table public.ledger_sequences
CREATE TABLE IF NOT EXISTS public.ledger_sequences (
    prefix TEXT PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0
);

-- 2. Initialize sequences from existing max values in inventory_ledger
INSERT INTO public.ledger_sequences (prefix, last_value)
SELECT 
    'H' || 'V' || LPAD(round::text, 2, '0') || 'A' AS prefix,
    COALESCE(MAX(SUBSTRING(folio FROM 6)::INTEGER), 0) AS last_value
FROM public.inventory_ledger
WHERE folio IS NOT NULL AND LENGTH(folio) >= 9
GROUP BY round
ON CONFLICT (prefix) DO UPDATE 
SET last_value = GREATEST(ledger_sequences.last_value, EXCLUDED.last_value);

-- 3. Redefine trigger function to fetch sequence atómically from public.ledger_sequences
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
  
  -- Increment and get sequence value atomically
  INSERT INTO public.ledger_sequences (prefix, last_value)
  VALUES (v_prefix, 1)
  ON CONFLICT (prefix) 
  DO UPDATE SET last_value = ledger_sequences.last_value + 1
  RETURNING last_value INTO v_seq_num;
  
  -- Format final ID: HV01A0001
  NEW.folio := v_prefix || LPAD(v_seq_num::text, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant table permissions
GRANT ALL ON TABLE public.ledger_sequences TO anon, authenticated, service_role;

-- Función RPC para guardar inventario cíclico de manera atómica y eficiente
-- Esta función reemplaza las múltiples llamadas de red desde el cliente

create or replace function save_cyclic_inventory(
  p_branch_name text,
  p_laboratory text,
  p_items jsonb
) returns void as $$
declare
  item jsonb;
begin
  -- Iterar sobre cada item recibido en el array JSON
  for item in select * from jsonb_array_elements(p_items)
  loop
    -------------------------------------------------------
    -- 1. Asegurar que el producto exista (Upsert ligero)
    -------------------------------------------------------
    -- Solo insertamos si no existe para evitar errores de Foreign Key en la tabla inventories
    insert into products (ean, name, cost, category, laboratory, created_at)
    values (
      item->>'ean',
      item->>'name',
      (item->>'cost')::numeric,
      item->>'category',
      p_laboratory, -- Asignamos el laboratorio actual si es un producto nuevo
      now()
    )
    on conflict (ean) do nothing; 
    -- IMPORTANTE: 'do nothing' es más rápido y seguro que update si solo queremos asegurar existencia.
    -- No sobrescribimos datos maestros de productos desde una carga de inventario parcial.

    -------------------------------------------------------
    -- 2. Guardar el inventario (Upsert)
    -------------------------------------------------------
    insert into inventories (
      branch_name, 
      laboratory, 
      ean, 
      quantity, 
      system_quantity, 
      status, 
      was_readjusted,
      updated_at
    )
    values (
      p_branch_name,
      p_laboratory,
      item->>'ean',
      (item->>'countedQuantity')::integer,
      (item->>'systemQuantity')::integer,
      item->>'status',
      (item->>'wasReadjusted')::boolean,
      now()
    )
    on conflict (branch_name, laboratory, ean) 
    do update set 
      quantity = excluded.quantity,
      system_quantity = excluded.system_quantity, -- Actualizar también system_quantity si cambió
      status = excluded.status,
      was_readjusted = excluded.was_readjusted,
      updated_at = now();
      
  end loop;
end;
$$ language plpgsql;

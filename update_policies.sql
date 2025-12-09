-- Update Policies to allow Public Access (For Testing/Migration Phase)

-- 1. Products: Allow public insert/update (temporarily)
drop policy if exists "Allow auth insert" on public.products;
drop policy if exists "Allow auth update" on public.products;

create policy "Allow public insert" on public.products for insert with check (true);
create policy "Allow public update" on public.products for update using (true);

-- 2. Inventories: Allow public insert/update/delete
drop policy if exists "Allow auth insert" on public.inventories;
drop policy if exists "Allow auth update" on public.inventories;

create policy "Allow public insert" on public.inventories for insert with check (true);
create policy "Allow public update" on public.inventories for update using (true);
create policy "Allow public delete" on public.inventories for delete using (true);

-- Note: In production, you should revert these to authenticated-only policies.

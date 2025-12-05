-- Enable Row Level Security (RLS) is good practice, but for starting we can keep it simple or configure policies.

-- 1. Create Products Table (Master List)
create table public.products (
  ean text primary key,
  name text not null,
  laboratory text,
  category text,
  cost numeric default 0,
  sale_price numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Products
-- Enable RLS for Products
alter table public.products enable row level security;
-- Allow everyone to read products (public catalog)
create policy "Allow public read access" on public.products for select using (true);

-- DEVELOPMENT POLICIES (Allow public write access for initial load/testing)
-- In production, replace these with authenticated-only policies.
drop policy if exists "Allow auth insert" on public.products;
drop policy if exists "Allow auth update" on public.products;
create policy "Allow public insert" on public.products for insert with check (true);
create policy "Allow public update" on public.products for update using (true);

-- 2. Create Inventories Table (Branch Data)
create table if not exists public.inventories (
  id uuid default gen_random_uuid() primary key,
  branch_name text not null, -- e.g., 'Belgrano', 'Palermo'
  ean text references public.products(ean),
  quantity integer not null default 0,
  status text default 'pending', -- 'pending', 'controlado'
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) -- Optional: link to who counted it
);

-- Enable RLS for Inventories
alter table public.inventories enable row level security;

-- Allow everyone to read inventories (for auditing)
create policy "Allow public read access" on public.inventories for select using (true);

-- DEVELOPMENT POLICIES (Allow public write access)
drop policy if exists "Allow auth insert" on public.inventories;
drop policy if exists "Allow auth update" on public.inventories;
create policy "Allow public insert" on public.inventories for insert with check (true);
create policy "Allow public update" on public.inventories for update using (true);
create policy "Allow public delete" on public.inventories for delete using (true);

-- 3. Create Storage Bucket for Images (Optional, for future)
insert into storage.buckets (id, name) values ('product-images', 'product-images') on conflict do nothing;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'product-images' );
create policy "Auth Upload" on storage.objects for insert with check ( bucket_id = 'product-images' and auth.role() = 'authenticated' );

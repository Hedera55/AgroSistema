-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 0. Profiles Table & Trigger (NEW!)
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  role text check (role in ('MASTER_ADMIN', 'ADMIN', 'CLIENT')) default 'CLIENT',
  assigned_clients jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles enable row level security;

-- Drop policies if exist to allow re-run
drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "Public profiles are viewable by everyone" on profiles for select using ( true );
create policy "Users can insert their own profile" on profiles for insert with check ( auth.uid() = id );
create policy "Users can update own profile" on profiles for update using ( auth.uid() = id );

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, assigned_clients)
  values (new.id, new.email, 'CLIENT', '[]'::jsonb);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger logic is complex to "create or replace", we assume it's fine or user can drop manually if conflict.
-- Postgres 14+ supports "create or replace trigger", but Supabase might be older version for some.
-- We'll use conditional drop.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 1. Clients Table
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Farms Table
create table if not exists farms (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  created_by text,
  last_updated_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Lots Table
create table if not exists lots (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id) on delete cascade not null,
  name text not null,
  hectares numeric not null,
  created_by text,
  last_updated_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Products Table
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  type text check (type in ('HERBICIDE', 'FUNGICIDE', 'INSECTICIDE', 'FERTILIZER', 'SEED', 'OTHER')) not null,
  unit text check (unit in ('L', 'KG', 'kg', 'UNIT')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Stock Table
create table if not exists stock (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  quantity numeric default 0 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(client_id, product_id)
);

-- 6. Orders Table
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_number integer,
  client_id uuid references clients(id) on delete cascade not null,
  farm_id uuid references farms(id) on delete cascade not null,
  lot_id uuid references lots(id) on delete cascade not null,
  type text default 'SPRAYING' not null,
  status text check (status in ('PENDING', 'DONE')) default 'PENDING' not null,
  date date not null,
  time text,
  treated_area numeric not null,
  items jsonb not null default '[]'::jsonb,
  applicator_name text,
  notes text,
  created_by text,
  updated_by text,
  synced boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Inventory Movements Table
create table if not exists inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  product_name text,
  type text check (type in ('IN', 'OUT')) not null,
  quantity numeric not null,
  unit text not null,
  date date not null,
  time text,
  reference_id text,
  notes text,
  created_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Order Activities Table
create table if not exists order_activities (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete set null,
  order_number integer,
  client_id uuid references clients(id) on delete cascade not null,
  action text not null,
  description text,
  user_name text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Helper function for RLS
create or replace function public.has_client_access(row_client_id uuid)
returns boolean as $$
declare
  _user_role text;
  _assigned_clients uuid[];
begin
  select role, assigned_clients::uuid[] into _user_role, _assigned_clients
  from profiles
  where id = auth.uid();

  if _user_role = 'MASTER_ADMIN' then
    return true;
  elsif _user_role = 'ADMIN' or _user_role = 'CLIENT' then
    return row_client_id = any(_assigned_clients);
  else
    return false;
  end if;
end;
$$ language plpgsql security definer;

-- Enable RLS (and Profiles again to be sure)
alter table clients enable row level security;
alter table farms enable row level security;
alter table lots enable row level security;
alter table products enable row level security;
alter table stock enable row level security;
alter table orders enable row level security;
alter table inventory_movements enable row level security;
alter table order_activities enable row level security;

-- Policies

-- Clients
drop policy if exists "Users can view assigned clients" on clients;
create policy "Users can view assigned clients" on clients
  for all using ( public.has_client_access(id) );

-- Farms
drop policy if exists "Users can view farms of assigned clients" on farms;
create policy "Users can view farms of assigned clients" on farms
  for all using ( public.has_client_access(client_id) );

-- Lots
drop policy if exists "Users can view lots of assigned farm's client" on lots;
create policy "Users can view lots of assigned farm's client" on lots
  for all using ( public.has_client_access((select client_id from farms where id = farm_id)) );

-- Products
drop policy if exists "Users can view products of assigned clients" on products;
create policy "Users can view products of assigned clients" on products
  for all using ( public.has_client_access(client_id) );

-- Stock
drop policy if exists "Users can view stock of assigned clients" on stock;
create policy "Users can view stock of assigned clients" on stock
  for all using ( public.has_client_access(client_id) );

-- Orders
drop policy if exists "Users can view orders of assigned clients" on orders;
create policy "Users can view orders of assigned clients" on orders
  for all using ( public.has_client_access(client_id) );

-- Movements
drop policy if exists "Users can view movements of assigned clients" on inventory_movements;
create policy "Users can view movements of assigned clients" on inventory_movements
  for all using ( public.has_client_access(client_id) );

-- Activities
drop policy if exists "Users can view activities of assigned clients" on order_activities;
create policy "Users can view activities of assigned clients" on order_activities
  for all using ( public.has_client_access(client_id) );

-- Enable Realtime (Idempotent)
-- 'SET TABLE' replaces all existing tables in the publication with this list.
alter publication supabase_realtime set table clients, farms, lots, products, stock, orders, inventory_movements, order_activities;

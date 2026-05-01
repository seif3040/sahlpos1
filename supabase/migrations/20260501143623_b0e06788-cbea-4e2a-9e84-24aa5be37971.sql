
-- =====================================================
-- ROLES
-- =====================================================
create type public.app_role as enum ('owner', 'manager', 'cashier');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique, -- linked auth.users id (nullable until linked)
  name text not null,
  pin text not null, -- 4-digit, stored for owner reset/display (also used as auth password)
  role app_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);

alter table public.employees enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.current_role_level()
returns int language sql stable security definer set search_path = public as $$
  select case
    when exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'owner') then 3
    when exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'manager') then 2
    when exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'cashier') then 1
    else 0
  end;
$$;

-- Employees policies
create policy "auth read employees" on public.employees for select to authenticated using (true);
create policy "owner manage employees" on public.employees for all to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create policy "auth read roles" on public.user_roles for select to authenticated using (true);
create policy "owner manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

-- =====================================================
-- SETTINGS
-- =====================================================
create table public.settings (
  id int primary key default 1,
  shop_name text not null default 'متجري',
  shop_phone text,
  shop_address text,
  logo_url text,
  currency text not null default 'ج.م',
  tax_percent numeric not null default 14,
  receipt_header text,
  receipt_footer text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into public.settings (id) values (1);

alter table public.settings enable row level security;
create policy "auth read settings" on public.settings for select to authenticated using (true);
create policy "owner update settings" on public.settings for update to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

-- =====================================================
-- CATEGORIES & PRODUCTS
-- =====================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  category_id uuid references public.categories(id) on delete set null,
  purchase_price numeric not null default 0,
  selling_price numeric not null default 0,
  quantity numeric not null default 0,
  min_quantity numeric not null default 0,
  image_url text,
  expiry_date date,
  is_low_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.products (barcode);
create index on public.products (category_id);

alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy "auth read categories" on public.categories for select to authenticated using (true);
create policy "manager+ manage categories" on public.categories for all to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);

create policy "auth read products" on public.products for select to authenticated using (true);
create policy "manager+ manage products" on public.products for all to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);

create or replace function public.update_low_stock()
returns trigger language plpgsql as $$
begin
  new.is_low_stock = (new.quantity <= new.min_quantity);
  new.updated_at = now();
  return new;
end; $$;
create trigger trg_products_low_stock before insert or update on public.products
  for each row execute function public.update_low_stock();

-- =====================================================
-- CUSTOMERS & SUPPLIERS
-- =====================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.suppliers enable row level security;

create policy "auth read customers" on public.customers for select to authenticated using (true);
create policy "auth manage customers" on public.customers for all to authenticated using (true) with check (true);

create policy "auth read suppliers" on public.suppliers for select to authenticated using (true);
create policy "manager+ manage suppliers" on public.suppliers for all to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);

-- =====================================================
-- CASH REGISTER SHIFTS
-- =====================================================
create table public.cash_register_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric not null default 0,
  closing_cash numeric,
  notes text
);

create table public.shift_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.cash_register_shifts(id) on delete cascade,
  type text not null, -- 'in' | 'out'
  amount numeric not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.cash_register_shifts enable row level security;
alter table public.shift_movements enable row level security;
create policy "auth all shifts" on public.cash_register_shifts for all to authenticated using (true) with check (true);
create policy "auth all shift movements" on public.shift_movements for all to authenticated using (true) with check (true);

-- =====================================================
-- SALES (with global sequential invoice number)
-- =====================================================
create sequence public.invoice_seq start 1000;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint not null unique default nextval('public.invoice_seq'),
  cashier_id uuid references public.employees(id),
  customer_id uuid references public.customers(id),
  shift_id uuid references public.cash_register_shifts(id),
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  payment_method text not null default 'cash', -- cash | card | deferred
  is_refunded boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity numeric not null,
  unit_price numeric not null,
  cost_price numeric not null default 0,
  line_total numeric not null
);

create index on public.sales (created_at desc);
create index on public.sale_items (sale_id);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
create policy "auth read sales" on public.sales for select to authenticated using (true);
create policy "auth insert sales" on public.sales for insert to authenticated with check (true);
create policy "manager+ update sales" on public.sales for update to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);
create policy "owner delete sales" on public.sales for delete to authenticated
  using (public.has_role(auth.uid(),'owner'));

create policy "auth read sale_items" on public.sale_items for select to authenticated using (true);
create policy "auth insert sale_items" on public.sale_items for insert to authenticated with check (true);
create policy "manager+ modify sale_items" on public.sale_items for update to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);
create policy "manager+ delete sale_items" on public.sale_items for delete to authenticated
  using (public.current_role_level() >= 2);

-- decrement product stock when sale_items inserted
create or replace function public.handle_sale_item_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update public.products set quantity = quantity - new.quantity where id = new.product_id;
  end if;
  return new;
end; $$;
create trigger trg_sale_items_stock after insert on public.sale_items
  for each row execute function public.handle_sale_item_insert();

-- =====================================================
-- PURCHASES
-- =====================================================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  total numeric not null default 0,
  paid numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id),
  quantity numeric not null,
  unit_cost numeric not null,
  line_total numeric not null
);

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
create policy "auth read purchases" on public.purchases for select to authenticated using (true);
create policy "manager+ manage purchases" on public.purchases for all to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);
create policy "auth read pitems" on public.purchase_items for select to authenticated using (true);
create policy "manager+ manage pitems" on public.purchase_items for all to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);

create or replace function public.handle_purchase_item_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update public.products
      set quantity = quantity + new.quantity,
          purchase_price = new.unit_cost
      where id = new.product_id;
  end if;
  return new;
end; $$;
create trigger trg_purchase_items_stock after insert on public.purchase_items
  for each row execute function public.handle_purchase_item_insert();

-- =====================================================
-- CUSTOMER DEBTS
-- =====================================================
create table public.customer_debts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  sale_id uuid references public.sales(id),
  amount numeric not null,
  paid numeric not null default 0,
  remaining numeric generated always as (amount - paid) stored,
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid references public.customer_debts(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table public.customer_debts enable row level security;
alter table public.debt_payments enable row level security;
create policy "auth all debts" on public.customer_debts for all to authenticated using (true) with check (true);
create policy "auth all debt_payments" on public.debt_payments for all to authenticated using (true) with check (true);

-- =====================================================
-- EXPENSES
-- =====================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'other',
  amount numeric not null,
  note text,
  shift_id uuid references public.cash_register_shifts(id),
  employee_id uuid references public.employees(id),
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create policy "auth read expenses" on public.expenses for select to authenticated using (true);
create policy "auth insert expenses" on public.expenses for insert to authenticated with check (true);
create policy "manager+ modify expenses" on public.expenses for update to authenticated
  using (public.current_role_level() >= 2) with check (public.current_role_level() >= 2);
create policy "manager+ delete expenses" on public.expenses for delete to authenticated
  using (public.current_role_level() >= 2);

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
insert into storage.buckets (id, name, public) values ('products','products', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('shop','shop', true)
  on conflict (id) do nothing;

create policy "public read products bucket" on storage.objects for select using (bucket_id = 'products');
create policy "auth write products bucket" on storage.objects for insert to authenticated
  with check (bucket_id = 'products');
create policy "auth update products bucket" on storage.objects for update to authenticated
  using (bucket_id = 'products');
create policy "auth delete products bucket" on storage.objects for delete to authenticated
  using (bucket_id = 'products');

create policy "public read shop bucket" on storage.objects for select using (bucket_id = 'shop');
create policy "owner write shop bucket" on storage.objects for insert to authenticated
  with check (bucket_id = 'shop' and public.has_role(auth.uid(),'owner'));
create policy "owner update shop bucket" on storage.objects for update to authenticated
  using (bucket_id = 'shop' and public.has_role(auth.uid(),'owner'));

-- =====================================================
-- REALTIME
-- =====================================================
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.sale_items;
alter publication supabase_realtime add table public.customer_debts;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.cash_register_shifts;

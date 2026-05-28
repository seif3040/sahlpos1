
-- =====================================================
-- PHASE 1: SaaS Multi-tenant transformation (reordered)
-- =====================================================

-- 1. New types
CREATE TYPE public.plan_tier AS ENUM ('basic', 'pro', 'enterprise');
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'pending_payment');
CREATE TYPE public.payment_review_status AS ENUM ('pending', 'ai_approved', 'ai_rejected', 'needs_review', 'admin_approved', 'admin_rejected');
CREATE TYPE public.payment_method_type AS ENUM ('vodafone_cash', 'instapay', 'fawry', 'bank_transfer');

-- 2. platform_settings
CREATE TABLE public.platform_settings (
  id int PRIMARY KEY DEFAULT 1,
  vodafone_cash_number text NOT NULL DEFAULT '01000000000',
  instapay_handle text NOT NULL DEFAULT 'sahlpos@instapay',
  bank_account text,
  basic_price numeric NOT NULL DEFAULT 299,
  pro_price numeric NOT NULL DEFAULT 599,
  enterprise_price numeric NOT NULL DEFAULT 999,
  currency text NOT NULL DEFAULT 'EGP',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read platform settings" ON public.platform_settings FOR SELECT USING (true);
INSERT INTO public.platform_settings (id) VALUES (1);

-- 3. tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan public.plan_tier NOT NULL DEFAULT 'basic',
  status public.tenant_status NOT NULL DEFAULT 'pending_payment',
  owner_user_id uuid,
  contact_email text,
  contact_phone text,
  subscription_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 4. platform_admins
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 5. is_platform_admin function (no dependency on tenant_id)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE POLICY "self read platform admin" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_platform_admin());

-- 6. Create legacy tenant
INSERT INTO public.tenants (id, name, slug, plan, status, subscription_ends_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Legacy Shop', 'legacy', 'enterprise', 'active', now() + interval '100 years');

-- 7. Add tenant_id + must_reset_pin to employees FIRST (so we can create current_tenant_id)
ALTER TABLE public.employees
  ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN must_reset_pin boolean NOT NULL DEFAULT false;
UPDATE public.employees SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.employees ALTER COLUMN tenant_id SET NOT NULL;
CREATE UNIQUE INDEX employees_tenant_pin_active ON public.employees(tenant_id, pin) WHERE active = true;

-- 8. Now create current_tenant_id function
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.employees WHERE user_id = auth.uid() AND active = true LIMIT 1;
$$;

-- 9. tenants RLS now
CREATE POLICY "tenants visible to members or admin" ON public.tenants
  FOR SELECT TO authenticated USING (
    id = public.current_tenant_id() OR owner_user_id = auth.uid() OR public.is_platform_admin()
  );
CREATE POLICY "tenants public read by slug" ON public.tenants
  FOR SELECT TO anon USING (true);
CREATE POLICY "tenants insert by auth" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tenants update by admin or owner" ON public.tenants
  FOR UPDATE TO authenticated USING (
    public.is_platform_admin() OR owner_user_id = auth.uid()
  ) WITH CHECK (true);

-- 10. tenant_subscriptions
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL,
  amount numeric NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs visible to tenant or admin" ON public.tenant_subscriptions
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id() OR public.is_platform_admin()
  );

-- 11. payment_submissions
CREATE TABLE public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  desired_slug text,
  plan public.plan_tier NOT NULL,
  amount numeric NOT NULL,
  method public.payment_method_type NOT NULL,
  screenshot_url text NOT NULL,
  ai_status public.payment_review_status,
  ai_notes text,
  ai_extracted jsonb,
  admin_status public.payment_review_status,
  admin_notes text,
  status public.payment_review_status NOT NULL DEFAULT 'pending',
  account_created boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.payment_submissions TO anon, authenticated;
GRANT ALL ON public.payment_submissions TO service_role;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert payment submission" ON public.payment_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "platform admin read all payments" ON public.payment_submissions
  FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY "submitter read own payment" ON public.payment_submissions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "platform admin update payments" ON public.payment_submissions
  FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "service update payment status" ON public.payment_submissions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 12. Seed existing owner as platform admin + legacy tenant owner
INSERT INTO public.platform_admins (user_id)
SELECT user_id FROM public.user_roles WHERE role = 'owner' AND user_id IS NOT NULL LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE public.tenants
SET owner_user_id = (SELECT user_id FROM public.user_roles WHERE role = 'owner' LIMIT 1)
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 13. Add tenant_id to remaining tables and backfill
ALTER TABLE public.products ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.products SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.products ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX products_tenant_idx ON public.products(tenant_id);

ALTER TABLE public.customers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.customers SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.customers ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX customers_tenant_idx ON public.customers(tenant_id);

ALTER TABLE public.suppliers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.suppliers SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.suppliers ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.categories ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.categories SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.categories ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.sales ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.sales SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sales ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX sales_tenant_idx ON public.sales(tenant_id);

ALTER TABLE public.sale_items ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.sale_items SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sale_items ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.purchases ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.purchases SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.purchases ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.purchase_items ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.purchase_items SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.purchase_items ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.expenses ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.expenses SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.expenses ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.cash_register_shifts ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.cash_register_shifts SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.cash_register_shifts ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.shift_movements ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.shift_movements SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.shift_movements ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.customer_debts ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.customer_debts SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.customer_debts ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.debt_payments ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.debt_payments SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.debt_payments ALTER COLUMN tenant_id SET NOT NULL;

-- settings: one per tenant
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.settings SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.settings ADD PRIMARY KEY (tenant_id);

-- 14. Update RLS policies to scope by tenant_id

-- employees
DROP POLICY IF EXISTS "owner manage employees" ON public.employees;
DROP POLICY IF EXISTS "owner reads all employees" ON public.employees;
DROP POLICY IF EXISTS "self read own employee" ON public.employees;
CREATE POLICY "tenant members read employees" ON public.employees FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY "owner manage employees" ON public.employees FOR ALL TO authenticated
  USING (
    public.is_platform_admin() OR
    (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'owner'::app_role))
  )
  WITH CHECK (
    public.is_platform_admin() OR
    (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'owner'::app_role))
  );

-- products
DROP POLICY IF EXISTS "auth read products" ON public.products;
DROP POLICY IF EXISTS "manager+ manage products" ON public.products;
CREATE POLICY "tenant read products" ON public.products FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_platform_admin());
CREATE POLICY "tenant mgr+ manage products" ON public.products FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- customers
DROP POLICY IF EXISTS "auth read customers" ON public.customers;
DROP POLICY IF EXISTS "auth insert customers" ON public.customers;
DROP POLICY IF EXISTS "auth update customers" ON public.customers;
DROP POLICY IF EXISTS "manager+ delete customers" ON public.customers;
CREATE POLICY "tenant read customers" ON public.customers FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant update customers" ON public.customers FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ delete customers" ON public.customers FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- suppliers
DROP POLICY IF EXISTS "manager+ manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "manager+ read suppliers" ON public.suppliers;
CREATE POLICY "tenant mgr+ manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- categories
DROP POLICY IF EXISTS "auth read categories" ON public.categories;
DROP POLICY IF EXISTS "manager+ manage categories" ON public.categories;
CREATE POLICY "tenant read categories" ON public.categories FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ manage categories" ON public.categories FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- sales
DROP POLICY IF EXISTS "auth read sales" ON public.sales;
DROP POLICY IF EXISTS "auth insert sales" ON public.sales;
DROP POLICY IF EXISTS "manager+ update sales" ON public.sales;
DROP POLICY IF EXISTS "owner delete sales" ON public.sales;
CREATE POLICY "tenant read sales" ON public.sales FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ update sales" ON public.sales FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);
CREATE POLICY "tenant owner delete sales" ON public.sales FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'owner'::app_role));

-- sale_items
DROP POLICY IF EXISTS "auth read sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "auth insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "manager+ modify sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "manager+ delete sale_items" ON public.sale_items;
CREATE POLICY "tenant read sale_items" ON public.sale_items FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert sale_items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ modify sale_items" ON public.sale_items FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);
CREATE POLICY "tenant mgr+ delete sale_items" ON public.sale_items FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- purchases
DROP POLICY IF EXISTS "auth read purchases" ON public.purchases;
DROP POLICY IF EXISTS "manager+ manage purchases" ON public.purchases;
CREATE POLICY "tenant read purchases" ON public.purchases FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ manage purchases" ON public.purchases FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- purchase_items
DROP POLICY IF EXISTS "auth read pitems" ON public.purchase_items;
DROP POLICY IF EXISTS "manager+ manage pitems" ON public.purchase_items;
CREATE POLICY "tenant read pitems" ON public.purchase_items FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ manage pitems" ON public.purchase_items FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- expenses
DROP POLICY IF EXISTS "auth read expenses" ON public.expenses;
DROP POLICY IF EXISTS "auth insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "manager+ modify expenses" ON public.expenses;
DROP POLICY IF EXISTS "manager+ delete expenses" ON public.expenses;
CREATE POLICY "tenant read expenses" ON public.expenses FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ update expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);
CREATE POLICY "tenant mgr+ delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- cash_register_shifts
DROP POLICY IF EXISTS "auth read shifts" ON public.cash_register_shifts;
DROP POLICY IF EXISTS "auth insert shifts" ON public.cash_register_shifts;
DROP POLICY IF EXISTS "self or manager+ update shifts" ON public.cash_register_shifts;
DROP POLICY IF EXISTS "manager+ delete shifts" ON public.cash_register_shifts;
CREATE POLICY "tenant read shifts" ON public.cash_register_shifts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert shifts" ON public.cash_register_shifts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant update shifts" ON public.cash_register_shifts FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (
    public.current_role_level() >= 2 OR
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  ))
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ delete shifts" ON public.cash_register_shifts FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- shift_movements
DROP POLICY IF EXISTS "auth read shift movements" ON public.shift_movements;
DROP POLICY IF EXISTS "auth insert shift movements" ON public.shift_movements;
DROP POLICY IF EXISTS "manager+ update shift movements" ON public.shift_movements;
DROP POLICY IF EXISTS "manager+ delete shift movements" ON public.shift_movements;
CREATE POLICY "tenant read shift movements" ON public.shift_movements FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert shift movements" ON public.shift_movements FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ modify shift movements" ON public.shift_movements FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);
CREATE POLICY "tenant mgr+ delete shift movements" ON public.shift_movements FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- customer_debts
DROP POLICY IF EXISTS "auth read debts" ON public.customer_debts;
DROP POLICY IF EXISTS "auth insert debts" ON public.customer_debts;
DROP POLICY IF EXISTS "manager+ update debts" ON public.customer_debts;
DROP POLICY IF EXISTS "manager+ delete debts" ON public.customer_debts;
CREATE POLICY "tenant read debts" ON public.customer_debts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert debts" ON public.customer_debts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ update debts" ON public.customer_debts FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);
CREATE POLICY "tenant mgr+ delete debts" ON public.customer_debts FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- debt_payments
DROP POLICY IF EXISTS "auth read debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "auth insert debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "manager+ update debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "manager+ delete debt_payments" ON public.debt_payments;
CREATE POLICY "tenant read debt_payments" ON public.debt_payments FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant insert debt_payments" ON public.debt_payments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant mgr+ update debt_payments" ON public.debt_payments FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2)
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);
CREATE POLICY "tenant mgr+ delete debt_payments" ON public.debt_payments FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role_level() >= 2);

-- settings
DROP POLICY IF EXISTS "auth read settings" ON public.settings;
DROP POLICY IF EXISTS "owner update settings" ON public.settings;
CREATE POLICY "tenant read settings" ON public.settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant owner update settings" ON public.settings FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "tenant insert settings" ON public.settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 15. Storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone can upload payment screenshot" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-screenshots');
CREATE POLICY "platform admin read payment screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-screenshots' AND public.is_platform_admin());

-- 16. Tighten function grants
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

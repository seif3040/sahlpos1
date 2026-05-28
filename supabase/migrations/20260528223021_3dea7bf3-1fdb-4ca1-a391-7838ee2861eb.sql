
-- Set DEFAULT current_tenant_id() so existing INSERT statements don't need to specify tenant_id
ALTER TABLE public.products ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.customers ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.suppliers ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.categories ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.sales ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.sale_items ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.purchases ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.purchase_items ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.expenses ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.cash_register_shifts ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.shift_movements ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.customer_debts ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.debt_payments ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.employees ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.settings ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

-- Tighten over-permissive policies
DROP POLICY IF EXISTS "tenants update by admin or owner" ON public.tenants;
CREATE POLICY "tenants update by admin or owner" ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR owner_user_id = auth.uid())
  WITH CHECK (public.is_platform_admin() OR owner_user_id = auth.uid());

-- Remove the loose service update policy on payment_submissions
DROP POLICY IF EXISTS "service update payment status" ON public.payment_submissions;
-- Only platform admins can update payments (already exists). 
-- For AI auto-update via server function, we use supabaseAdmin which bypasses RLS.

DROP POLICY IF EXISTS "submitter read own payment" ON public.payment_submissions;
-- Submitters will read their own payment via server function with payment ID, not direct query.
-- Re-add a tighter read for the form's own polling:
-- We'll match by id only when it's known (the form keeps the id in state).
-- For now, only platform admin reads. Server function handles the rest with supabaseAdmin.

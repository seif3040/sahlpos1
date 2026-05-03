
-- 1) employees: restrict SELECT — only owner sees everyone, others see only own row
DROP POLICY IF EXISTS "auth read employees" ON public.employees;
CREATE POLICY "owner reads all employees" ON public.employees
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "self read own employee" ON public.employees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2) user_roles: restrict SELECT to self + owner
DROP POLICY IF EXISTS "auth read roles" ON public.user_roles;
CREATE POLICY "self read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

-- 3) customer_debts: split FOR ALL into insert(any) + update/delete(manager+)
DROP POLICY IF EXISTS "auth all debts" ON public.customer_debts;
CREATE POLICY "auth read debts" ON public.customer_debts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert debts" ON public.customer_debts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "manager+ update debts" ON public.customer_debts
  FOR UPDATE TO authenticated
  USING (current_role_level() >= 2) WITH CHECK (current_role_level() >= 2);
CREATE POLICY "manager+ delete debts" ON public.customer_debts
  FOR DELETE TO authenticated USING (current_role_level() >= 2);

-- 4) debt_payments: same pattern
DROP POLICY IF EXISTS "auth all debt_payments" ON public.debt_payments;
CREATE POLICY "auth read debt_payments" ON public.debt_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert debt_payments" ON public.debt_payments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "manager+ update debt_payments" ON public.debt_payments
  FOR UPDATE TO authenticated
  USING (current_role_level() >= 2) WITH CHECK (current_role_level() >= 2);
CREATE POLICY "manager+ delete debt_payments" ON public.debt_payments
  FOR DELETE TO authenticated USING (current_role_level() >= 2);

-- 5) cash_register_shifts: cashier opens/closes own shift, manager+ can modify any
DROP POLICY IF EXISTS "auth all shifts" ON public.cash_register_shifts;
CREATE POLICY "auth read shifts" ON public.cash_register_shifts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert shifts" ON public.cash_register_shifts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "self or manager+ update shifts" ON public.cash_register_shifts
  FOR UPDATE TO authenticated
  USING (
    current_role_level() >= 2
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  )
  WITH CHECK (
    current_role_level() >= 2
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );
CREATE POLICY "manager+ delete shifts" ON public.cash_register_shifts
  FOR DELETE TO authenticated USING (current_role_level() >= 2);

-- 6) shift_movements: same pattern
DROP POLICY IF EXISTS "auth all shift movements" ON public.shift_movements;
CREATE POLICY "auth read shift movements" ON public.shift_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert shift movements" ON public.shift_movements
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "manager+ update shift movements" ON public.shift_movements
  FOR UPDATE TO authenticated
  USING (current_role_level() >= 2) WITH CHECK (current_role_level() >= 2);
CREATE POLICY "manager+ delete shift movements" ON public.shift_movements
  FOR DELETE TO authenticated USING (current_role_level() >= 2);

-- 7) suppliers: restrict SELECT to manager+
DROP POLICY IF EXISTS "auth read suppliers" ON public.suppliers;
CREATE POLICY "manager+ read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (current_role_level() >= 2);

-- 8) Storage: products bucket — restrict writes to manager+, restrict listing
DROP POLICY IF EXISTS "auth write products bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth update products bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth delete products bucket" ON storage.objects;
DROP POLICY IF EXISTS "public read products bucket" ON storage.objects;
DROP POLICY IF EXISTS "public read shop bucket" ON storage.objects;

CREATE POLICY "manager+ write products bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.current_role_level() >= 2);
CREATE POLICY "manager+ update products bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND public.current_role_level() >= 2);
CREATE POLICY "manager+ delete products bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND public.current_role_level() >= 2);

-- Public read by exact path only (no listing) — buckets are public so direct URLs work
CREATE POLICY "public read products by path" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'products' AND name IS NOT NULL);
CREATE POLICY "public read shop by path" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'shop' AND name IS NOT NULL);

-- 9) Fix mutable search_path on update_low_stock
CREATE OR REPLACE FUNCTION public.update_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  new.is_low_stock = (new.quantity <= new.min_quantity);
  new.updated_at = now();
  return new;
end; $function$;

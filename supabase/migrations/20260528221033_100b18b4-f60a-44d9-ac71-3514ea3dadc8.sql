
-- Replace permissive (true) write policies with auth.uid() IS NOT NULL
DROP POLICY IF EXISTS "auth insert shifts" ON public.cash_register_shifts;
CREATE POLICY "auth insert shifts" ON public.cash_register_shifts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert debts" ON public.customer_debts;
CREATE POLICY "auth insert debts" ON public.customer_debts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth manage customers" ON public.customers;
CREATE POLICY "auth insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update customers" ON public.customers
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "manager+ delete customers" ON public.customers
  FOR DELETE TO authenticated USING (current_role_level() >= 2);

DROP POLICY IF EXISTS "auth insert debt_payments" ON public.debt_payments;
CREATE POLICY "auth insert debt_payments" ON public.debt_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert expenses" ON public.expenses;
CREATE POLICY "auth insert expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert sale_items" ON public.sale_items;
CREATE POLICY "auth insert sale_items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert sales" ON public.sales;
CREATE POLICY "auth insert sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert shift movements" ON public.shift_movements;
CREATE POLICY "auth insert shift movements" ON public.shift_movements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Lock down SECURITY DEFINER function exposure
REVOKE EXECUTE ON FUNCTION public.handle_purchase_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_sale_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_debt_remaining() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_low_stock() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_role_level() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_sale_item(uuid, numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_level() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_sale_item(uuid, numeric) TO authenticated;

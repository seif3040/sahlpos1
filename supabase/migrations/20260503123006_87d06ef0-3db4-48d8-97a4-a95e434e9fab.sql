
REVOKE EXECUTE ON FUNCTION public.refund_sale_item(uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_role_level() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.refund_sale_item(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_level() TO authenticated;

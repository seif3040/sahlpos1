
DELETE FROM public.debt_payments;
DELETE FROM public.customer_debts;
DELETE FROM public.sale_items;
DELETE FROM public.sales;
ALTER SEQUENCE public.invoice_seq RESTART WITH 1;

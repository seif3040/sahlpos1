-- Prevent negative stock on sale and validate refund returns
CREATE OR REPLACE FUNCTION public.handle_sale_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  current_qty numeric;
  prod_name text;
begin
  if new.product_id is not null then
    select quantity, name into current_qty, prod_name from public.products where id = new.product_id for update;
    if current_qty is null then
      raise exception 'المنتج غير موجود';
    end if;
    if new.quantity > current_qty then
      raise exception 'الكمية المطلوبة (%) أكبر من المتاح (%) للمنتج: %', new.quantity, current_qty, prod_name;
    end if;
    update public.products set quantity = quantity - new.quantity where id = new.product_id;
  end if;
  return new;
end; $function$;

-- Add cash_received and change_amount columns to sales for change calculation
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_received numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_part numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_part numeric NOT NULL DEFAULT 0;

-- Add refunded_quantity to sale_items for partial refunds
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS refunded_quantity numeric NOT NULL DEFAULT 0;

-- Function to refund a single line item (partial refund)
CREATE OR REPLACE FUNCTION public.refund_sale_item(_item_id uuid, _qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  it record;
begin
  select * into it from public.sale_items where id = _item_id for update;
  if it is null then raise exception 'العنصر غير موجود'; end if;
  if _qty <= 0 then raise exception 'الكمية غير صحيحة'; end if;
  if (it.refunded_quantity + _qty) > it.quantity then
    raise exception 'الكمية تتجاوز المتبقي للاسترجاع';
  end if;
  update public.sale_items set refunded_quantity = refunded_quantity + _qty where id = _item_id;
  if it.product_id is not null then
    update public.products set quantity = quantity + _qty where id = it.product_id;
  end if;
end; $$;
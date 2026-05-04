-- Auto compute remaining + is_settled on customer_debts
CREATE OR REPLACE FUNCTION public.compute_debt_remaining()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.remaining := GREATEST(0, COALESCE(NEW.amount,0) - COALESCE(NEW.paid,0));
  NEW.is_settled := (NEW.remaining <= 0);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_compute_debt_remaining ON public.customer_debts;
CREATE TRIGGER trg_compute_debt_remaining
BEFORE INSERT OR UPDATE ON public.customer_debts
FOR EACH ROW EXECUTE FUNCTION public.compute_debt_remaining();

-- Backfill existing rows
UPDATE public.customer_debts
SET amount = amount
WHERE remaining IS NULL;

-- Track the pre-created auth user on each payment submission, so the same
-- email/password the owner used at checkout becomes their login after approval.
ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS payment_submissions_owner_user_id_idx
  ON public.payment_submissions(owner_user_id);

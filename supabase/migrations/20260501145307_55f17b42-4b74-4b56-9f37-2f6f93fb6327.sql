-- Deactivate any duplicate owner employees, keep only the oldest active one.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY pin ORDER BY created_at ASC) AS rn
  FROM public.employees
  WHERE active = true
)
UPDATE public.employees e
SET active = false
FROM ranked r
WHERE e.id = r.id AND r.rn > 1;

-- Defense in depth: hide PIN column from non-admin DB roles. supabaseAdmin (service_role) keeps full access.
REVOKE SELECT (pin) ON public.employees FROM authenticated, anon;

-- Add missing DELETE policy for the 'shop' storage bucket (owners only)
CREATE POLICY "Shop bucket owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shop' AND public.has_role(auth.uid(), 'owner'::public.app_role)
);

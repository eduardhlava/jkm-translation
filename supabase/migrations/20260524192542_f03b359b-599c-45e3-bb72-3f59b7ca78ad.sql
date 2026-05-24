
-- 1. notion-images storage: restrict modify to admins, remove broad listing policy
DROP POLICY IF EXISTS "Authenticated update notion-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete notion-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read notion-images" ON storage.objects;

CREATE POLICY "Admins can update notion-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'notion-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'notion-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notion-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notion-images' AND public.has_role(auth.uid(), 'admin'));

-- 2. document_blocks: replace `true` with explicit auth check
DROP POLICY IF EXISTS "Authenticated can read document_blocks" ON public.document_blocks;
DROP POLICY IF EXISTS "Authenticated can insert document_blocks" ON public.document_blocks;
DROP POLICY IF EXISTS "Authenticated can update document_blocks" ON public.document_blocks;
DROP POLICY IF EXISTS "Authenticated can delete document_blocks" ON public.document_blocks;

CREATE POLICY "Signed-in users can read document_blocks"
ON public.document_blocks FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Signed-in users can insert document_blocks"
ON public.document_blocks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Signed-in users can update document_blocks"
ON public.document_blocks FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Signed-in users can delete document_blocks"
ON public.document_blocks FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- They remain callable from inside RLS policies and triggers (definer context).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_profile() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_role() FROM anon, authenticated, PUBLIC;

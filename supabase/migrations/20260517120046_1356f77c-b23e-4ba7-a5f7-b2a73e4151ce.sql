CREATE POLICY "Authenticated upload notion-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notion-images');

CREATE POLICY "Authenticated update notion-images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'notion-images') WITH CHECK (bucket_id = 'notion-images');

CREATE POLICY "Authenticated delete notion-images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'notion-images');
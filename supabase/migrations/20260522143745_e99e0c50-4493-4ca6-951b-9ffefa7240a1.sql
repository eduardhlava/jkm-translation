INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('document-pdfs', 'document-pdfs', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf'];

CREATE POLICY "Users can view their own temporary PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'document-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own temporary PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'document-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own temporary PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'document-pdfs' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'document-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own temporary PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'document-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
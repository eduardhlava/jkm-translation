CREATE TABLE public.document_blocks (
  page_id text PRIMARY KEY,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.document_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read document_blocks"
ON public.document_blocks FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert document_blocks"
ON public.document_blocks FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update document_blocks"
ON public.document_blocks FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete document_blocks"
ON public.document_blocks FOR DELETE
TO authenticated USING (true);

CREATE TRIGGER document_blocks_updated_at
BEFORE UPDATE ON public.document_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
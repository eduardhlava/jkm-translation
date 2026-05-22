ALTER TABLE public.document_blocks
ADD COLUMN IF NOT EXISTS notion_exported_at TIMESTAMP WITH TIME ZONE;
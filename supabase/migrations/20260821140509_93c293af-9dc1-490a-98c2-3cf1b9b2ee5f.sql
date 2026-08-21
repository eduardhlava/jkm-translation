ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_dictionary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_documents boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_files boolean NOT NULL DEFAULT true;

UPDATE public.profiles SET can_dictionary = true, can_documents = true, can_files = true;
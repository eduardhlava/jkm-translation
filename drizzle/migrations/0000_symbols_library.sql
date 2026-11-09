ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_pictograms boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.can_manage_symbols(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(_uid, 'admin') or exists (
    select 1 from public.profiles where user_id = _uid and is_active and can_pictograms
  )
$$;

CREATE TABLE public.symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  file_path text NOT NULL,
  render_path text,
  width_px integer NOT NULL DEFAULT 0,
  height_px integer NOT NULL DEFAULT 0,
  default_width_mm numeric NOT NULL DEFAULT 20,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.symbols TO authenticated;
GRANT ALL ON public.symbols TO service_role;
ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read symbols" ON public.symbols FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can insert symbols" ON public.symbols FOR INSERT TO authenticated WITH CHECK (public.can_manage_symbols(auth.uid()));
CREATE POLICY "Managers can update symbols" ON public.symbols FOR UPDATE TO authenticated USING (public.can_manage_symbols(auth.uid())) WITH CHECK (public.can_manage_symbols(auth.uid()));
CREATE POLICY "Managers can delete symbols" ON public.symbols FOR DELETE TO authenticated USING (public.can_manage_symbols(auth.uid()));
CREATE TRIGGER symbols_updated_at BEFORE UPDATE ON public.symbols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.symbol_usage(_code text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select count(*)::int from public.document_blocks
  where auth.uid() is not null and (
    blocks::text like '%"code": "' || _code || '"%'
    or blocks::text like '%"code":"' || _code || '"%'
    or blocks::text like '%[[sym:' || _code || '%'
  )
$$;
GRANT EXECUTE ON FUNCTION public.symbol_usage(text) TO authenticated;

CREATE POLICY "Public read symbols bucket" ON storage.objects FOR SELECT USING (bucket_id = 'symbols');
CREATE POLICY "Managers upload symbols" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'symbols' AND public.can_manage_symbols(auth.uid()));
CREATE POLICY "Managers update symbols" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'symbols' AND public.can_manage_symbols(auth.uid()));
CREATE POLICY "Managers delete symbols" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'symbols' AND public.can_manage_symbols(auth.uid()));
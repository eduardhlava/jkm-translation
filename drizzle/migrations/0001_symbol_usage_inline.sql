CREATE OR REPLACE FUNCTION public.symbol_usage(_code text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from public.document_blocks
  where auth.uid() is not null and (
    blocks::text like '%"code": "' || _code || '"%'
    or blocks::text like '%"code":"' || _code || '"%'
    or blocks::text like '%[[sym:' || _code || '%'
    or blocks::text like '%data-sym=\\"' || _code || '\\"%'
  )
$function$;
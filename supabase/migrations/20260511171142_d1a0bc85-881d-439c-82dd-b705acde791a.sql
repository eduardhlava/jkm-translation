insert into storage.buckets (id, name, public)
values ('notion-images', 'notion-images', true)
on conflict (id) do update set public = true;

create policy "Public read notion-images"
on storage.objects for select
using (bucket_id = 'notion-images');
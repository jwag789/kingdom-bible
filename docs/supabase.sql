-- Kingdom Bible: storage for family voices.
-- Paste this into your Supabase project's SQL Editor (left sidebar, "SQL Editor") and press Run.
--
-- It makes a public "voices" bucket: anyone with a link can listen to a recording, and the app
-- (with the public key) can add new recordings, but nobody can list, change or delete them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voices', 'voices', true, 5242880, array['audio/*', 'application/json'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['audio/*', 'application/json'];

drop policy if exists "Anyone can add family voices" on storage.objects;
create policy "Anyone can add family voices"
  on storage.objects for insert to anon
  with check (bucket_id = 'voices');

-- Already applied to project fbprlvsjeqnuxjxlkqps (migration "family_circle_docs"). Kept here for reference.
create table if not exists public.fc_docs (
  collection text not null,
  doc_id text not null,
  data jsonb not null default '{}'::jsonb,
  owner uuid default auth.uid(),
  t bigint generated always as (case when (data->>'t') ~ '^[0-9]{1,15}$' then (data->>'t')::bigint end) stored,
  updated_at timestamptz not null default now(),
  primary key (collection, doc_id)
);
create index if not exists fc_docs_coll_t_idx on public.fc_docs (collection, t desc);
alter table public.fc_docs enable row level security;

create or replace function public.fc_my_group()
returns text language sql stable security definer set search_path = public as $$
  select data->>'g' from public.fc_docs where collection = 'members' and doc_id = auth.uid()::text
$$;
revoke all on function public.fc_my_group() from public, anon;
grant execute on function public.fc_my_group() to authenticated;

-- policies: fc_select, fc_insert, fc_update, fc_delete (see the Supabase dashboard > Authentication > Policies)
alter publication supabase_realtime add table public.fc_docs;
insert into public.fc_docs (collection, doc_id, data, owner)
values ('groups', 'K7FM2Q', '{"name":"Our Family","t":1793083200000}'::jsonb, null)
on conflict do nothing;

-- Auto-join (migration "family_circle_auto_join")
create table if not exists public.fc_allowed (email text primary key, group_code text not null default 'K7FM2Q');
alter table public.fc_allowed enable row level security;
-- function public.fc_auto_group() returns the group code for the signed-in email, or null
-- add a family member:  insert into public.fc_allowed (email) values ('their.email@example.com');

-- Saved settings, family list and photos (migration "family_circle_prefs_and_photos")
-- Rows with collection = 'prefs' and doc_id '<user id>:settings' | ':family' | ':photos' are private to that user.
create policy fc_prefs_own on public.fc_docs for all to authenticated
  using (collection = 'prefs' and split_part(doc_id, ':', 1) = (select auth.uid())::text)
  with check (collection = 'prefs' and split_part(doc_id, ':', 1) = (select auth.uid())::text);
-- Private photo bucket; each user can only use the folder named after their own user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fc-photos', 'fc-photos', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- policies fc_photos_select / insert / update / delete on storage.objects (folder = auth.uid())

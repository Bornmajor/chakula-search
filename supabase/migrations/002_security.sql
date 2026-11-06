-- Row Level Security + storage bucket. Supabase-only (needs the auth/storage schemas).
-- In Authentication settings, DISABLE public sign-ups and create the admin user by hand.
alter table dishes   enable row level security;
alter table searches enable row level security;

create policy "anyone reads dishes"  on dishes for select using (true);
create policy "admin writes dishes"  on dishes for all to authenticated using (true) with check (true);

create policy "anyone logs searches" on searches for insert to anon, authenticated with check (true);
create policy "admin reads searches" on searches for select to authenticated using (true);

-- Public bucket: photos are viewable by URL; only the admin can change them.
insert into storage.buckets (id, name, public) values ('dish-images', 'dish-images', true)
  on conflict (id) do nothing;

create policy "admin uploads images" on storage.objects for insert to authenticated
  with check (bucket_id = 'dish-images');
create policy "admin updates images" on storage.objects for update to authenticated
  using (bucket_id = 'dish-images');
create policy "admin deletes images" on storage.objects for delete to authenticated
  using (bucket_id = 'dish-images');

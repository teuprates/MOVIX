-- MOVIX · 0004 · Storage: buckets e políticas
-- Convenções de caminho (primeiro segmento sempre identifica o escopo):
--   documents/{user_id}/{arquivo}                        CNH e comprovante (privado)
--   vehicle-media/{org_id}/{vehicle_id}/{arquivo}        fotos de veículos (privado, membros aprovados)
--   inspection-media/{org_id}/{inspection_id}/{arquivo}  fotos de vistoria (privado)
--   incident-media/{org_id}/{incident_id}/{arquivo}      anexos de ocorrências (privado)
--   branding/{org_id}/{arquivo}                          logo da locadora (leitura pública)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('vehicle-media', 'vehicle-media', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('inspection-media', 'inspection-media', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('incident-media', 'incident-media', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('branding', 'branding', true, 1048576, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- documents
create policy "documents: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_view_profile(public.try_uuid((storage.foldername(name))[1])));
create policy "documents: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_active());
create policy "documents: dono substitui" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents: dono remove" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- vehicle-media
create policy "vehicle-media: membros leem" on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-media' and public.is_org_member(public.try_uuid((storage.foldername(name))[1])));
create policy "vehicle-media: proprietário envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-media' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "vehicle-media: proprietário remove" on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-media' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));

-- inspection-media (segundo segmento = inspeção)
create policy "inspection-media: envolvidos leem" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-media' and public.can_access_inspection(public.try_uuid((storage.foldername(name))[2])));
create policy "inspection-media: autor envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-media' and exists (
    select 1 from public.inspections i
    where i.id = public.try_uuid((storage.foldername(name))[2])
      and i.organization_id = public.try_uuid((storage.foldername(name))[1])
      and i.submitted_by = auth.uid() and i.status = 'submitted'));

-- incident-media
create policy "incident-media: envolvidos leem" on storage.objects for select to authenticated
  using (bucket_id = 'incident-media' and public.can_access_incident(public.try_uuid((storage.foldername(name))[2])));
create policy "incident-media: envolvidos enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'incident-media' and public.can_access_incident(public.try_uuid((storage.foldername(name))[2])));

-- branding (leitura pública via URL pública do bucket; escrita apenas proprietário)
create policy "branding: proprietário envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "branding: proprietário substitui" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "branding: proprietário remove" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "branding: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'branding');

-- MOVIX · 0006 · Correção da policy organizations_select
-- Na subconsulta original, `id` sem qualificação resolvia para organization_memberships.id (e não organizations.id),
-- então um locatário com vínculo pendente não enxergava o nome da locadora na tela "Cadastro em análise".
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (
    public.is_org_member(organizations.id)
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

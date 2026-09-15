create index if not exists person_layouts_updated_by_idx
on public.person_layouts (updated_by);

drop policy if exists person_layouts_admin_insert on public.person_layouts;
create policy person_layouts_admin_insert
on public.person_layouts
for insert
to authenticated
with check (
  public.is_admin()
  and updated_by = (select auth.uid())
);

drop policy if exists person_layouts_admin_update on public.person_layouts;
create policy person_layouts_admin_update
on public.person_layouts
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and updated_by = (select auth.uid())
);

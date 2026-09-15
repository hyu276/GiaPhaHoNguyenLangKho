create or replace function public.can_view_private_genealogy()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'spectator'),
    false
  );
$$;

revoke all on function public.can_view_private_genealogy() from public;
grant execute on function public.can_view_private_genealogy() to anon, authenticated;

drop policy if exists people_read_visible_or_admin on public.people;
drop policy if exists people_read_visible_or_viewer on public.people;
create policy people_read_visible_or_viewer
on public.people
for select
to anon, authenticated
using (
  visibility = 'public'
  or (select public.can_view_private_genealogy())
);

drop policy if exists relationships_read_visible_or_admin on public.relationships;
drop policy if exists relationships_read_visible_or_viewer on public.relationships;
create policy relationships_read_visible_or_viewer
on public.relationships
for select
to anon, authenticated
using (
  (select public.can_view_private_genealogy())
  or (
    exists (
      select 1
      from public.people source_person
      where source_person.id = source_person_id
        and source_person.visibility = 'public'
    )
    and exists (
      select 1
      from public.people target_person
      where target_person.id = target_person_id
        and target_person.visibility = 'public'
    )
  )
);

drop policy if exists person_layouts_read_visible_or_admin on public.person_layouts;
drop policy if exists person_layouts_read_visible_or_viewer on public.person_layouts;
create policy person_layouts_read_visible_or_viewer
on public.person_layouts
for select
to anon, authenticated
using (
  (select public.can_view_private_genealogy())
  or exists (
    select 1
    from public.people person
    where person.id = person_id
      and person.visibility = 'public'
  )
);

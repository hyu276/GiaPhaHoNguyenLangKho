alter table public.people
add column archived_at timestamptz;

drop policy if exists people_read_visible_or_viewer on public.people;
create policy people_read_visible_or_viewer
on public.people
for select
to anon, authenticated
using (
  public.is_admin()
  or (
    archived_at is null
    and (
      visibility = 'public'
      or (select public.can_view_private_genealogy())
    )
  )
);

drop policy if exists relationships_read_visible_or_viewer on public.relationships;
create policy relationships_read_visible_or_viewer
on public.relationships
for select
to anon, authenticated
using (
  public.is_admin()
  or (
    exists (
      select 1
      from public.people source_person
      where source_person.id = source_person_id
        and source_person.archived_at is null
        and (
          source_person.visibility = 'public'
          or (select public.can_view_private_genealogy())
        )
    )
    and exists (
      select 1
      from public.people target_person
      where target_person.id = target_person_id
        and target_person.archived_at is null
        and (
          target_person.visibility = 'public'
          or (select public.can_view_private_genealogy())
        )
    )
  )
);

drop policy if exists person_layouts_read_visible_or_viewer on public.person_layouts;
create policy person_layouts_read_visible_or_viewer
on public.person_layouts
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.people person
    where person.id = person_id
      and person.archived_at is null
      and (
        person.visibility = 'public'
        or (select public.can_view_private_genealogy())
      )
  )
);

create or replace function public.prevent_archived_relationship_endpoints()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.people person
    where person.id in (new.source_person_id, new.target_person_id)
      and person.archived_at is not null
  ) then
    raise exception 'archived people cannot receive new relationships'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists relationships_prevent_archived_endpoints
on public.relationships;

create trigger relationships_prevent_archived_endpoints
before insert or update of source_person_id, target_person_id
on public.relationships
for each row execute function public.prevent_archived_relationship_endpoints();

drop policy if exists people_admin_delete on public.people;
revoke delete on public.people from authenticated;

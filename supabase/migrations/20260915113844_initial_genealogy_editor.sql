-- Initial vertical slice for the genealogy editor.
-- Canonical genealogy data lives in people + relationships.
-- person_layouts stores presentation coordinates only.

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  birth_year smallint,
  death_year smallint,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_display_name_length check (char_length(btrim(display_name)) between 1 and 120),
  constraint people_visibility check (visibility in ('public', 'private')),
  constraint people_birth_year_range check (birth_year is null or birth_year between 1 and 2200),
  constraint people_death_year_range check (death_year is null or death_year between 1 and 2200),
  constraint people_date_order check (
    birth_year is null or death_year is null or birth_year <= death_year
  )
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  relationship_kind text not null,
  source_person_id uuid not null references public.people(id) on delete restrict,
  target_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationships_kind check (relationship_kind in ('parent_child', 'partnership')),
  constraint relationships_no_self_link check (source_person_id <> target_person_id)
);

create unique index relationships_unique_parent_child
on public.relationships (source_person_id, target_person_id)
where relationship_kind = 'parent_child';

create unique index relationships_unique_partnership
on public.relationships (
  least(source_person_id, target_person_id),
  greatest(source_person_id, target_person_id)
)
where relationship_kind = 'partnership';

create index relationships_source_person_idx
on public.relationships (source_person_id);

create index relationships_target_person_idx
on public.relationships (target_person_id);

create table public.person_layouts (
  person_id uuid primary key references public.people(id) on delete cascade,
  position_x double precision not null,
  position_y double precision not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint person_layouts_position_x_finite check (position_x between -1000000 and 1000000),
  constraint person_layouts_position_y_finite check (position_y between -1000000 and 1000000)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create trigger relationships_set_updated_at
before update on public.relationships
for each row execute function public.set_updated_at();

create or replace function public.prevent_parent_child_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.relationship_kind <> 'parent_child' then
    return new;
  end if;

  if exists (
    with recursive descendants(person_id) as (
      select r.target_person_id
      from public.relationships r
      where r.relationship_kind = 'parent_child'
        and r.source_person_id = new.target_person_id
        and r.id <> new.id

      union

      select r.target_person_id
      from public.relationships r
      join descendants d on r.source_person_id = d.person_id
      where r.relationship_kind = 'parent_child'
        and r.id <> new.id
    )
    select 1
    from descendants
    where person_id = new.source_person_id
  ) then
    raise exception 'parent_child relationship would create an ancestry cycle'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger relationships_prevent_parent_child_cycle
before insert or update of relationship_kind, source_person_id, target_person_id
on public.relationships
for each row execute function public.prevent_parent_child_cycle();

alter table public.people enable row level security;
alter table public.relationships enable row level security;
alter table public.person_layouts enable row level security;

create policy people_read_visible_or_admin
on public.people
for select
using (visibility = 'public' or public.is_admin());

create policy people_admin_insert
on public.people
for insert
to authenticated
with check (public.is_admin());

create policy people_admin_update
on public.people
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy people_admin_delete
on public.people
for delete
to authenticated
using (public.is_admin());

create policy relationships_read_visible_or_admin
on public.relationships
for select
using (
  public.is_admin()
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

create policy relationships_admin_insert
on public.relationships
for insert
to authenticated
with check (public.is_admin());

create policy relationships_admin_update
on public.relationships
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy relationships_admin_delete
on public.relationships
for delete
to authenticated
using (public.is_admin());

create policy person_layouts_read_visible_or_admin
on public.person_layouts
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.people person
    where person.id = person_id
      and person.visibility = 'public'
  )
);

create policy person_layouts_admin_insert
on public.person_layouts
for insert
to authenticated
with check (public.is_admin() and updated_by = auth.uid());

create policy person_layouts_admin_update
on public.person_layouts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin() and updated_by = auth.uid());

create policy person_layouts_admin_delete
on public.person_layouts
for delete
to authenticated
using (public.is_admin());

grant execute on function public.is_admin() to anon, authenticated;
grant select on public.people, public.relationships, public.person_layouts to anon, authenticated;
grant insert, update, delete on public.people, public.relationships, public.person_layouts to authenticated;

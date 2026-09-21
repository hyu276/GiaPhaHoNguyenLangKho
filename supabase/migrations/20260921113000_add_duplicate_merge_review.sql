-- Step 7: controlled duplicate-person merge with an immutable audit trail.
-- No automatic merge exists. The RPC requires an authenticated admin and an
-- explicit target/source pair, then performs all graph rewrites atomically.

alter table public.people
add column merged_into_person_id uuid references public.people(id) on delete restrict,
add column merged_at timestamptz;

alter table public.people
add constraint people_merge_state_pair
check (
  (merged_into_person_id is null and merged_at is null)
  or (merged_into_person_id is not null and merged_at is not null)
);

alter table public.people
add constraint people_merge_not_self
check (merged_into_person_id is null or merged_into_person_id <> id);

create index people_merged_into_person_idx
on public.people (merged_into_person_id)
where merged_into_person_id is not null;

create table public.person_merge_audits (
  id uuid primary key default gen_random_uuid(),
  target_person_id uuid not null references public.people(id) on delete restrict,
  source_person_id uuid not null references public.people(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_snapshot jsonb not null,
  source_snapshot jsonb not null,
  relationship_changes jsonb not null default '[]'::jsonb,
  person_citations_migrated integer not null default 0,
  relationship_citations_migrated integer not null default 0,
  created_at timestamptz not null default now(),
  constraint person_merge_audits_distinct_people
    check (target_person_id <> source_person_id),
  constraint person_merge_audits_person_citation_count
    check (person_citations_migrated >= 0),
  constraint person_merge_audits_relationship_citation_count
    check (relationship_citations_migrated >= 0)
);

create index person_merge_audits_target_idx
on public.person_merge_audits (target_person_id, created_at desc);

create index person_merge_audits_source_idx
on public.person_merge_audits (source_person_id, created_at desc);

alter table public.person_merge_audits enable row level security;

create policy person_merge_audits_admin_select
on public.person_merge_audits
for select
to authenticated
using (public.is_admin());

create policy person_merge_audits_admin_insert
on public.person_merge_audits
for insert
to authenticated
with check (
  public.is_admin()
  and actor_user_id = auth.uid()
);

grant select, insert on public.person_merge_audits to authenticated;

create or replace function public.prevent_merged_person_restore()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.merged_into_person_id is not null and new.archived_at is null then
    raise exception 'merged people cannot be restored'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger people_prevent_merged_restore
before update of archived_at
on public.people
for each row execute function public.prevent_merged_person_restore();

create or replace function public.merge_genealogy_people(
  p_target_person_id uuid,
  p_source_person_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_snapshot jsonb;
  source_snapshot jsonb;
  relationship_row record;
  new_source_person_id uuid;
  new_target_person_id uuid;
  swap_person_id uuid;
  existing_relationship_id uuid;
  relationship_changes jsonb := '[]'::jsonb;
  migrated_person_citations integer := 0;
  migrated_relationship_citations integer := 0;
  migrated_for_relationship integer := 0;
  audit_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  if p_target_person_id = p_source_person_id then
    raise exception 'merge target and source must be distinct'
      using errcode = '23514';
  end if;

  select to_jsonb(person_row)
  into target_snapshot
  from public.people person_row
  where person_row.id = p_target_person_id
    and person_row.archived_at is null
    and person_row.merged_into_person_id is null;

  if target_snapshot is null then
    raise exception 'merge target must be an active unmerged person'
      using errcode = '23514';
  end if;

  select to_jsonb(person_row)
  into source_snapshot
  from public.people person_row
  where person_row.id = p_source_person_id
    and person_row.archived_at is null
    and person_row.merged_into_person_id is null;

  if source_snapshot is null then
    raise exception 'merge source must be an active unmerged person'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.relationships relationship
    where (
      relationship.source_person_id = p_target_person_id
      and relationship.target_person_id = p_source_person_id
    )
    or (
      relationship.source_person_id = p_source_person_id
      and relationship.target_person_id = p_target_person_id
    )
  ) then
    raise exception 'merge blocked by direct relationship between source and target'
      using errcode = '23514';
  end if;

  for relationship_row in
    select relationship.*
    from public.relationships relationship
    where relationship.source_person_id = p_source_person_id
       or relationship.target_person_id = p_source_person_id
    order by relationship.id
  loop
    new_source_person_id := case
      when relationship_row.source_person_id = p_source_person_id
        then p_target_person_id
      else relationship_row.source_person_id
    end;
    new_target_person_id := case
      when relationship_row.target_person_id = p_source_person_id
        then p_target_person_id
      else relationship_row.target_person_id
    end;

    if new_source_person_id = new_target_person_id then
      raise exception 'merge would create a self relationship'
        using errcode = '23514';
    end if;

    if relationship_row.relationship_kind = 'partnership'
       and new_source_person_id::text > new_target_person_id::text then
      swap_person_id := new_source_person_id;
      new_source_person_id := new_target_person_id;
      new_target_person_id := swap_person_id;
    end if;

    existing_relationship_id := null;

    if relationship_row.relationship_kind = 'parent_child' then
      select relationship.id
      into existing_relationship_id
      from public.relationships relationship
      where relationship.id <> relationship_row.id
        and relationship.relationship_kind = 'parent_child'
        and relationship.source_person_id = new_source_person_id
        and relationship.target_person_id = new_target_person_id
      limit 1;
    else
      select relationship.id
      into existing_relationship_id
      from public.relationships relationship
      where relationship.id <> relationship_row.id
        and relationship.relationship_kind = 'partnership'
        and least(
          relationship.source_person_id,
          relationship.target_person_id
        ) = least(new_source_person_id, new_target_person_id)
        and greatest(
          relationship.source_person_id,
          relationship.target_person_id
        ) = greatest(new_source_person_id, new_target_person_id)
      limit 1;
    end if;

    if existing_relationship_id is not null then
      update public.genealogy_citations
      set
        relationship_id = existing_relationship_id,
        updated_by = auth.uid()
      where relationship_id = relationship_row.id;

      get diagnostics migrated_for_relationship = row_count;
      migrated_relationship_citations :=
        migrated_relationship_citations + migrated_for_relationship;

      delete from public.relationships
      where id = relationship_row.id;

      relationship_changes := relationship_changes || jsonb_build_array(
        jsonb_build_object(
          'relationshipId', relationship_row.id,
          'relationshipKind', relationship_row.relationship_kind,
          'action', 'deduplicate',
          'existingRelationshipId', existing_relationship_id,
          'fromSourcePersonId', relationship_row.source_person_id,
          'fromTargetPersonId', relationship_row.target_person_id,
          'toSourcePersonId', new_source_person_id,
          'toTargetPersonId', new_target_person_id
        )
      );
    else
      update public.relationships
      set
        source_person_id = new_source_person_id,
        target_person_id = new_target_person_id
      where id = relationship_row.id;

      relationship_changes := relationship_changes || jsonb_build_array(
        jsonb_build_object(
          'relationshipId', relationship_row.id,
          'relationshipKind', relationship_row.relationship_kind,
          'action', 'migrate',
          'existingRelationshipId', null,
          'fromSourcePersonId', relationship_row.source_person_id,
          'fromTargetPersonId', relationship_row.target_person_id,
          'toSourcePersonId', new_source_person_id,
          'toTargetPersonId', new_target_person_id
        )
      );
    end if;
  end loop;

  update public.genealogy_citations
  set
    person_id = p_target_person_id,
    updated_by = auth.uid()
  where person_id = p_source_person_id;

  get diagnostics migrated_person_citations = row_count;

  update public.people
  set
    archived_at = now(),
    merged_into_person_id = p_target_person_id,
    merged_at = now()
  where id = p_source_person_id;

  insert into public.person_merge_audits (
    target_person_id,
    source_person_id,
    actor_user_id,
    target_snapshot,
    source_snapshot,
    relationship_changes,
    person_citations_migrated,
    relationship_citations_migrated
  )
  values (
    p_target_person_id,
    p_source_person_id,
    auth.uid(),
    target_snapshot,
    source_snapshot,
    relationship_changes,
    migrated_person_citations,
    migrated_relationship_citations
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.merge_genealogy_people(uuid, uuid) from public;
grant execute on function public.merge_genealogy_people(uuid, uuid)
to authenticated;

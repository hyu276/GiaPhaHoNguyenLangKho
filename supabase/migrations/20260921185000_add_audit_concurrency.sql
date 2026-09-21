-- Step 8: system-wide mutation audit, optimistic concurrency, and safe persistent undo.
-- The user called this Step 9; roadmap numbering remains Step 8 to avoid renumbering later steps.

alter table public.people
add column revision bigint not null default 1;

alter table public.relationships
add column revision bigint not null default 1;

alter table public.person_layouts
add column revision bigint not null default 1;

alter table public.genealogy_sources
add column revision bigint not null default 1;

alter table public.genealogy_citations
add column revision bigint not null default 1;

create or replace function public.bump_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  return new;
end;
$$;

create trigger people_bump_revision
before update on public.people
for each row execute function public.bump_revision();

create trigger relationships_bump_revision
before update on public.relationships
for each row execute function public.bump_revision();

create trigger person_layouts_bump_revision
before update on public.person_layouts
for each row execute function public.bump_revision();

create trigger genealogy_sources_bump_revision
before update on public.genealogy_sources
for each row execute function public.bump_revision();

create trigger genealogy_citations_bump_revision
before update on public.genealogy_citations
for each row execute function public.bump_revision();

create trigger person_layouts_set_updated_at
before update on public.person_layouts
for each row execute function public.set_updated_at();

create table public.mutation_audits (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  command text not null,
  entity_table text not null,
  entity_id uuid not null,
  operation text not null,
  before_data jsonb,
  after_data jsonb,
  before_revision bigint,
  after_revision bigint,
  undoable boolean not null default false,
  undo_of_audit_id uuid references public.mutation_audits(id) on delete restrict,
  undone_by_audit_id uuid references public.mutation_audits(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint mutation_audits_entity_table
    check (
      entity_table in (
        'people',
        'relationships',
        'person_layouts',
        'genealogy_sources',
        'genealogy_citations'
      )
    ),
  constraint mutation_audits_operation
    check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  constraint mutation_audits_revision_nonnegative
    check (
      (before_revision is null or before_revision >= 1)
      and (after_revision is null or after_revision >= 1)
    ),
  constraint mutation_audits_distinct_undo_links
    check (
      undo_of_audit_id is null
      or undone_by_audit_id is null
      or undo_of_audit_id <> undone_by_audit_id
    )
);

create index mutation_audits_entity_idx
on public.mutation_audits (entity_table, entity_id, created_at desc);

create index mutation_audits_actor_idx
on public.mutation_audits (actor_user_id, created_at desc);

create index mutation_audits_created_idx
on public.mutation_audits (created_at desc);

alter table public.mutation_audits enable row level security;

create policy mutation_audits_admin_select
on public.mutation_audits
for select
to authenticated
using (public.is_admin());

grant select on public.mutation_audits to authenticated;

create or replace function public.derive_mutation_command(
  p_table text,
  p_operation text,
  p_before jsonb,
  p_after jsonb
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  explicit_command text;
  relationship_kind text;
begin
  explicit_command := nullif(
    current_setting('app.mutation_command', true),
    ''
  );

  if explicit_command is not null then
    return explicit_command;
  end if;

  if p_table = 'people' then
    if p_operation = 'INSERT' then
      return 'create_person';
    end if;

    if p_operation = 'UPDATE' then
      if p_before ->> 'merged_into_person_id' is distinct from
         p_after ->> 'merged_into_person_id' then
        return 'merge_person_source_archive';
      end if;

      if p_before ->> 'archived_at' is null
         and p_after ->> 'archived_at' is not null then
        return 'archive_person';
      end if;

      if p_before ->> 'archived_at' is not null
         and p_after ->> 'archived_at' is null then
        return 'restore_person';
      end if;

      return 'update_person';
    end if;
  end if;

  if p_table = 'relationships' then
    relationship_kind := coalesce(
      p_after ->> 'relationship_kind',
      p_before ->> 'relationship_kind'
    );

    if p_operation = 'INSERT' then
      if relationship_kind = 'parent_child' then
        return 'create_parent_child_relationship';
      end if;
      return 'create_partnership';
    end if;

    if p_operation = 'DELETE' then
      return 'remove_relationship';
    end if;

    return 'update_relationship';
  end if;

  if p_table = 'person_layouts' then
    if p_operation = 'INSERT' then
      return 'create_layout';
    end if;
    if p_operation = 'DELETE' then
      return 'remove_layout';
    end if;
    return 'save_layout';
  end if;

  if p_table = 'genealogy_sources' then
    if p_operation = 'INSERT' then
      return 'create_provenance_source';
    end if;
    if p_operation = 'DELETE' then
      return 'remove_provenance_source';
    end if;
    return 'update_provenance_source';
  end if;

  if p_table = 'genealogy_citations' then
    if p_operation = 'INSERT' then
      return 'create_provenance_citation';
    end if;
    if p_operation = 'DELETE' then
      return 'remove_provenance_citation';
    end if;
    return 'update_provenance_citation';
  end if;

  return lower(p_table || '.' || p_operation);
end;
$$;

create or replace function public.is_mutation_safely_undoable(
  p_table text,
  p_operation text,
  p_before jsonb,
  p_after jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_table = 'people'
      and p_operation = 'UPDATE'
      and (p_before ->> 'merged_into_person_id') is not distinct from
          (p_after ->> 'merged_into_person_id')
      then true
    when p_table = 'relationships'
      and p_operation = 'DELETE'
      then true
    when p_table = 'person_layouts'
      and p_operation in ('INSERT', 'UPDATE', 'DELETE')
      then true
    when p_table = 'genealogy_sources'
      and p_operation = 'UPDATE'
      then true
    when p_table = 'genealogy_citations'
      and p_operation in ('UPDATE', 'DELETE')
      then true
    else false
  end;
$$;

create or replace function public.audit_genealogy_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_snapshot jsonb;
  after_snapshot jsonb;
  entity_id_value uuid;
  before_revision_value bigint;
  after_revision_value bigint;
  undo_of_value uuid;
  command_value text;
  undoable_value boolean;
begin
  before_snapshot := case
    when tg_op = 'INSERT' then null
    else to_jsonb(old)
  end;

  after_snapshot := case
    when tg_op = 'DELETE' then null
    else to_jsonb(new)
  end;

  entity_id_value := coalesce(
    nullif(after_snapshot ->> 'id', '')::uuid,
    nullif(after_snapshot ->> 'person_id', '')::uuid,
    nullif(before_snapshot ->> 'id', '')::uuid,
    nullif(before_snapshot ->> 'person_id', '')::uuid
  );

  before_revision_value := nullif(before_snapshot ->> 'revision', '')::bigint;
  after_revision_value := nullif(after_snapshot ->> 'revision', '')::bigint;

  undo_of_value := nullif(
    current_setting('app.undo_of_audit_id', true),
    ''
  )::uuid;

  command_value := public.derive_mutation_command(
    tg_table_name,
    tg_op,
    before_snapshot,
    after_snapshot
  );

  undoable_value := public.is_mutation_safely_undoable(
    tg_table_name,
    tg_op,
    before_snapshot,
    after_snapshot
  );

  insert into public.mutation_audits (
    actor_user_id,
    command,
    entity_table,
    entity_id,
    operation,
    before_data,
    after_data,
    before_revision,
    after_revision,
    undoable,
    undo_of_audit_id
  )
  values (
    auth.uid(),
    command_value,
    tg_table_name,
    entity_id_value,
    tg_op,
    before_snapshot,
    after_snapshot,
    before_revision_value,
    after_revision_value,
    undoable_value,
    undo_of_value
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_genealogy_mutation() from public;

create trigger people_audit_mutation
after insert or update or delete on public.people
for each row execute function public.audit_genealogy_mutation();

create trigger relationships_audit_mutation
after insert or update or delete on public.relationships
for each row execute function public.audit_genealogy_mutation();

create trigger person_layouts_audit_mutation
after insert or update or delete on public.person_layouts
for each row execute function public.audit_genealogy_mutation();

create trigger genealogy_sources_audit_mutation
after insert or update or delete on public.genealogy_sources
for each row execute function public.audit_genealogy_mutation();

create trigger genealogy_citations_audit_mutation
after insert or update or delete on public.genealogy_citations
for each row execute function public.audit_genealogy_mutation();

create or replace function public.undo_genealogy_mutation(
  p_audit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_row public.mutation_audits%rowtype;
  undo_audit_id uuid;
  current_revision bigint;
  before_json jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  select *
  into audit_row
  from public.mutation_audits
  where id = p_audit_id
  for update;

  if not found then
    raise exception 'audit entry not found'
      using errcode = 'P0002';
  end if;

  if not audit_row.undoable then
    raise exception 'mutation is not safely undoable'
      using errcode = '23514';
  end if;

  if audit_row.undone_by_audit_id is not null then
    raise exception 'mutation has already been undone'
      using errcode = '23514';
  end if;

  perform set_config(
    'app.mutation_command',
    'undo:' || audit_row.command,
    true
  );
  perform set_config(
    'app.undo_of_audit_id',
    audit_row.id::text,
    true
  );

  before_json := audit_row.before_data;

  if audit_row.entity_table = 'people'
     and audit_row.operation = 'UPDATE' then
    select revision
    into current_revision
    from public.people
    where id = audit_row.entity_id;

    if current_revision is distinct from audit_row.after_revision then
      raise exception 'stale revision; entity changed after audited mutation'
        using errcode = '40001';
    end if;

    update public.people
    set
      display_name = before_json ->> 'display_name',
      description = before_json ->> 'description',
      birth_year = nullif(before_json ->> 'birth_year', '')::smallint,
      death_year = nullif(before_json ->> 'death_year', '')::smallint,
      sex = before_json ->> 'sex',
      visibility = before_json ->> 'visibility',
      archived_at = nullif(before_json ->> 'archived_at', '')::timestamptz
    where id = audit_row.entity_id
      and revision = audit_row.after_revision;

  elsif audit_row.entity_table = 'relationships'
        and audit_row.operation = 'DELETE' then
    insert into public.relationships (
      id,
      relationship_kind,
      source_person_id,
      target_person_id,
      created_at,
      updated_at,
      revision
    )
    values (
      audit_row.entity_id,
      before_json ->> 'relationship_kind',
      (before_json ->> 'source_person_id')::uuid,
      (before_json ->> 'target_person_id')::uuid,
      (before_json ->> 'created_at')::timestamptz,
      now(),
      coalesce(audit_row.before_revision, 1) + 1
    );

  elsif audit_row.entity_table = 'person_layouts'
        and audit_row.operation = 'UPDATE' then
    update public.person_layouts
    set
      position_x = (before_json ->> 'position_x')::double precision,
      position_y = (before_json ->> 'position_y')::double precision,
      updated_by = auth.uid()
    where person_id = audit_row.entity_id
      and revision = audit_row.after_revision;

    if not found then
      raise exception 'stale revision; layout changed after audited mutation'
        using errcode = '40001';
    end if;

  elsif audit_row.entity_table = 'person_layouts'
        and audit_row.operation = 'INSERT' then
    delete from public.person_layouts
    where person_id = audit_row.entity_id
      and revision = audit_row.after_revision;

    if not found then
      raise exception 'stale revision; layout changed after audited mutation'
        using errcode = '40001';
    end if;

  elsif audit_row.entity_table = 'person_layouts'
        and audit_row.operation = 'DELETE' then
    insert into public.person_layouts (
      person_id,
      position_x,
      position_y,
      updated_at,
      updated_by,
      revision
    )
    values (
      audit_row.entity_id,
      (before_json ->> 'position_x')::double precision,
      (before_json ->> 'position_y')::double precision,
      now(),
      auth.uid(),
      coalesce(audit_row.before_revision, 1) + 1
    );

  elsif audit_row.entity_table = 'genealogy_sources'
        and audit_row.operation = 'UPDATE' then
    update public.genealogy_sources
    set
      title = before_json ->> 'title',
      source_type = before_json ->> 'source_type',
      repository_name = before_json ->> 'repository_name',
      reference_code = before_json ->> 'reference_code',
      source_url = before_json ->> 'source_url',
      updated_by = auth.uid()
    where id = audit_row.entity_id
      and revision = audit_row.after_revision;

    if not found then
      raise exception 'stale revision; source changed after audited mutation'
        using errcode = '40001';
    end if;

  elsif audit_row.entity_table = 'genealogy_citations'
        and audit_row.operation = 'UPDATE' then
    update public.genealogy_citations
    set
      source_id = (before_json ->> 'source_id')::uuid,
      person_id = nullif(before_json ->> 'person_id', '')::uuid,
      relationship_id = nullif(before_json ->> 'relationship_id', '')::uuid,
      claim_kind = before_json ->> 'claim_kind',
      claim_text = before_json ->> 'claim_text',
      citation_locator = before_json ->> 'citation_locator',
      note = before_json ->> 'note',
      certainty = before_json ->> 'certainty',
      date_text = before_json ->> 'date_text',
      date_qualifier = before_json ->> 'date_qualifier',
      updated_by = auth.uid()
    where id = audit_row.entity_id
      and revision = audit_row.after_revision;

    if not found then
      raise exception 'stale revision; citation changed after audited mutation'
        using errcode = '40001';
    end if;

  elsif audit_row.entity_table = 'genealogy_citations'
        and audit_row.operation = 'DELETE' then
    insert into public.genealogy_citations (
      id,
      source_id,
      person_id,
      relationship_id,
      claim_kind,
      claim_text,
      citation_locator,
      note,
      certainty,
      date_text,
      date_qualifier,
      created_at,
      updated_at,
      created_by,
      updated_by,
      revision
    )
    values (
      audit_row.entity_id,
      (before_json ->> 'source_id')::uuid,
      nullif(before_json ->> 'person_id', '')::uuid,
      nullif(before_json ->> 'relationship_id', '')::uuid,
      before_json ->> 'claim_kind',
      before_json ->> 'claim_text',
      before_json ->> 'citation_locator',
      before_json ->> 'note',
      before_json ->> 'certainty',
      before_json ->> 'date_text',
      before_json ->> 'date_qualifier',
      (before_json ->> 'created_at')::timestamptz,
      now(),
      nullif(before_json ->> 'created_by', '')::uuid,
      auth.uid(),
      coalesce(audit_row.before_revision, 1) + 1
    );

  else
    raise exception 'no safe inverse is defined for this mutation'
      using errcode = '23514';
  end if;

  select id
  into undo_audit_id
  from public.mutation_audits
  where undo_of_audit_id = audit_row.id
  order by created_at desc
  limit 1;

  if undo_audit_id is null then
    raise exception 'undo audit entry was not recorded'
      using errcode = 'P0001';
  end if;

  update public.mutation_audits
  set undone_by_audit_id = undo_audit_id
  where id = audit_row.id;

  return undo_audit_id;
end;
$$;

revoke all on function public.undo_genealogy_mutation(uuid) from public;
grant execute on function public.undo_genealogy_mutation(uuid)
to authenticated;

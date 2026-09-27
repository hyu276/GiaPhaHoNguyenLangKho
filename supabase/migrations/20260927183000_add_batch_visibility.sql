-- Step 10: atomic batch visibility updates with optimistic concurrency.
-- This migration is committed for release preparation only and is not applied to production here.

create or replace function public.set_people_visibility_if_current(
  p_changes jsonb
)
returns table(person_id uuid, revision bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  item_person_id uuid;
  item_expected_revision bigint;
  item_visibility text;
  affected integer;
begin
  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_changes) < 1
     or jsonb_array_length(p_changes) > 500 then
    raise exception 'visibility batch must contain between 1 and 500 items'
      using errcode = '22023';
  end if;

  perform set_config('app.mutation_command', 'batch_visibility', true);

  for item in select * from jsonb_array_elements(p_changes)
  loop
    item_person_id := (item ->> 'personId')::uuid;
    item_expected_revision := (item ->> 'expectedRevision')::bigint;
    item_visibility := item ->> 'targetVisibility';

    if item_visibility not in ('public', 'private') then
      raise exception 'invalid visibility'
        using errcode = '22023';
    end if;

    update public.people
    set visibility = item_visibility
    where id = item_person_id
      and revision = item_expected_revision
      and archived_at is null
      and merged_into_person_id is null;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'stale person revision'
        using errcode = '40001';
    end if;

    return query
    select person.id, person.revision
    from public.people person
    where person.id = item_person_id;
  end loop;
end;
$$;

revoke all on function public.set_people_visibility_if_current(jsonb) from public;
grant execute on function public.set_people_visibility_if_current(jsonb)
to authenticated;

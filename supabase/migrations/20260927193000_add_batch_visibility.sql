-- Step 10: atomic batch visibility updates with optimistic concurrency.

create or replace function public.set_people_visibility_if_current(
  p_visibility text,
  p_people jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  person_id_value uuid;
  expected_revision_value bigint;
  current_revision_value bigint;
  next_revision_value bigint;
  result jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;

  if jsonb_typeof(p_people) <> 'array'
     or jsonb_array_length(p_people) < 1
     or jsonb_array_length(p_people) > 500 then
    raise exception 'invalid batch size' using errcode = '22023';
  end if;

  perform set_config('app.mutation_command', 'batch_visibility', true);

  for item in select value from jsonb_array_elements(p_people)
  loop
    person_id_value := (item ->> 'personId')::uuid;
    expected_revision_value := (item ->> 'expectedRevision')::bigint;

    select revision
      into current_revision_value
      from public.people
      where id = person_id_value
        and archived_at is null
        and merged_into_person_id is null
      for update;

    if current_revision_value is null then
      raise exception 'person not active unmerged'
        using errcode = 'P0001';
    end if;

    if current_revision_value <> expected_revision_value then
      raise exception 'stale person revision'
        using errcode = '40001';
    end if;

    update public.people
      set visibility = p_visibility
      where id = person_id_value
      returning revision into next_revision_value;

    result := result || jsonb_build_array(
      jsonb_build_object(
        'person_id', person_id_value,
        'revision', next_revision_value
      )
    );
  end loop;

  return result;
end;
$$;

revoke all on function public.set_people_visibility_if_current(text, jsonb)
from public;

grant execute on function public.set_people_visibility_if_current(text, jsonb)
to authenticated;

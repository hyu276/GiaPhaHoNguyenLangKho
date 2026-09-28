-- Step 10: controlled batch visibility updates with optimistic concurrency.

create or replace function public.batch_set_people_visibility_if_current(
  p_items jsonb,
  p_visibility text
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
  result_rows jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'invalid visibility'
      using errcode = '23514';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 500 then
    raise exception 'batch visibility items must contain 1 to 500 rows'
      using errcode = '22023';
  end if;

  perform set_config('app.mutation_command', 'batch_set_visibility', true);

  for item in
    select value
    from jsonb_array_elements(p_items)
  loop
    person_id_value := nullif(item ->> 'personId', '')::uuid;
    expected_revision_value := nullif(
      item ->> 'expectedRevision',
      ''
    )::bigint;

    if person_id_value is null or expected_revision_value is null then
      raise exception 'personId and expectedRevision are required'
        using errcode = '22023';
    end if;

    select p.revision
    into current_revision_value
    from public.people p
    where p.id = person_id_value
      and p.archived_at is null
      and p.merged_into_person_id is null
    for update;

    if not found then
      raise exception 'person is not active and unmerged'
        using errcode = '23514';
    end if;

    if current_revision_value <> expected_revision_value then
      raise exception 'stale person revision'
        using errcode = '40001';
    end if;

    update public.people
    set visibility = p_visibility
    where id = person_id_value
    returning revision into current_revision_value;

    result_rows := result_rows || jsonb_build_array(
      jsonb_build_object(
        'person_id', person_id_value,
        'revision', current_revision_value
      )
    );
  end loop;

  return result_rows;
end;
$$;

revoke all on function public.batch_set_people_visibility_if_current(
  jsonb,
  text
) from public;
grant execute on function public.batch_set_people_visibility_if_current(
  jsonb,
  text
) to authenticated;

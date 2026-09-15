-- Synthetic development data only. Do not place private family data in this file.

insert into public.people (id, display_name, birth_year, death_year, visibility)
values
  ('10000000-0000-0000-0000-000000000001', 'Nguyễn Văn Tổ', 1902, 1978, 'public'),
  ('10000000-0000-0000-0000-000000000002', 'Nguyễn Thị An', 1908, 1987, 'public'),
  ('10000000-0000-0000-0000-000000000003', 'Nguyễn Văn Bình', 1932, 2004, 'public'),
  ('10000000-0000-0000-0000-000000000004', 'Nguyễn Văn Cường', 1958, null, 'public')
on conflict (id) do nothing;

insert into public.relationships (
  id,
  relationship_kind,
  source_person_id,
  target_person_id
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'partnership',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'parent_child',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'parent_child',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'parent_child',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004'
  )
on conflict (id) do nothing;

insert into public.person_layouts (person_id, position_x, position_y)
values
  ('10000000-0000-0000-0000-000000000001', 80, 80),
  ('10000000-0000-0000-0000-000000000002', 360, 80),
  ('10000000-0000-0000-0000-000000000003', 220, 280),
  ('10000000-0000-0000-0000-000000000004', 220, 500)
on conflict (person_id) do nothing;

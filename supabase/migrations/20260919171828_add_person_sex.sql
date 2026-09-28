alter table public.people
add column sex text;

alter table public.people
add constraint people_sex
check (sex is null or sex in ('male', 'female'));

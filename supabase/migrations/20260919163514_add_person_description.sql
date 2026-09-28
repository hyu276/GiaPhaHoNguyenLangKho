alter table public.people
add column description text;

alter table public.people
add constraint people_description_length
check (description is null or char_length(description) <= 2000);

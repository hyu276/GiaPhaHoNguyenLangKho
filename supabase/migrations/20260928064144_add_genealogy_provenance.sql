-- Add normalized genealogy provenance without changing canonical person/relationship facts.
-- Approximate or disputed claims live in citations and never coerce exact person year fields.

create table public.genealogy_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null,
  repository_name text,
  reference_code text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint genealogy_sources_title_length
    check (char_length(btrim(title)) between 1 and 200),
  constraint genealogy_sources_type
    check (
      source_type in (
        'family_book',
        'civil_record',
        'archive',
        'oral_history',
        'photo',
        'publication',
        'web',
        'other'
      )
    ),
  constraint genealogy_sources_repository_length
    check (repository_name is null or char_length(repository_name) <= 200),
  constraint genealogy_sources_reference_length
    check (reference_code is null or char_length(reference_code) <= 200),
  constraint genealogy_sources_url_length
    check (source_url is null or char_length(source_url) <= 2048),
  constraint genealogy_sources_url_scheme
    check (source_url is null or source_url ~* '^https?://')
);

create table public.genealogy_citations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.genealogy_sources(id) on delete restrict,
  person_id uuid references public.people(id) on delete restrict,
  relationship_id uuid references public.relationships(id) on delete restrict,
  claim_kind text not null,
  claim_text text not null,
  citation_locator text,
  note text,
  certainty text not null default 'unknown',
  date_text text,
  date_qualifier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint genealogy_citations_exactly_one_target
    check (
      (person_id is not null and relationship_id is null)
      or (person_id is null and relationship_id is not null)
    ),
  constraint genealogy_citations_claim_kind
    check (
      claim_kind in (
        'identity',
        'birth',
        'death',
        'relationship',
        'residence',
        'occupation',
        'note',
        'other'
      )
    ),
  constraint genealogy_citations_claim_text_length
    check (char_length(btrim(claim_text)) between 1 and 2000),
  constraint genealogy_citations_locator_length
    check (citation_locator is null or char_length(citation_locator) <= 240),
  constraint genealogy_citations_note_length
    check (note is null or char_length(note) <= 2000),
  constraint genealogy_citations_certainty
    check (certainty in ('certain', 'probable', 'possible', 'unknown')),
  constraint genealogy_citations_date_text_length
    check (date_text is null or char_length(date_text) <= 80),
  constraint genealogy_citations_date_qualifier
    check (
      date_qualifier is null
      or date_qualifier in ('exact', 'about', 'before', 'after', 'range', 'unknown')
    ),
  constraint genealogy_citations_date_pair
    check (
      (date_text is null and date_qualifier is null)
      or (date_text is not null and date_qualifier is not null)
    )
);

create index genealogy_citations_source_idx
on public.genealogy_citations (source_id);

create index genealogy_citations_person_idx
on public.genealogy_citations (person_id)
where person_id is not null;

create index genealogy_citations_relationship_idx
on public.genealogy_citations (relationship_id)
where relationship_id is not null;

create trigger genealogy_sources_set_updated_at
before update on public.genealogy_sources
for each row execute function public.set_updated_at();

create trigger genealogy_citations_set_updated_at
before update on public.genealogy_citations
for each row execute function public.set_updated_at();

alter table public.genealogy_sources enable row level security;
alter table public.genealogy_citations enable row level security;

create policy genealogy_citations_read_visible_or_admin
on public.genealogy_citations
for select
to anon, authenticated
using (
  public.is_admin()
  or (
    person_id is not null
    and exists (
      select 1
      from public.people person
      where person.id = genealogy_citations.person_id
    )
  )
  or (
    relationship_id is not null
    and exists (
      select 1
      from public.relationships relationship
      where relationship.id = genealogy_citations.relationship_id
    )
  )
);

create policy genealogy_sources_read_visible_or_admin
on public.genealogy_sources
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.genealogy_citations citation
    where citation.source_id = genealogy_sources.id
  )
);

create policy genealogy_sources_admin_insert
on public.genealogy_sources
for insert
to authenticated
with check (
  public.is_admin()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy genealogy_sources_admin_update
on public.genealogy_sources
for update
to authenticated
using (public.is_admin())
with check (public.is_admin() and updated_by = auth.uid());

create policy genealogy_citations_admin_insert
on public.genealogy_citations
for insert
to authenticated
with check (
  public.is_admin()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy genealogy_citations_admin_update
on public.genealogy_citations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin() and updated_by = auth.uid());

create policy genealogy_citations_admin_delete
on public.genealogy_citations
for delete
to authenticated
using (public.is_admin());

grant select on public.genealogy_sources, public.genealogy_citations
to anon, authenticated;

grant insert, update on public.genealogy_sources
to authenticated;

grant insert, update, delete on public.genealogy_citations
to authenticated;

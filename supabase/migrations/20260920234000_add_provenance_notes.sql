-- Step 6: genealogical notes, sources, citations, and uncertainty.
-- Canonical people/relationships remain unchanged. Conflicting or approximate claims
-- live here so uncertain evidence never fabricates or overwrites canonical facts.

create table public.genealogy_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'other',
  author text,
  repository text,
  reference_code text,
  publication_text text,
  url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint genealogy_sources_title_length
    check (char_length(btrim(title)) between 1 and 300),
  constraint genealogy_sources_type
    check (source_type in (
      'document',
      'book',
      'archive',
      'oral_history',
      'website',
      'photo',
      'other'
    )),
  constraint genealogy_sources_author_length
    check (author is null or char_length(author) <= 200),
  constraint genealogy_sources_repository_length
    check (repository is null or char_length(repository) <= 200),
  constraint genealogy_sources_reference_code_length
    check (reference_code is null or char_length(reference_code) <= 120),
  constraint genealogy_sources_publication_text_length
    check (publication_text is null or char_length(publication_text) <= 120),
  constraint genealogy_sources_url_length
    check (url is null or char_length(url) <= 2000),
  constraint genealogy_sources_notes_length
    check (notes is null or char_length(notes) <= 2000)
);

create table public.provenance_entries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  relationship_id uuid references public.relationships(id) on delete cascade,
  source_id uuid references public.genealogy_sources(id) on delete restrict,
  entry_kind text not null,
  field_key text,
  claim_text text,
  locator text,
  note_text text,
  certainty text not null default 'uncertain',
  date_qualifier text not null default 'not_applicable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint provenance_entries_exactly_one_subject
    check ((person_id is not null) <> (relationship_id is not null)),
  constraint provenance_entries_kind
    check (entry_kind in ('citation', 'note')),
  constraint provenance_entries_field_key_length
    check (field_key is null or char_length(field_key) <= 80),
  constraint provenance_entries_claim_length
    check (claim_text is null or char_length(claim_text) <= 2000),
  constraint provenance_entries_locator_length
    check (locator is null or char_length(locator) <= 300),
  constraint provenance_entries_note_length
    check (note_text is null or char_length(note_text) <= 4000),
  constraint provenance_entries_certainty
    check (certainty in ('certain', 'probable', 'possible', 'uncertain')),
  constraint provenance_entries_date_qualifier
    check (date_qualifier in (
      'not_applicable',
      'exact',
      'about',
      'before',
      'after',
      'between',
      'unknown'
    )),
  constraint provenance_entries_citation_shape
    check (
      entry_kind <> 'citation'
      or (
        source_id is not null
        and claim_text is not null
        and char_length(btrim(claim_text)) between 1 and 2000
      )
    ),
  constraint provenance_entries_note_shape
    check (
      entry_kind <> 'note'
      or (
        source_id is null
        and note_text is not null
        and char_length(btrim(note_text)) between 1 and 4000
      )
    )
);

create index provenance_entries_person_idx
on public.provenance_entries (person_id)
where person_id is not null;

create index provenance_entries_relationship_idx
on public.provenance_entries (relationship_id)
where relationship_id is not null;

create index provenance_entries_source_idx
on public.provenance_entries (source_id)
where source_id is not null;

create trigger genealogy_sources_set_updated_at
before update on public.genealogy_sources
for each row execute function public.set_updated_at();

create trigger provenance_entries_set_updated_at
before update on public.provenance_entries
for each row execute function public.set_updated_at();

alter table public.genealogy_sources enable row level security;
alter table public.provenance_entries enable row level security;

create policy genealogy_sources_viewer_select
on public.genealogy_sources
for select
to authenticated
using ((select public.can_view_private_genealogy()));

create policy genealogy_sources_admin_insert
on public.genealogy_sources
for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy genealogy_sources_admin_update
on public.genealogy_sources
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy genealogy_sources_admin_delete
on public.genealogy_sources
for delete
to authenticated
using (public.is_admin());

create policy provenance_entries_viewer_select
on public.provenance_entries
for select
to authenticated
using ((select public.can_view_private_genealogy()));

create policy provenance_entries_admin_insert
on public.provenance_entries
for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy provenance_entries_admin_update
on public.provenance_entries
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy provenance_entries_admin_delete
on public.provenance_entries
for delete
to authenticated
using (public.is_admin());

grant select on public.genealogy_sources, public.provenance_entries
to authenticated;

grant insert, update, delete on public.genealogy_sources, public.provenance_entries
to authenticated;

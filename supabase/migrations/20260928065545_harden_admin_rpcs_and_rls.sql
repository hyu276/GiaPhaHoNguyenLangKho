revoke execute on function public.audit_genealogy_mutation() from anon, authenticated;
revoke execute on function public.undo_genealogy_mutation(uuid) from anon;

alter function public.batch_set_people_visibility_if_current(jsonb, text)
security invoker;
revoke execute on function public.batch_set_people_visibility_if_current(jsonb, text) from anon;
grant execute on function public.batch_set_people_visibility_if_current(jsonb, text) to authenticated;

alter policy genealogy_sources_admin_insert
on public.genealogy_sources
with check (
  (select public.is_admin())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

alter policy genealogy_sources_admin_update
on public.genealogy_sources
using ((select public.is_admin()))
with check (
  (select public.is_admin())
  and updated_by = (select auth.uid())
);

alter policy genealogy_citations_admin_insert
on public.genealogy_citations
with check (
  (select public.is_admin())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

alter policy genealogy_citations_admin_update
on public.genealogy_citations
using ((select public.is_admin()))
with check (
  (select public.is_admin())
  and updated_by = (select auth.uid())
);

alter policy person_merge_audits_admin_insert
on public.person_merge_audits
with check (
  (select public.is_admin())
  and actor_user_id = (select auth.uid())
);

create index if not exists genealogy_citations_created_by_idx
  on public.genealogy_citations(created_by);
create index if not exists genealogy_citations_updated_by_idx
  on public.genealogy_citations(updated_by);
create index if not exists genealogy_sources_created_by_idx
  on public.genealogy_sources(created_by);
create index if not exists genealogy_sources_updated_by_idx
  on public.genealogy_sources(updated_by);
create index if not exists mutation_audits_undo_of_idx
  on public.mutation_audits(undo_of_audit_id);
create index if not exists mutation_audits_undone_by_idx
  on public.mutation_audits(undone_by_audit_id);
create index if not exists person_merge_audits_actor_idx
  on public.person_merge_audits(actor_user_id);

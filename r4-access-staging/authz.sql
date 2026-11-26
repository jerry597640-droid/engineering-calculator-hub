-- Run only in the existing engineering-tools-access-staging Supabase project.
-- This table contains ONLY R4 pilot access. Do not change existing ech_* records.
begin;
create table if not exists public.xj_r4_staging_project_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_code text not null check (project_code in ('R4-DEMO-A','R4-DEMO-B')),
  role text not null check (role in ('viewer','admin')),
  primary key (user_id, project_code)
);
alter table public.xj_r4_staging_project_grants enable row level security;
revoke all on table public.xj_r4_staging_project_grants from public, anon, authenticated;
grant select on table public.xj_r4_staging_project_grants to authenticated;
drop policy if exists r4_pilot_read_own_after_mfa on public.xj_r4_staging_project_grants;
create policy r4_pilot_read_own_after_mfa on public.xj_r4_staging_project_grants for select to authenticated using (
  (select auth.uid()) = user_id and
  (select auth.jwt() ->> 'aal') = 'aal2' and
  (select coalesce(auth.jwt() ->> 'is_anonymous', 'false')) = 'false'
);
notify pgrst, 'reload schema';
commit;

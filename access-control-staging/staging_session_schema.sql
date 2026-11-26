-- Require a live Supabase session for every protected tool request.
-- Account / grant revocation is already enforced by the existing RLS policy.
create function ech_private.active_session()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null and exists (
      select 1 from auth.sessions s
      where s.user_id = auth.uid()
        and s.id::text = (auth.jwt()->>'session_id')
        and (s.not_after is null or s.not_after > now())
    ), false
  )
$$;
revoke all on function ech_private.active_session() from public, anon, authenticated;
grant execute on function ech_private.active_session() to authenticated;

alter policy ech_tools_read_authorized on public.ech_tools using (
  enabled and (select ech_private.active_session()) and exists (
    select 1 from public.ech_tool_permissions g
    join public.ech_user_profiles p on p.user_id = g.user_id
    where g.tool_id = ech_tools.tool_id and g.user_id = (select auth.uid())
      and p.status = 'approved' and (p.expires_at is null or p.expires_at > now())
      and g.allowed and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
  )
);

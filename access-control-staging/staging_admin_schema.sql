-- Staging only: administrative RPCs require an active database session,
-- an approved administrator profile, and an MFA-authenticated JWT.
grant usage on schema ech_private to authenticated;

create function ech_private.assert_admin(owner_only boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  session_text text := auth.jwt()->>'session_id';
begin
  if caller_id is null or (auth.jwt()->>'aal') is distinct from 'aal2'
     or session_text is null
     or session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'administrative access denied' using errcode='42501'; end if;
  if not exists (
    select 1 from auth.sessions s where s.id = session_text::uuid
      and s.user_id = caller_id and (s.not_after is null or s.not_after > now())
  ) then raise exception 'administrative access denied' using errcode='42501'; end if;
  select p.role into caller_role from public.ech_user_profiles p
  where p.user_id=caller_id and p.status='approved' and (p.expires_at is null or p.expires_at>now())
  for share;
  if caller_role is null or caller_role not in ('owner','admin') or (owner_only and caller_role <> 'owner')
  then raise exception 'administrative access denied' using errcode='42501'; end if;
  return caller_id;
end $$;
revoke all on function ech_private.assert_admin(boolean) from public, anon, authenticated;

create function ech_private.admin_users(page_size integer,page_offset integer)
returns table(user_id uuid,email text,display_name text,role text,status text,expires_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  perform ech_private.assert_admin(false);
  if page_size is null or page_size < 1 or page_size > 100 or page_offset is null or page_offset < 0 or page_offset > 100000
  then raise exception 'invalid pagination' using errcode='22023'; end if;
  return query select p.user_id,u.email::text,p.display_name,p.role,p.status,p.expires_at,p.created_at
    from public.ech_user_profiles p join auth.users u on u.id=p.user_id
    order by p.created_at desc, p.user_id limit page_size offset page_offset;
end $$;

create function ech_private.admin_permissions(target uuid)
returns table(tool_id text,name text,enabled boolean,allowed boolean,valid_from timestamptz,valid_until timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := ech_private.assert_admin(false);
  actor_role text;
  target_role text;
begin
  select p.role into actor_role from public.ech_user_profiles p where p.user_id=actor;
  select p.role into target_role from public.ech_user_profiles p where p.user_id=target;
  if not found then raise exception 'unknown target' using errcode='22023'; end if;
  if actor_role='admin' and target_role <> 'user'
  then raise exception 'administrative access denied' using errcode='42501'; end if;
  return query select t.tool_id,t.name,t.enabled,coalesce(g.allowed,false),g.valid_from,g.valid_until
    from public.ech_tools t left join public.ech_tool_permissions g on g.tool_id=t.tool_id and g.user_id=target
    order by t.name,t.tool_id;
end $$;

create function ech_private.admin_audit(page_size integer,page_offset integer)
returns table(id bigint,actor_id uuid,action text,target_user_id uuid,target_tool_id text,detail jsonb,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  perform ech_private.assert_admin(true);
  if page_size is null or page_size < 1 or page_size > 100 or page_offset is null or page_offset < 0 or page_offset > 100000
  then raise exception 'invalid pagination' using errcode='22023'; end if;
  return query select a.id,a.actor_id,a.action,a.target_user_id,a.target_tool_id,a.detail,a.created_at
    from public.ech_admin_audit a order by a.created_at desc,a.id desc limit page_size offset page_offset;
end $$;

create function ech_private.admin_set_status(target uuid,new_status text,new_expiry timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := ech_private.assert_admin(false);
  actor_role text;
  old_row public.ech_user_profiles%rowtype;
begin
  if target is null or target=actor or new_status is null or new_status not in ('pending','approved','disabled')
  then raise exception 'invalid target or status' using errcode='22023'; end if;
  select p.role into actor_role from public.ech_user_profiles p where p.user_id=actor;
  select * into old_row from public.ech_user_profiles p where p.user_id=target for update;
  if not found then raise exception 'unknown target' using errcode='22023'; end if;
  if actor_role='admin' and old_row.role <> 'user'
  then raise exception 'administrative access denied' using errcode='42501'; end if;
  update public.ech_user_profiles set status=new_status,expires_at=new_expiry,updated_at=now() where user_id=target;
  insert into public.ech_admin_audit(actor_id,action,target_user_id,detail)
    values(actor,'set_status',target,jsonb_build_object('old_status',old_row.status,'new_status',new_status,'old_expiry',old_row.expires_at,'new_expiry',new_expiry));
end $$;

create function ech_private.admin_set_role(target uuid,new_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := ech_private.assert_admin(true);
  old_row public.ech_user_profiles%rowtype;
begin
  if target is null or target=actor or new_role is null or new_role not in ('user','admin','owner')
  then raise exception 'invalid target or role' using errcode='22023'; end if;
  select * into old_row from public.ech_user_profiles p where p.user_id=target for update;
  if not found then raise exception 'unknown target' using errcode='22023'; end if;
  if new_role in ('admin','owner') and (old_row.status <> 'approved' or (old_row.expires_at is not null and old_row.expires_at<=now()))
  then raise exception 'management account must be active' using errcode='22023'; end if;
  update public.ech_user_profiles set role=new_role,updated_at=now() where user_id=target;
  insert into public.ech_admin_audit(actor_id,action,target_user_id,detail)
    values(actor,'set_role',target,jsonb_build_object('old_role',old_row.role,'new_role',new_role));
end $$;

create function ech_private.admin_set_permission(target uuid,requested_tool text,new_allowed boolean,new_valid_from timestamptz,new_valid_until timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := ech_private.assert_admin(false);
  actor_role text;
  target_role text;
  old_row public.ech_tool_permissions%rowtype;
  actual_start timestamptz := coalesce(new_valid_from,now());
begin
  if target is null or requested_tool is null or new_allowed is null
     or (new_valid_until is not null and new_valid_until<=actual_start)
  then raise exception 'invalid permission' using errcode='22023'; end if;
  select p.role into actor_role from public.ech_user_profiles p where p.user_id=actor;
  select p.role into target_role from public.ech_user_profiles p where p.user_id=target for update;
  if not found then raise exception 'unknown target' using errcode='22023'; end if;
  if actor_role='admin' and (target_role <> 'user' or target=actor)
  then raise exception 'administrative access denied' using errcode='42501'; end if;
  if not exists(select 1 from public.ech_tools t where t.tool_id=requested_tool)
  then raise exception 'unknown tool' using errcode='22023'; end if;
  select * into old_row from public.ech_tool_permissions p where p.user_id=target and p.tool_id=requested_tool for update;
  insert into public.ech_tool_permissions(user_id,tool_id,allowed,valid_from,valid_until,granted_by)
    values(target,requested_tool,new_allowed,actual_start,new_valid_until,actor)
  on conflict(user_id,tool_id) do update set allowed=excluded.allowed,valid_from=excluded.valid_from,
    valid_until=excluded.valid_until,granted_by=excluded.granted_by,updated_at=now();
  insert into public.ech_admin_audit(actor_id,action,target_user_id,target_tool_id,detail)
    values(actor,'set_permission',target,requested_tool,jsonb_build_object(
      'old_allowed',old_row.allowed,'new_allowed',new_allowed,'valid_from',actual_start,'valid_until',new_valid_until));
end $$;

revoke all on function ech_private.admin_users(integer,integer), ech_private.admin_permissions(uuid), ech_private.admin_audit(integer,integer),
  ech_private.admin_set_status(uuid,text,timestamptz), ech_private.admin_set_role(uuid,text),
  ech_private.admin_set_permission(uuid,text,boolean,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function ech_private.admin_users(integer,integer), ech_private.admin_permissions(uuid), ech_private.admin_audit(integer,integer),
  ech_private.admin_set_status(uuid,text,timestamptz), ech_private.admin_set_role(uuid,text),
  ech_private.admin_set_permission(uuid,text,boolean,timestamptz,timestamptz) to authenticated;

-- Invoker wrappers expose only the five explicitly authorized operations.
create function public.ech_admin_users(page_size integer default 50,page_offset integer default 0)
returns table(user_id uuid,email text,display_name text,role text,status text,expires_at timestamptz,created_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from ech_private.admin_users(page_size,page_offset) $$;
create function public.ech_admin_permissions(target uuid)
returns table(tool_id text,name text,enabled boolean,allowed boolean,valid_from timestamptz,valid_until timestamptz)
language sql security invoker set search_path = '' as $$ select * from ech_private.admin_permissions(target) $$;
create function public.ech_admin_audit(page_size integer default 50,page_offset integer default 0)
returns table(id bigint,actor_id uuid,action text,target_user_id uuid,target_tool_id text,detail jsonb,created_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from ech_private.admin_audit(page_size,page_offset) $$;
create function public.ech_admin_set_status(target uuid,new_status text,new_expiry timestamptz)
returns void language sql security invoker set search_path = '' as $$ select ech_private.admin_set_status(target,new_status,new_expiry) $$;
create function public.ech_admin_set_role(target uuid,new_role text)
returns void language sql security invoker set search_path = '' as $$ select ech_private.admin_set_role(target,new_role) $$;
create function public.ech_admin_set_permission(target uuid,requested_tool text,new_allowed boolean,new_valid_from timestamptz,new_valid_until timestamptz)
returns void language sql security invoker set search_path = '' as $$ select ech_private.admin_set_permission(target,requested_tool,new_allowed,new_valid_from,new_valid_until) $$;
revoke all on function public.ech_admin_users(integer,integer), public.ech_admin_permissions(uuid), public.ech_admin_audit(integer,integer),
  public.ech_admin_set_status(uuid,text,timestamptz), public.ech_admin_set_role(uuid,text),
  public.ech_admin_set_permission(uuid,text,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.ech_admin_users(integer,integer), public.ech_admin_permissions(uuid), public.ech_admin_audit(integer,integer),
  public.ech_admin_set_status(uuid,text,timestamptz), public.ech_admin_set_role(uuid,text),
  public.ech_admin_set_permission(uuid,text,boolean,timestamptz,timestamptz) to authenticated;


